/**
 * Normalizes Gemini intent JSON for consistent downstream typing and golden tests.
 */

export type IntentRouterCapability =
  | "demand_forecast"
  | "churn_list"
  | "reverse_rec"
  | "cold_affinity"
  | "explain"
  | "graph_schema"
  | "text";

export type NormalizedIntentPayload = {
  capability: IntentRouterCapability;
  itemId?: number | null;
  userId?: number | null;
  category?: string | null;
  timeframeDays?: number | null;
  resultLimit?: unknown;
  /** Model self-reported confidence in [0, 1] when provided */
  confidence?: number | null;
  /** Ask user for missing entity / timeframe before running a heavy workflow */
  clarifying_question?: string | null;
};

const CAPABILITIES: IntentRouterCapability[] = [
  "demand_forecast",
  "churn_list",
  "reverse_rec",
  "cold_affinity",
  "explain",
  "graph_schema",
  "text",
];

function isCapability(x: unknown): x is IntentRouterCapability {
  return typeof x === "string" && (CAPABILITIES as string[]).includes(x);
}

/** Exported for tests — normalizes raw model output into a safe shape */
export function normalizeIntentFromModel(raw: unknown): NormalizedIntentPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { capability: "text" };
  }
  const o = raw as Record<string, unknown>;
  const capability = isCapability(o.capability) ? o.capability : "text";

  let confidence: number | null | undefined;
  if (typeof o.confidence === "number" && Number.isFinite(o.confidence)) {
    confidence = Math.max(0, Math.min(1, o.confidence));
  } else {
    confidence = undefined;
  }

  let clarifying_question: string | null | undefined;
  if (typeof o.clarifying_question === "string" && o.clarifying_question.trim()) {
    clarifying_question = o.clarifying_question.trim().slice(0, 500);
  } else {
    clarifying_question = undefined;
  }

  return {
    capability,
    itemId: o.itemId === null || typeof o.itemId === "number" ? (o.itemId as number | null) : null,
    userId: o.userId === null || typeof o.userId === "number" ? (o.userId as number | null) : null,
    category: typeof o.category === "string" ? o.category : null,
    timeframeDays:
      o.timeframeDays === null || typeof o.timeframeDays === "number"
        ? (o.timeframeDays as number | null)
        : null,
    resultLimit: o.resultLimit,
    confidence: confidence === undefined ? undefined : confidence,
    clarifying_question: clarifying_question === undefined ? undefined : clarifying_question,
  };
}
