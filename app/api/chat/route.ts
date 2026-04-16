import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { STYLIST_SYSTEM_PROMPT } from "@/lib/constants/stylist-system-prompt";
import { normalizeIntentFromModel } from "@/lib/chat/intent-payload";
import type { NormalizedIntentPayload } from "@/lib/chat/intent-payload";
import { getRestContextSnippetForPrompt } from "@/lib/kumo-rest/rest-context-snippet";

const SIDECAR_URL =
  process.env.SIDECAR_URL ||
  process.env.KUMO_SIDECAR_URL ||
  "http://127.0.0.1:8000";

// ── Capability → Sidecar call ─────────────────────────────────────────────
type Capability =
  | "demand_forecast"
  | "churn_list"
  | "reverse_rec"
  | "cold_affinity"
  | "explain"
  | "graph_schema"
  | "text";

/** Payload from the intent step, replayed on the narrate step */
type IntentPayload = NormalizedIntentPayload;

function intentTraceWarnings(intent: IntentPayload): string[] {
  const w: string[] = [];
  if (intent.clarifying_question) {
    w.push(`Clarification suggested: ${intent.clarifying_question}`);
  }
  if (typeof intent.confidence === "number" && intent.confidence < 0.35) {
    w.push(`Low routing confidence (${Math.round(intent.confidence * 100)}%). Verify entities and timeframe.`);
  }
  return w;
}

type TraceStepStatus = "ok" | "warning" | "error";

type TraceStep = {
  id: string;
  label: string;
  detail: string;
  latencyMs?: number | null;
  status: TraceStepStatus;
};

type TracePayload = {
  capability: Capability;
  entityId?: string | null;
  resultCount?: number | null;
  sidecarEndpoint?: string | null;
  servingMode?: "live" | "fallback";
  warnings?: string[];
  steps: TraceStep[];
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/** Retry wrapper for transient Gemini API failures */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`, err);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Unreachable");
}

function clampResultLimit(value: unknown, fallback = 5): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.round(parsed), 10));
}

function extractRequestedResultLimit(message: string): number | null {
  const text = message.toLowerCase();

  const topNumeric = text.match(/\btop\s+(\d{1,2})\b/i);
  if (topNumeric) return clampResultLimit(topNumeric[1]);

  const topWord = text.match(
    /\btop\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/i
  );
  if (topWord) return clampResultLimit(NUMBER_WORDS[topWord[1].toLowerCase()]);

  const directCount = text.match(/\b(\d{1,2})\s+(products?|items?)\b/i);
  const salesIntent = /(most sales|top selling|best sellers?|highest sales)/i.test(
    text
  );
  if (directCount && salesIntent) return clampResultLimit(directCount[1]);

  return null;
}

function defaultFollowUpsForCapability(
  capability: Capability,
  context?: { topUserId?: number | null; itemName?: string | null }
): string[] {
  if (capability === "demand_forecast") {
    return [
      "Which items in this category are predicted to go out of stock first?",
      "Predict which customer segment will drive the most of this demand",
      "If this forecast holds, what's the predicted revenue for next month?",
    ];
  }

  if (capability === "reverse_rec") {
    const itemName = context?.itemName || "this item";
    return [
      `Predict the conversion rate if we contact the top 10 buyers for ${itemName} today`,
      context?.topUserId
        ? `Is user ${context.topUserId} predicted to purchase ${itemName} anyway, or only with a push?`
        : "Which of these users is predicted to purchase without any intervention?",
      "If we focus on the top 3, what's the predicted revenue uplift?",
    ];
  }

  if (capability === "churn_list") {
    return [
      "Which of these customers has the highest predicted recovery probability?",
      "Predict the revenue impact of reactivating the top 5 from this list",
      "Who is predicted to churn permanently if we don't act this week?",
    ];
  }

  if (capability === "cold_affinity") {
    return [
      "Predict first-week sales if we launch exclusively to this segment",
      "Which users here are predicted to become repeat buyers, not one-time?",
      "Predict how performance shifts if we expand to the next affinity tier",
    ];
  }

  if (capability === "explain") {
    return [
      "What actions are predicted to reduce this user's churn risk the most?",
      "Predict how this user's risk score changes if they make one more purchase",
      "Which other customers share this exact predicted churn profile?",
    ];
  }

  return [
    "Which product categories are predicted to peak in the next 30 days?",
    "Who is predicted to churn before the end of this month?",
    "Which customers are predicted to respond to a re-engagement campaign?",
  ];
}

function sanitizeFollowUps(
  generated: unknown,
  capability: Capability,
  context?: { topUserId?: number | null; itemName?: string | null }
): string[] {
  // Strict mode: do not trust generated follow-ups. Only show
  // curated prompts that are known to map to supported capabilities.
  void generated;
  return defaultFollowUpsForCapability(capability, context);
}

// ── PQL generation helpers ────────────────────────────────────────────────────

type PqlContext =
  | { template: "demand_forecast"; days: number }
  | { template: "churn_list"; userIds: string }
  | { template: "reverse_rec"; itemId: number | string }
  | { template: "cold_affinity"; category: string }
  | { template: "explain"; userId: number | string }
  | { template: "none" };

function buildPqlContext(
  capability: Capability,
  intent: IntentPayload,
  rawData: unknown,
  sidecarResult: any
): PqlContext {
  switch (capability) {
    case "demand_forecast": {
      const days =
        typeof intent.timeframeDays === "number" && Number.isFinite(intent.timeframeDays)
          ? intent.timeframeDays
          : 30;
      return { template: "demand_forecast", days };
    }
    case "churn_list": {
      const ids = Array.isArray(rawData)
        ? rawData
            .slice(0, 5)
            .map((c: any) => c.userId ?? c.user_id)
            .filter((id): id is number => Number.isFinite(Number(id)))
            .join(", ")
        : "";
      return { template: "churn_list", userIds: ids || "—" };
    }
    case "reverse_rec": {
      const itemId =
        sidecarResult?.item?.itemId ?? sidecarResult?.item?.id ?? intent.itemId ?? 5;
      return { template: "reverse_rec", itemId };
    }
    case "cold_affinity": {
      const category = intent.category ?? sidecarResult?.category ?? "new category";
      return { template: "cold_affinity", category };
    }
    case "explain": {
      const userId =
        sidecarResult?.entityId ?? intent.userId ?? "—";
      return { template: "explain", userId };
    }
    default:
      return { template: "none" };
  }
}

function pqlContextToPromptLines(ctx: PqlContext): string {
  if (ctx.template === "none") return "";
  const lines: string[] = [`Template: ${ctx.template}`];
  if (ctx.template === "demand_forecast") lines.push(`days: ${ctx.days}`);
  if (ctx.template === "churn_list")      lines.push(`user_ids: ${ctx.userIds}`);
  if (ctx.template === "reverse_rec")     lines.push(`item_id: ${ctx.itemId}`);
  if (ctx.template === "cold_affinity")   lines.push(`category: ${ctx.category}`);
  if (ctx.template === "explain")         lines.push(`user_id: ${ctx.userId}`);
  return lines.join("\n");
}

// ── PQL sanitizer (Layer 3) ───────────────────────────────────────────────────

const PQL_STARTS_RE    = /^PREDICT\s+(SUM|COUNT|LIST_DISTINCT)\s*\(/i;
const PQL_FOR_RE       = /\bFOR\s+(users|items)\.\w+\s*(=|IN)\s*/i;
const PQL_INJECTION_RE = /[;]|--|\b(UNION|DROP|SELECT|INSERT|DELETE|UPDATE|EXEC|ALTER|CREATE)\b/i;
const PQL_MAX_LEN      = 350;

function sanitizePql(generated: unknown, fallback: string | null): string | null {
  if (typeof generated !== "string") return fallback ?? null;
  const s = generated.trim();
  if (!PQL_STARTS_RE.test(s)) {
    console.warn("[PQL sanitizer] rejected — does not start with PREDICT <aggregation>(");
    return fallback ?? null;
  }
  if (!PQL_FOR_RE.test(s)) {
    console.warn("[PQL sanitizer] rejected — missing valid FOR clause");
    return fallback ?? null;
  }
  if (PQL_INJECTION_RE.test(s)) {
    console.warn("[PQL sanitizer] rejected — injection pattern detected");
    return fallback ?? null;
  }
  if (s.length > PQL_MAX_LEN) {
    console.warn(`[PQL sanitizer] rejected — length ${s.length} exceeds max ${PQL_MAX_LEN}`);
    return fallback ?? null;
  }
  return s;
}

async function callSidecar(
  capability: Capability,
  entityId?: string
): Promise<{ payload: any; endpoint: string | null; latencyMs: number; ok: boolean }> {
  const startedAt = Date.now();
  try {
    switch (capability) {
      case "demand_forecast": {
        const endpoint = `${SIDECAR_URL}/predict/demand?days=${entityId || 30}`;
        const res = await fetch(endpoint, {
          signal: AbortSignal.timeout(10000),
        });
        return {
          payload: res.ok ? await res.json() : null,
          endpoint,
          latencyMs: Date.now() - startedAt,
          ok: res.ok,
        };
      }
      case "churn_list": {
        const endpoint = `${SIDECAR_URL}/predict/churn?limit=10`;
        const res = await fetch(endpoint, {
          signal: AbortSignal.timeout(10000),
        });
        return {
          payload: res.ok ? await res.json() : null,
          endpoint,
          latencyMs: Date.now() - startedAt,
          ok: res.ok,
        };
      }
      case "reverse_rec": {
        const itemId = parseInt(entityId || "5", 10);
        const endpoint = `${SIDECAR_URL}/predict/reverse-rec`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
          signal: AbortSignal.timeout(15000),
        });
        return {
          payload: res.ok ? await res.json() : null,
          endpoint,
          latencyMs: Date.now() - startedAt,
          ok: res.ok,
        };
      }
      case "cold_affinity": {
        const cat = entityId || "Sportswear";
        const endpoint = `${SIDECAR_URL}/predict/cold-affinity?category=${encodeURIComponent(cat)}`;
        const res = await fetch(
          endpoint,
          { signal: AbortSignal.timeout(15000) }
        );
        return {
          payload: res.ok ? await res.json() : null,
          endpoint,
          latencyMs: Date.now() - startedAt,
          ok: res.ok,
        };
      }
      case "explain": {
        const userId = parseInt(entityId || "0", 10);
        const endpoint = `${SIDECAR_URL}/predict/explain`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
          signal: AbortSignal.timeout(10000),
        });
        return {
          payload: res.ok ? await res.json() : null,
          endpoint,
          latencyMs: Date.now() - startedAt,
          ok: res.ok,
        };
      }
      default:
        return {
          payload: null,
          endpoint: null,
          latencyMs: Date.now() - startedAt,
          ok: false,
        };
    }
  } catch (e) {
    console.warn(`Sidecar error (${capability}):`, e);
    return {
      payload: null,
      endpoint: null,
      latencyMs: Date.now() - startedAt,
      ok: false,
    };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const raw = await req.text();
  if (!raw.trim()) {
    return NextResponse.json(
      {
        error: "Request body is required",
        details: "Send a JSON object with step and message.",
      },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "Invalid body", details: "Expected a JSON object." },
        { status: 400 }
      );
    }
    body = parsed as Record<string, unknown>;
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Invalid JSON", details }, { status: 400 });
  }

  const step = body.step;
  const message = body.message;
  const prevIntent = body.intentData as IntentPayload | undefined;

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  try {

    // SECURITY: Only use server-side environment variables, never NEXT_PUBLIC_*
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key not configured. Please set GEMINI_API_KEY in your environment variables.",
          narration:
            "Gemini API key not configured. Please set GEMINI_API_KEY in your environment variables.",
          type: "text",
        },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const restSnippet = await getRestContextSnippetForPrompt();
    const stylistPrompt = STYLIST_SYSTEM_PROMPT + restSnippet;

    // ════════════════════════════════════════════════════════════════════
    // STEP 1 — Intent Classification
    // ════════════════════════════════════════════════════════════════════
    if (step === "intent") {
      const intentStartedAt = Date.now();
      const routerPrompt = `${stylistPrompt}

Analyze this message from a Head of Merchandising: "${message}"

Classify it into ONE capability:
- "demand_forecast" — asking about which categories/products will peak, trend, or sell well
- "churn_list" — asking about customers about to churn, be lost, or go silent
- "reverse_rec" — asking who should buy a specific item, inventory clearance targeting
- "cold_affinity" — asking about customer affinity for a new/unlaunched category
- "explain" — asking WHY a user was flagged, asking for reasoning or signals
- "graph_schema" — asking to see the graph, the data schema, or how the tables/data are connected
- "text" — greeting, irrelevant, or out of scope

Also extract:
- itemId: numeric item ID if mentioned (e.g. user says "item 5" → 5), or null
- userId: numeric user ID if mentioned, or null
- category: product category name if mentioned (e.g. "activewear", "sportswear"), or null
- timeframeDays: numeric number of days if a timeframe is explicitly mentioned (e.g. "next 60 days" -> 60), or null
- confidence: optional number between 0 and 1 — your confidence in this routing given the message
- clarifying_question: optional string — one short question to ask the user ONLY if entity ID or timeframe is ambiguous; otherwise null

Return ONLY valid JSON:
{
  "capability": "demand_forecast" | "churn_list" | "reverse_rec" | "cold_affinity" | "explain" | "graph_schema" | "text",
  "itemId": number | null,
  "userId": number | null,
  "category": string | null,
  "timeframeDays": number | null,
  "confidence": number | null,
  "clarifying_question": string | null
}`;

      const intentRes = await withRetry(() => ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: routerPrompt,
        config: { responseMimeType: "application/json" },
      }));

      let intent: IntentPayload;
      try {
        intent = normalizeIntentFromModel(JSON.parse(intentRes.text || "{}"));
      } catch {
        intent = normalizeIntentFromModel({});
      }

      const requestedResultLimit = extractRequestedResultLimit(message);
      if (requestedResultLimit != null) {
        intent = { ...intent, resultLimit: requestedResultLimit };
      }

      // Circuit-breakers
      if (intent.capability === "text") {
        const isGreeting = /^(hi|hello|hey|good\s+(morning|afternoon|evening))/i.test(message.trim());
        return NextResponse.json({
          fastResponse: isGreeting
            ? "Good morning. I'm ready. What business question can I answer for you today?"
            : "I can answer questions about customer predictions, product demand, inventory targeting, and churn risk. Try one of those.",
          followUps: [
            "Which product categories are predicted to peak in the next 30 days?",
            "Who is predicted to churn before the end of this month?",
            "Which customers are predicted to respond to a re-engagement campaign?",
          ],
          trace: {
            capability: "text",
            entityId: null,
            resultCount: null,
            sidecarEndpoint: null,
            servingMode: "fallback",
            warnings: [
              "Message routed to guidance because it was outside supported prediction intents.",
              ...intentTraceWarnings(intent),
            ],
            steps: [
              {
                id: "intent",
                label: "Intent routing",
                detail: "Routed message to general guidance instead of a predictive workflow.",
                latencyMs: Date.now() - intentStartedAt,
                status: "warning",
              },
            ],
          } satisfies TracePayload,
        });
      }

      return NextResponse.json({
        intent,
        trace: {
          capability: intent.capability,
          entityId:
            intent.itemId != null
              ? String(intent.itemId)
              : intent.userId != null
              ? String(intent.userId)
              : intent.category ?? (intent.timeframeDays != null ? String(intent.timeframeDays) : null),
          resultCount: null,
          sidecarEndpoint: null,
          servingMode: "live",
          warnings: intentTraceWarnings(intent),
          steps: [
            {
              id: "intent",
              label: "Intent routing",
              detail: `Mapped request to ${intent.capability}.`,
              latencyMs: Date.now() - intentStartedAt,
              status: "ok",
            },
          ],
        } satisfies TracePayload,
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 2 — Call Sidecar + Narrate
    // ════════════════════════════════════════════════════════════════════
    const intent: IntentPayload = prevIntent ?? { capability: "text" };
    const capability: Capability = intent.capability ?? "text";

    // Build entity ID for sidecar
    const entityId =
      capability === "demand_forecast" && intent.timeframeDays != null
        ? String(intent.timeframeDays)
        : intent.itemId != null
        ? String(intent.itemId)
        : intent.userId != null
        ? String(intent.userId)
        : intent.category || undefined;

    // Call sidecar
    const narrationStartedAt = Date.now();
    const sidecarCall = await callSidecar(capability, entityId);
    const sidecarResult = sidecarCall.payload;
    const rawData = sidecarResult?.results ?? sidecarResult ?? null;
    // sidecarPql is the static fallback; generatedPql (built after narration) overrides it
    const sidecarPql = sidecarResult?.pql ?? null;

    // Build narration context from real data
    let dataContext = "No prediction data available.";

    const timeframeLabel =
      capability === "demand_forecast" &&
      typeof intent.timeframeDays === "number" &&
      Number.isFinite(intent.timeframeDays)
        ? intent.timeframeDays
        : 30;
    const resultLimit = clampResultLimit(intent.resultLimit, 5);

    if (capability === "demand_forecast" && Array.isArray(rawData)) {
      dataContext = `Category demand forecast (next ${timeframeLabel} days):\n${rawData
        .slice(0, 8)
        .map(
          (c: any, i: number) =>
            `${i + 1}. ${c.category} — predicted revenue: $${Number.isFinite(Number(c.demandScore)) ? Number(c.demandScore).toFixed(0) : "0"}`
        )
        .join("\n")}`;
      if (sidecarResult?.itemResults) {
        dataContext += `\n\nTop individual items:\n${sidecarResult.itemResults
          .slice(0, resultLimit)
          .map(
            (i: any) =>
              `• ${i.itemName} (${i.category}): $${Number.isFinite(Number(i.demandScore)) ? Number(i.demandScore).toFixed(0) : "0"}`
          )
          .join("\n")}`;
      }
    } else if (capability === "churn_list" && Array.isArray(rawData)) {
      dataContext = `Churn risk predictions:\n${rawData
        .slice(0, 5)
        .map(
          (c: any) =>
            `• User ${c.userId} (age ${c.age ?? "—"}): ${(Number.isFinite(Number(c.churnProbability)) ? Number(c.churnProbability) * 100 : 0).toFixed(1)}% churn risk. Signal: ${c.topSignal ?? "—"}. ${
              c.winBackArticle ? `Win-back rec: ${c.winBackArticle.name}` : ""
            }`
        )
        .join("\n")}`;
    } else if (capability === "reverse_rec" && sidecarResult) {
      const item = sidecarResult.item;
      const users = Array.isArray(rawData) ? rawData.slice(0, 5) : [];
      dataContext = `Reverse recommendation for ${item?.name ?? `Item ${entityId}`} (${item?.category ?? "unknown category"}):\n${users
        .map(
          (u: any, i: number) =>
            `${i + 1}. User ${u.userId}: ${(Number.isFinite(Number(u.purchaseProbability)) ? Number(u.purchaseProbability) * 100 : 0).toFixed(1)}% purchase probability`
        )
        .join("\n")}`;
    } else if (capability === "cold_affinity" && Array.isArray(rawData)) {
      dataContext = `Cold category affinity for "${intent.category ?? "new category"}":\nIdentified ${rawData.length} users with high affinity. Top scores: ${rawData
        .slice(0, 3)
        .map(
          (u: any) =>
            `User ${u.userId} (${(Number.isFinite(Number(u.affinityScore)) ? Number(u.affinityScore) * 100 : 0).toFixed(1)}%)`
        )
        .join(", ")}`;
    } else if (capability === "explain" && sidecarResult) {
      const signals = sidecarResult.signalBreakdown ?? [];
      dataContext = `Explainability for User ${sidecarResult.entityId}:\nPrediction: ${sidecarResult.prediction}\nTop signals:\n${signals
        .slice(0, 4)
        .map(
          (s: any) =>
            `• ${s.label} (importance: ${(Number.isFinite(Number(s.importance)) ? Number(s.importance) * 100 : 0).toFixed(0)}%)`
        )
        .join("\n")}`;
    } else if (capability === "graph_schema") {
      dataContext = `The user requested to see the graph schema or data layout. Acknowledge the request, tell them that Kumo automatically mapped the tables (customers, items, transactions), and explain that they can explore the interactive graph below.`;
    }

    // Build PQL context from real sidecar data — used in narration prompt (Layer 2)
    const pqlContext = buildPqlContext(capability, intent, rawData, sidecarResult);
    const pqlContextLines = pqlContextToPromptLines(pqlContext);

    // Narration prompt
    const narrationPrompt = `${stylistPrompt}

The user (Head of Merchandising) asked: "${message}"

REAL KumoRFM prediction data:
${dataContext}

Write a concise response in business language. Rules:
- Reference actual numbers from the data above
- 2-3 short paragraphs max
- For churn: mention the specific win-back product recommendation
- For demand: highlight the #1 category with its revenue projection
- For explain: walk through the top 3 signals conversationally
- Be highly conversational, natural, and direct. Act like a helpful human colleague.
- DO NOT use robotic phrasing like "KumoRFM identified...", "The graph shows...", or "The model predicts...". Just state the insights directly (e.g. "I found 20 customers...", "User 112 is highly likely to engage because...").
- End with one sentence suggesting a next action

PQL CONTEXT for this turn (use ONLY these values — do not invent others):
${pqlContextLines || "No PQL context available for this capability."}

Using the PQL generation contract and canonical templates from the system prompt, substitute the values above into the correct template to produce the "pql" field. Output only the query string — no backticks, no markdown, no explanation text.

Return valid JSON:
{
  "narration": "...",
  "followUps": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "pql": "PREDICT ..."
}`;

    const narrationRes = await withRetry(() => ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: narrationPrompt,
      config: { responseMimeType: "application/json" },
    }));
    const narrationLatencyMs = Date.now() - narrationStartedAt;

    let narration = "Results loaded.";
    let followUps: string[] = [];
    let generatedPql: string | null = sidecarPql;
    try {
      const parsed = JSON.parse(narrationRes.text || "{}");
      narration = parsed.narration || narration;
      followUps = parsed.followUps || [];
      generatedPql = sanitizePql(parsed.pql, sidecarPql);
    } catch {
      narration = narrationRes.text || narration;
    }

    const topUserId =
      capability === "reverse_rec" && Array.isArray(rawData) && rawData.length > 0
        ? Number(rawData[0]?.userId ?? rawData[0]?.user_id ?? NaN)
        : null;
    const safeFollowUps = sanitizeFollowUps(followUps, capability, {
      topUserId: Number.isFinite(topUserId) ? topUserId : null,
      itemName: sidecarResult?.item?.name ?? null,
    });

    const resultCount = Array.isArray(rawData)
      ? rawData.length
      : sidecarResult?.results && Array.isArray(sidecarResult.results)
      ? sidecarResult.results.length
      : sidecarResult
      ? 1
      : 0;
    const sidecarWarnings = sidecarCall.ok
      ? []
      : ["Sidecar did not return a live result. Response may be fallback guidance."];
    const trace: TracePayload = {
      capability,
      entityId: entityId ?? null,
      resultCount,
      sidecarEndpoint: sidecarCall.endpoint,
      servingMode: sidecarCall.ok ? "live" : "fallback",
      warnings: [...intentTraceWarnings(intent), ...sidecarWarnings],
      steps: [
        {
          id: "capability",
          label: "Workflow selection",
          detail: `Selected ${capability} workflow${entityId ? ` for entity ${entityId}` : ""}.`,
          status: "ok",
        },
        {
          id: "sidecar",
          label: "Kumo sidecar call",
          detail: sidecarCall.ok
            ? `Fetched ${resultCount} live result${resultCount === 1 ? "" : "s"} from ${sidecarCall.endpoint}.`
            : "Sidecar result was unavailable, so the answer may be incomplete.",
          latencyMs: sidecarCall.latencyMs,
          status: sidecarCall.ok ? "ok" : "warning",
        },
        {
          id: "narration",
          label: "Narration synthesis",
          detail: "Converted structured prediction output into business-language guidance.",
          latencyMs: narrationLatencyMs,
          status: "ok",
        },
      ],
    };

    return NextResponse.json({
      narration,
      pql: generatedPql,
      type: capability,
      results: rawData,
      item: sidecarResult?.item,
      itemResults: sidecarResult?.itemResults,
      resultLimit,
      explainData: capability === "explain" ? sidecarResult : undefined,
      followUps: safeFollowUps,
      intent,
      trace,
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Failed to process", details: String(error) },
      { status: 500 }
    );
  }
}
