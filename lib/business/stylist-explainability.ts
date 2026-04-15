import type { Message } from "@/lib/types";
import { formatCapabilityLabel, formatCurrency } from "@/lib/utils/formatters";

/** Strip PQL boilerplate for display copy—tolerant of placeholder variants. */
function sanitizePqlSnippet(pql: string): string {
  let s = pql.trim();
  if (s.toUpperCase().startsWith("PREDICT ")) s = s.slice(8).trim();
  s = s.replace(/\s+FOR\s+items\.item_id=<id>/gi, "");
  s = s.replace(/\s+FOR\s+users\.user_id=<id>/gi, "");
  s = s.replace(/\s+FOR\s+users\.user_id=\d+/gi, "");
  return s.trim();
}

export function buildExplainabilityItem(msg: Message) {
  if (msg.role !== "assistant" || msg.id === "welcome") return null;

  const capability = msg.trace?.capability ?? msg.type ?? "text";
  const servingMode = msg.trace?.servingMode ?? "fallback";
  if (capability === "text") return null;
  const resultCount = msg.trace?.resultCount ?? null;
  const entityId = msg.trace?.entityId ?? null;
  const hasPql = Boolean(msg.pql);
  const cleanedPql = msg.pql ? sanitizePqlSnippet(msg.pql) : null;
  const capabilityLabel = formatCapabilityLabel(capability);

  const genericBullets = [
    `Kumo ran the ${capabilityLabel} workflow on the relational graph${entityId ? ` for ${entityId}` : ""}.`,
    hasPql
      ? "The answer is grounded in the Kumo PQL shown below."
      : "This response follows the current Kumo workflow and guardrails.",
    resultCount != null
      ? `The workflow returned ${resultCount} result${resultCount === 1 ? "" : "s"}.`
      : "The response follows the current Kumo workflow and safety guardrails.",
  ];

  switch (capability) {
    case "demand_forecast": {
      const categories = Array.isArray(msg.data) ? msg.data : [];
      const items = Array.isArray(msg.itemResults) ? msg.itemResults : [];
      const topCategory = categories[0];
      const topCategoryName = topCategory?.category;
      const topCategoryTotal =
        typeof topCategory?.demandScore === "number" ? topCategory.demandScore : null;
      const topCategoryItems = topCategoryName
        ? items
            .filter((item: { category?: string }) => item?.category === topCategoryName)
            .sort(
              (a: { demandScore?: number }, b: { demandScore?: number }) =>
                (b?.demandScore ?? 0) - (a?.demandScore ?? 0)
            )
            .slice(0, 3)
        : [];
      const namedContribution = topCategoryItems.reduce(
        (sum: number, item: { demandScore?: number }) =>
          sum + (typeof item?.demandScore === "number" ? item.demandScore : 0),
        0
      );
      const remainder =
        typeof topCategoryTotal === "number"
          ? Math.max(topCategoryTotal - namedContribution, 0)
          : null;

      return {
        title:
          topCategoryName && topCategoryTotal != null
            ? `Why ${topCategoryName} is projected at ${formatCurrency(topCategoryTotal)}`
            : "How this demand prediction was calculated",
        bullets: [
          servingMode === "live"
            ? hasPql
              ? `Kumo forecasted future ${cleanedPql} at the item level, then rolled those item forecasts up into category totals.`
              : "Kumo forecasted item-level revenue over the requested time window and then aggregated those forecasts into category totals."
            : genericBullets[0],
          topCategoryName && topCategoryTotal != null
            ? topCategoryItems.length > 0
              ? `${topCategoryName} reaches ${formatCurrency(topCategoryTotal)} because its projected category total includes named leaders like ${topCategoryItems
                  .map(
                    (item: { itemName?: string; demandScore?: number }) =>
                      `${item.itemName} (${formatCurrency(item.demandScore)})`
                  )
                  .join(", ")}${remainder != null ? `, plus ${formatCurrency(remainder)} from the rest of the ${topCategoryName.toLowerCase()} assortment.` : "."}`
              : `${topCategoryName} reaches ${formatCurrency(topCategoryTotal)} as the sum of projected revenue across all forecasted items in that category, not from a single SKU.`
            : "The category number is a rollup across all forecasted items in that category rather than a single-product estimate.",
          topCategoryName && topCategoryItems.length > 0
            ? `The item list shown below is only a sample of the strongest contributors, so the category total can be much larger than the few named products displayed in chat.`
            : genericBullets[2],
        ],
      };
    }
    case "churn_list":
    case "competitive_churn": {
      const customers = Array.isArray(msg.data) ? msg.data : [];
      const topCustomer = customers[0];
      return {
        title:
          topCustomer?.userId != null
            ? `Why user ${topCustomer.userId} is ranked highest`
            : "How this churn ranking was calculated",
        bullets: [
          servingMode === "live"
            ? "Kumo ranked customers by churn risk from historical order behavior, with recency, inactivity, order frequency, and engagement signals influencing the score."
            : genericBullets[0],
          topCustomer
            ? `The top-ranked customer is carrying a ${Math.round((topCustomer.churnProbability ?? 0) * 100)}% churn score, driven here by ${String(topCustomer.topSignal ?? "the strongest observed disengagement signal").toLowerCase()}.`
            : "Customers are sorted from highest to lowest predicted churn risk based on the current Kumo output.",
          resultCount != null
            ? `This answer is based on the highest-risk ${resultCount} customer record${resultCount === 1 ? "" : "s"} returned by the churn workflow.`
            : genericBullets[2],
        ],
      };
    }
    case "reverse_rec": {
      const users = Array.isArray(msg.data) ? msg.data : [];
      const itemName = msg.item?.name ?? (entityId ? `item ${entityId}` : "this item");
      const topUser = users[0];
      return {
        title: `Why these users were ranked for ${itemName}`,
        bullets: [
          servingMode === "live"
            ? "Kumo started from the selected item and ranked users by predicted purchase likelihood in the forecast window."
            : genericBullets[0],
          topUser
            ? `The highest-ranked user in this list is user ${topUser.userId ?? topUser.user_id} at ${Math.round(((topUser.purchaseProbability ?? 0) as number) * 100)}% predicted purchase probability for ${itemName}.`
            : "Users are sorted from highest to lowest predicted likelihood to purchase this item.",
          resultCount != null
            ? `This list is the top ${resultCount} user recommendation set returned by the reverse-recommendation workflow.`
            : genericBullets[2],
        ],
      };
    }
    case "cold_affinity": {
      const users = Array.isArray(msg.data) ? msg.data : [];
      const topUser = users[0];
      return {
        title: "How this launch audience was calculated",
        bullets: [
          servingMode === "live"
            ? "Kumo scored category affinity to estimate which customers are most likely to respond to this new category."
            : genericBullets[0],
          topUser
            ? `The top user in this audience is user ${topUser.userId ?? topUser.user_id} with an affinity score of ${Math.round(((topUser.affinityScore ?? 0) as number) * 100)}%.`
            : "Customers are ranked by modeled affinity to the proposed launch category.",
          resultCount != null
            ? `This audience contains ${resultCount} high-affinity customer record${resultCount === 1 ? "" : "s"}.`
            : genericBullets[2],
        ],
      };
    }
    case "explain": {
      const explainData = msg.data;
      const isRealKumo = explainData?.source === "kumo";
      const explainPql = explainData?.pql ?? null;
      const signals = Array.isArray(explainData?.signalBreakdown)
        ? explainData.signalBreakdown.slice(0, 3)
        : [];
      const topSignal = signals[0];

      return {
        title: isRealKumo
          ? `Why user ${explainData?.entityId ?? entityId} is the highest-risk customer`
          : "What Kumo used to explain this prediction",
        bullets: [
          isRealKumo && explainPql
            ? `Kumo ran \`${explainPql}\` with \`explain=True\` to retrieve the GNN attribution subgraph for this user.`
            : servingMode === "live"
              ? "Kumo read the model explanation artifacts for this entity, including top signals, peer context, and local subgraph evidence."
              : genericBullets[0],
          isRealKumo && topSignal
            ? `The strongest attribution signal is "${topSignal.label}" at ${Math.round((topSignal.importance ?? 0) * 100)}% — this is the specific data point the Kumo GNN weighted most heavily for this prediction.`
            : signals.length > 0
              ? `The explanation is built from the strongest signals returned by Kumo: ${signals
                  .map((s: { label?: string; importance?: number }) => `${s.label} (${Math.round((s.importance ?? 0) * 100)}%)`)
                  .join(", ")}.`
              : "The explanation is built from the strongest signals returned by Kumo for this prediction.",
          isRealKumo
            ? "The right panel shows the full attribution subgraph — each row score reflects how much that transaction or attribute pushed the churn prediction."
            : genericBullets[2],
        ],
      };
    }
    default:
      return {
        title: "How this answer was formed",
        bullets: genericBullets,
      };
  }
}
