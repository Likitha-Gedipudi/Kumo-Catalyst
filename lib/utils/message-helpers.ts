// ── Utility functions for message handling ────────────────────────────────

import type { Message, IntelligenceBoard } from "@/lib/types";
import type { StarterPrompt } from "@/lib/constants/prompts";

/**
 * Find the latest assistant message matching any of the specified capability types
 * @example latestCapabilityMessage(messages, ["demand_forecast", "churn_list"])
 */
export function latestCapabilityMessage(
  messages: Message[],
  types: Array<Message["type"]>
): Message | undefined {
  return [...messages]
    .reverse()
    .find((msg) => msg.role === "assistant" && msg.type && types.includes(msg.type));
}

/**
 * Build dynamic follow-up prompts based on previous conversation context
 * Personalizes starter prompt follow-ups with actual data from the board and messages
 */
export function buildDynamicStarterFollowUps(
  prompt: StarterPrompt,
  board: IntelligenceBoard | null,
  messages: Message[]
): string[] {
  const latestDemand = latestCapabilityMessage(messages, ["demand_forecast"]);
  const latestChurn = latestCapabilityMessage(messages, ["churn_list", "competitive_churn"]);
  const latestReverseRec = latestCapabilityMessage(messages, ["reverse_rec"]);
  const latestAffinity = latestCapabilityMessage(messages, ["cold_affinity"]);
  const latestExplain = latestCapabilityMessage(messages, ["explain"]);

  const topCategory =
    (Array.isArray(latestDemand?.data) && latestDemand?.data[0]?.category) ||
    board?.categoryDemand?.[0]?.category ||
    "Trousers";
  const secondCategory =
    (Array.isArray(latestDemand?.data) && latestDemand?.data[1]?.category) ||
    board?.categoryDemand?.[1]?.category ||
    "Cardigan";
  const topDemandItem =
    latestDemand?.itemResults?.[0]?.itemName ||
    board?.itemDemand?.[0]?.itemName ||
    "top item";
  const topDemandItemId =
    latestDemand?.itemResults?.[0]?.itemId ||
    board?.itemDemand?.[0]?.itemId ||
    5;

  const topChurnUser =
    latestChurn?.data?.[0]?.userId ??
    latestChurn?.data?.[0]?.user_id ??
    board?.churnAtRisk?.[0]?.userId ??
    873;
  const secondChurnUser =
    latestChurn?.data?.[1]?.userId ??
    latestChurn?.data?.[1]?.user_id ??
    board?.churnAtRisk?.[1]?.userId ??
    909;
  const topWinBackName =
    latestChurn?.data?.[0]?.winBackArticle?.name ||
    board?.churnAtRisk?.[0]?.winBackArticle?.name ||
    "a win-back product";

  const reverseItemId =
    latestReverseRec?.item?.itemId || latestReverseRec?.item?.id || topDemandItemId || 5;
  const reverseItemName =
    latestReverseRec?.item?.name ||
    latestReverseRec?.item?.itemName ||
    topDemandItem ||
    "item 5";
  const reverseTopUser =
    latestReverseRec?.data?.[0]?.userId ??
    latestReverseRec?.data?.[0]?.user_id ??
    topChurnUser;

  const affinityTopUser =
    latestAffinity?.data?.[0]?.userId ??
    latestAffinity?.data?.[0]?.user_id ??
    topChurnUser;
  const launchCategory =
    latestAffinity?.trace?.entityId ||
    latestAffinity?.content.match(/\"([^\"]+)\"/)?.[1] ||
    "activewear";

  const explainUser =
    latestExplain?.trace?.entityId ||
    latestExplain?.content.match(/user\s+(\d+)/i)?.[1] ||
    String(topChurnUser);

  switch (prompt.label) {
    case "Category demand forecast":
      return [
        `What's the predicted peak week for ${topCategory} in the next 30 days?`,
        `Predict which items in ${topCategory} will drive the most units sold`,
        `How does the predicted demand for ${topCategory} compare to ${secondCategory}?`,
        `Is ${topDemandItem} predicted to lead or trail its category average?`,
        "Predict the top 3 products by projected revenue over the next 30 days",
        `If ${topCategory} peaks early, which category is predicted to follow?`,
      ];
    case "Churn + win-back":
      return [
        "Which customers are predicted to churn before end of month?",
        `Predict the recovery probability for user ${topChurnUser} with a targeted offer`,
        `Why is user ${topChurnUser} predicted as our highest-risk customer right now?`,
        `If we offer ${topWinBackName} to user ${topChurnUser}, what's the predicted response?`,
        `Who among users ${topChurnUser} and ${secondChurnUser} has the higher predicted CLV?`,
        "Predict the revenue impact of reactivating the top 5 at-risk customers",
      ];
    case "Inventory clearance":
      return [
        `Predict the top 10 buyers most likely to purchase item ${reverseItemId} this month`,
        `Why is the top-ranked buyer predicted as the best fit for ${reverseItemName}?`,
        `What's the predicted conversion if we run a targeted campaign for ${reverseItemName}?`,
        `If item ${reverseItemId} is cleared, predict the next best item to target`,
        `Which 5 buyers are predicted to have the highest purchase intent for ${reverseItemName}?`,
        `Predict how many units of item ${reverseItemId} we can move with a targeted push`,
      ];
    case "New category launch":
      return [
        `Predict which customers have the highest affinity for ${launchCategory}`,
        `Why is user ${affinityTopUser} predicted as the strongest fit for ${launchCategory}?`,
        `Predict first-week engagement if we launch ${launchCategory} to the top 10 users`,
        `How large is the predicted high-affinity audience for ${launchCategory}?`,
        `Which users in this segment are predicted to become repeat ${launchCategory} buyers?`,
        `Predict how the ${launchCategory} audience changes if we expand to the next tier`,
      ];
    case "Competitive churn risk":
      return [
        "Who is predicted to switch to a competitor in the next 30 days?",
        `Predict the revenue at risk if we lose user ${topChurnUser} to a competitor`,
        `What's the predicted probability that user ${topChurnUser} switches brands this month?`,
        "Which customers are predicted to respond to a retention offer before they drift?",
        `Why is user ${secondChurnUser} also predicted as a competitive churn risk?`,
        "Predict how many customers from this group will churn without intervention",
      ];
    case "Explainability trace":
      return [
        `What signals are predicted to change user ${explainUser}'s risk score the most?`,
        `Walk me through the top 3 prediction signals for user ${explainUser}`,
        `If user ${explainUser} makes one more purchase, how does their predicted score change?`,
        `Which other users share user ${explainUser}'s predicted churn signal pattern?`,
        `What action is predicted to reduce user ${explainUser}'s churn risk the most?`,
        `How does user ${explainUser}'s predicted risk compare to a lower-risk peer?`,
      ];
    default:
      return prompt.followUps;
  }
}

/**
 * Find the latest analyst-related message (has trace, pql, or explain type)
 * Used to populate the analyst panel with relevant debugging info
 */
export function latestAnalystMessage(messages: Message[]): Message | undefined {
  return [...messages]
    .reverse()
    .find((msg) => msg.role === "assistant" && (msg.trace || msg.pql || msg.type === "explain"));
}

/**
 * Message ID counter for generating unique local message IDs
 */
let localMessageCounter = 0;

/**
 * Generate unique message ID for new messages
 * @example nextMessageId() // "local-1704456123456-1"
 */
export function nextMessageId(): string {
  localMessageCounter += 1;
  return `local-${Date.now()}-${localMessageCounter}`;
}

/**
 * Generate unique handoff ID for audience export tracking
 * @example nextHandoffId() // "handoff-1704456123456-a1b2c3"
 */
export function nextHandoffId(): string {
  return `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
