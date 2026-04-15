import type {
  CustomerRisk,
  HandoffDestination,
  HandoffRecord,
  Message,
} from "@/lib/types";
import { nextHandoffId } from "@/lib/utils/message-helpers";

export function buildRetentionAction(customer: CustomerRisk) {
  const uid = customer.userId;
  const days = customer.daysSinceLastPurchase ?? 0;

  if (days >= 540) {
    return {
      label: "Reactivation Plan",
      prompt: `Create a reactivation plan for user ${uid} with a 20% discount and a win-back product recommendation.`,
    };
  }

  if (days >= 180) {
    return {
      label: "SMS Win-back",
      prompt: `Draft an SMS win-back outreach for user ${uid} using likely next-best products.`,
    };
  }

  return {
    label: "Targeted Offer",
    prompt: `What personalized offer should we send user ${uid} to reduce churn risk?`,
  };
}

export function buildHandoffRecord(
  message: Message,
  destination: HandoffDestination
): HandoffRecord | null {
  if (!message.type || message.type === "text" || message.type === "explain") return null;

  if (message.type === "churn_list" || message.type === "competitive_churn") {
    const rows = Array.isArray(message.data) ? message.data.slice(0, 4) : [];
    return {
      id: nextHandoffId(),
      createdAt: new Date().toISOString(),
      sourceCapability: message.type,
      destination,
      audienceLabel: "High-risk retention cohort",
      audienceSize: rows.length,
      status: "queued",
      entityIds: rows
        .map((row: { userId?: number; user_id?: number }) => row.userId ?? row.user_id)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
        .map(String),
    };
  }

  if (message.type === "reverse_rec") {
    const rows = Array.isArray(message.data) ? message.data.slice(0, 6) : [];
    const itemName = message.item?.name || "Target item";
    return {
      id: nextHandoffId(),
      createdAt: new Date().toISOString(),
      sourceCapability: message.type,
      destination,
      audienceLabel: `${itemName} outreach audience`,
      audienceSize: rows.length,
      status: "queued",
      entityIds: rows
        .map((row: { userId?: number; user_id?: number }) => row.userId ?? row.user_id)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
        .map(String),
    };
  }

  if (message.type === "cold_affinity") {
    const rows = Array.isArray(message.data) ? message.data.slice(0, 10) : [];
    return {
      id: nextHandoffId(),
      createdAt: new Date().toISOString(),
      sourceCapability: message.type,
      destination,
      audienceLabel: "New-category launch segment",
      audienceSize: rows.length,
      status: "queued",
      entityIds: rows
        .map((row: { userId?: number; user_id?: number }) => row.userId ?? row.user_id)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
        .map(String),
    };
  }

  if (message.type === "demand_forecast") {
    const items = Array.isArray(message.itemResults) ? message.itemResults.slice(0, 5) : [];
    return {
      id: nextHandoffId(),
      createdAt: new Date().toISOString(),
      sourceCapability: message.type,
      destination,
      audienceLabel: "Priority replenishment watchlist",
      audienceSize: items.length,
      status: "queued",
      entityIds: items
        .map((row: { itemId?: number; item_id?: number }) => row.itemId ?? row.item_id)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
        .map(String),
    };
  }

  return null;
}

export function handoffSummary(handoff: HandoffRecord) {
  return `${handoff.audienceLabel} queued to ${handoff.destination} (${handoff.audienceSize} records).`;
}

export function buildAnalystNotes(message?: Message) {
  if (!message?.type) {
    return [
      "Run a demand, churn, inventory, launch, or explainability query to inspect its relational workflow artifacts here.",
      "This panel is designed for analyst validation: schema, joins, serving mode, trace steps, and generated PQL.",
    ];
  }

  switch (message.type) {
    case "demand_forecast":
      return [
        "This workflow predicts future revenue from the `orders.price` measure over a bounded time window and then ranks categories/items by projected demand.",
        "Analytically, this behaves like a forward-looking aggregation over the orders fact table, grouped through item/category relationships.",
      ];
    case "churn_list":
    case "competitive_churn":
      return [
        "This workflow scores customer inactivity risk from historical order behavior and then ranks the users with the strongest churn signals.",
        "The important validation points are recency, order count, and whether the serving path returned a live score instead of fallback guidance.",
      ];
    case "reverse_rec":
      return [
        "This workflow inverts recommendation: instead of ranking items for a user, it ranks users for an item using the same relational purchase graph.",
        "Analysts should validate the item entity, ranking count, and whether the highest-ranked users align with expected near-term purchase intent.",
      ];
    case "cold_affinity":
      return [
        "This workflow identifies likely adopters for a category even without direct purchase history by leaning on adjacent relational behavior.",
        "Validation should focus on category resolution, audience size, and whether the surfaced users form a plausible launch segment.",
      ];
    case "explain":
      return [
        "This workflow does not generate a new prediction; it decomposes an existing prediction into top signals, peers, and local graph context.",
        "Use it to validate trust, not just accuracy: are the top signals legible, stable, and useful for action design?",
      ];
    default:
      return [
        "This response does not yet have a specialized analyst interpretation.",
      ];
  }
}
