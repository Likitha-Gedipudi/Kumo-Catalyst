import type { Message } from "@/lib/types";
import type { BoardAction, DecisionLens } from "@/lib/types/stylist-board";
import {
  formatCompactNumber,
  getConfidenceLabel,
  summarizeSignal,
} from "@/lib/utils/formatters";

export function buildDecisionLens(
  latestBoardMessage: Message | undefined,
  timeframeDays: number,
  healthSignal?: number
): DecisionLens {
  // Real confidence proxy derived from sidecar health; fall back to conservative 65
  const baseConfidence = healthSignal != null ? Math.round(Math.min(100, Math.max(40, healthSignal))) : 65;

  if (!latestBoardMessage?.type) {
    return {
      focus: "Portfolio overview",
      title: "Waiting for a live business question",
      summary:
        "Use the chat to ask about demand, churn, inventory, or a new launch. The board will validate model health, show the decision frame, and keep broader portfolio context visible.",
      confidencePct: baseConfidence,
      confidenceLabel: "Board ready",
      supportLabel: "Graph and monitoring loaded",
      horizonLabel: "30d / 90d task windows",
      evidence: [
        "Live graph connectivity",
        "Explainability available",
        "Demand and churn monitors active",
      ],
      action:
        "Start with a concrete merchandising question so the board can pivot from monitoring to decision support.",
      caution:
        "Until a query is asked, the board shows portfolio context rather than a decision-specific recommendation.",
    };
  }

  if (latestBoardMessage.type === "reverse_rec") {
    const ranked = Array.isArray(latestBoardMessage.data) ? latestBoardMessage.data : [];
    const topProbability = ranked.length > 0 ? Math.max(...ranked.map((row: { purchaseProbability?: number }) => row.purchaseProbability ?? 0)) : 0;
    const productName = latestBoardMessage.item?.name || "Selected item";
    const productType = latestBoardMessage.item?.category || "Known category";
    const confidencePct = Math.min(100, Math.round(topProbability * 100 + Math.min(ranked.length, 6) * 4));

    return {
      focus: "Inventory clearance",
      title: `${productName} is best handled as a narrow activation`,
      summary:
        "This result is strongest as a precision outreach decision, not a broad merchandising push. The model is finding a small group of buyers with concentrated near-term intent.",
      confidencePct,
      confidenceLabel: getConfidenceLabel(confidencePct),
      supportLabel: `${ranked.length || 0} ranked candidates`,
      horizonLabel: "30-day purchase window",
      evidence: [
        productType,
        `${ranked.length || 0} scored buyers`,
        "Item-level affinity ranking",
        "Near-term conversion focus",
      ],
      action:
        "Run a personalized outreach to the highest-ranked buyers first, then expand only if the first wave underperforms.",
      caution:
        "The opportunity is concentrated in a small audience, so a broad campaign would likely dilute efficiency.",
    };
  }

  if (latestBoardMessage.type === "cold_affinity") {
    const audience = Array.isArray(latestBoardMessage.data) ? latestBoardMessage.data : [];
    const topAffinity = audience.length > 0 ? Math.max(...audience.map((row: { affinityScore?: number }) => row.affinityScore ?? 0)) : 0;
    const confidencePct = Math.min(100, Math.round(topAffinity * 100 + Math.min(audience.length, 10) * 2));

    return {
      focus: "New category launch",
      title: "Use the model as an audience-finding lens before launch",
      summary:
        "The board is surfacing an addressable audience with adjacent-category behavior, which is ideal for a controlled launch test before committing larger spend.",
      confidencePct,
      confidenceLabel: getConfidenceLabel(confidencePct),
      supportLabel: `${audience.length || 0} high-affinity users`,
      horizonLabel: "30-day affinity window",
      evidence: [
        "Adjacent-category behavior",
        `${audience.length || 0} qualified users`,
        "No purchase history required",
        "Launch audience discovery",
      ],
      action:
        "Start with a test launch audience and measure response before rolling the category out more broadly.",
      caution:
        "Affinity is a readiness signal, not proof of demand at full price or at scale.",
    };
  }

  if (latestBoardMessage.type === "demand_forecast") {
    const categories = Array.isArray(latestBoardMessage.data) ? latestBoardMessage.data : [];
    const topCategory = categories[0];
    // Derive confidence from how many ranked categories the model returned, anchored to baseConfidence
    const confidencePct = categories.length > 0
      ? Math.round(Math.min(100, baseConfidence * 0.6 + (Math.min(categories.length, 50) / 50) * 40))
      : baseConfidence;

    return {
      focus: "Demand outlook",
      title: topCategory
        ? `${topCategory.category} is leading the next planning window`
        : "Demand forecast is active",
      summary:
        "Use this as a portfolio-weighting signal. The forecast is telling you where to lean on inventory and marketing attention over the next cycle.",
      confidencePct,
      confidenceLabel: getConfidenceLabel(confidencePct),
      supportLabel: `${categories.length || 0} ranked categories`,
      horizonLabel: `Next ${timeframeDays} days`,
      evidence: [
        topCategory?.category || "Category ranking",
        topCategory ? `$${formatCompactNumber(Math.round(topCategory.demandScore || 0))} projected` : "Projected demand",
        "Revenue-based forecast",
        "Portfolio-level trend view",
      ],
      action:
        "Bias replenishment, placements, and campaign weight toward the leading categories while watching for shifts in the next update.",
      caution:
        "This is a forward-looking signal based on graph behavior, so it should guide prioritization rather than replace merchant judgment.",
    };
  }

  if (latestBoardMessage.type === "churn_list" || latestBoardMessage.type === "competitive_churn") {
    const atRisk = Array.isArray(latestBoardMessage.data) ? latestBoardMessage.data : [];
    const avgRisk =
      atRisk.length > 0
        ? atRisk.reduce((sum: number, customer: { churnProbability?: number }) => sum + (customer.churnProbability ?? 0), 0) / atRisk.length
        : 0;
    const highestRisk = atRisk.length > 0 ? Math.max(...atRisk.map((row: { churnProbability?: number }) => row.churnProbability ?? 0)) : 0;
    const evidence = Array.from(
      new Set(atRisk.map((customer: { topSignal?: string }) => summarizeSignal(customer.topSignal)).filter(Boolean))
    ).slice(0, 4);
    const confidencePct = Math.min(100, Math.round(avgRisk * 100 + Math.min(atRisk.length, 6) * 3));

    return {
      focus: "Retention risk",
      title: "Retention pressure is concentrated and actionable",
      summary:
        atRisk.length > 0
          ? `Peak modeled churn is ${Math.round(highestRisk * 100)}% (cohort average ${Math.round(avgRisk * 100)}%). Prioritize the highest-risk customers first; signals cluster on ${evidence.slice(0, 2).join(" · ") || "recency and engagement"}.`
          : "This is a customer-protection decision. The most important pattern is not just who is at risk, but that similar disengagement signals are repeating across the flagged group.",
      confidencePct,
      confidenceLabel: getConfidenceLabel(confidencePct),
      supportLabel: `${atRisk.length || 0} flagged customers`,
      horizonLabel: "90-day churn window",
      evidence: evidence.length > 0 ? evidence : ["Behavioral churn signals", "Comparative peer risk"],
      action:
        "Prioritize win-back outreach for the highest-risk users first, then use the explainability tab to tailor message and offer strategy.",
      caution:
        "High churn risk indicates urgency, but recovery still depends on timing, offer quality, and channel fit.",
    };
  }

  return {
    focus: "Retail intelligence",
    title: "Decision signal loaded",
    summary:
      "The board has a live prediction in context and is using it to update trust, reasoning, and next-action guidance.",
    confidencePct: baseConfidence,
    confidenceLabel: "Board updated",
    supportLabel: "Live query loaded",
    horizonLabel: "Active task window",
    evidence: ["Model response received", "Dashboard context refreshed"],
    action:
      "Use the board to validate the answer and the explainability tab to inspect how the model reached it.",
    caution:
      "If you need individual-level detail, keep the transcript as the source of the full answer.",
  };
}

export function buildBoardActions(latestBoardMessage: Message | undefined): BoardAction[] {
  if (!latestBoardMessage?.type) {
    return [
      {
        label: "Show me customers who are about to churn.",
        kind: "chat",
        question: "Show me customers who are about to churn.",
      },
      {
        label: "Which product categories are about to peak in the next 30 days?",
        kind: "chat",
        question: "Which product categories are about to peak in the next 30 days?",
      },
    ];
  }

  if (latestBoardMessage.type === "reverse_rec") {
    const itemName = latestBoardMessage.item?.name || "this item";
    const topUserId = latestBoardMessage.data?.[0]?.userId ?? latestBoardMessage.data?.[0]?.user_id;
    return [
      {
        label: `Segment these users for a special promotion on ${itemName}.`,
        kind: "chat",
        question: `Segment these users for a special promotion on ${itemName}.`,
      },
      ...(topUserId
        ? [
            {
              label: `Explain why user ${topUserId} is a top target.`,
              kind: "explain" as const,
              userId: topUserId,
            },
          ]
        : []),
      {
        label: "Explore other inventory items that could benefit from reverse recommendations.",
        kind: "chat",
        question: "Explore other inventory items that could benefit from reverse recommendations.",
      },
    ];
  }

  if (latestBoardMessage.type === "cold_affinity") {
    const topUserId = latestBoardMessage.data?.[0]?.userId ?? latestBoardMessage.data?.[0]?.user_id;
    return [
      {
        label: "Turn this audience into a launch campaign segment.",
        kind: "chat",
        question: "Turn this audience into a launch campaign segment.",
      },
      ...(topUserId
        ? [
            {
              label: `Explain why user ${topUserId} is in this launch audience.`,
              kind: "explain" as const,
              userId: topUserId,
            },
          ]
        : []),
      {
        label: "Analyze common characteristics of these top users to find similar segments.",
        kind: "chat",
        question: "Analyze common characteristics of these top users to find similar segments.",
      },
    ];
  }

  if (latestBoardMessage.type === "demand_forecast") {
    return [
      {
        label: "Show me the top individual items inside the leading category.",
        kind: "chat",
        question: "Show me the top individual items inside the leading category.",
      },
      {
        label: "Which customers are driving the strongest demand right now?",
        kind: "chat",
        question: "Which customers are driving the strongest demand right now?",
      },
      {
        label: "What inventory should we protect over the next 30 days?",
        kind: "chat",
        question: "What inventory should we protect over the next 30 days?",
      },
    ];
  }

  if (latestBoardMessage.type === "churn_list" || latestBoardMessage.type === "competitive_churn") {
    const topUserId = latestBoardMessage.data?.[0]?.userId ?? latestBoardMessage.data?.[0]?.user_id;
    return [
      ...(topUserId
        ? [
            {
              label: `Explain why user ${topUserId} is the highest churn risk.`,
              kind: "explain" as const,
              userId: topUserId,
            },
          ]
        : []),
      {
        label: "Which win-back products are most likely to retain these customers?",
        kind: "chat",
        question: "Which win-back products are most likely to retain these customers?",
      },
      {
        label: "Summarize the common churn signals across these customers.",
        kind: "chat",
        question: "Summarize the common churn signals across these customers.",
      },
    ];
  }

  return [];
}
