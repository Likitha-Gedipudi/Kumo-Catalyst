import type { ComponentType } from "react";
import {
  TrendingUp,
  AlertTriangle,
  ShoppingBag,
  Sparkles,
  Users,
  Search,
} from "lucide-react";

/** Copilot behavior, tone, and guardrails live in `stylist-system-prompt.ts`; this file is UI copy + starter menus only. */

// ── Starter prompts ─────────────────────────────────────────────────────────

export type StarterPrompt = {
  label: string;
  desc: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  menuIntro: string;
  followUps: string[];
};

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    label: "Category demand forecast",
    desc: "Predict which product categories will peak over the next 30–90 days using the KumoRFM graph.",
    icon: TrendingUp,
    menuIntro: "Demand forecast selected. Pick one of these demand-focused questions:",
    followUps: [
      "Which product categories are predicted to peak in the next 30 days?",
      "Which product categories are predicted to peak in the next 60 days?",
      "Show me the top 3 products with the highest projected sales in the next 30 days.",
      "Show me the top 5 products with the highest projected sales next week.",
      "What are the top 3 products with the highest projected sales over the next 90 days?",
      "Which category is predicted to lead revenue in the next 30 days?",
    ],
  },
  {
    label: "Churn + win-back",
    desc: "Identify customers most at risk of leaving and surface the best win-back strategy for each.",
    icon: AlertTriangle,
    menuIntro: "Churn + win-back selected. Choose one retention question:",
    followUps: [
      "Which customers are predicted to churn in the next 30 days?",
      "Predict the recovery probability for the top 5 at-risk customers",
      "Who is predicted to respond best to a win-back offer?",
      "Predict which customers will churn permanently without intervention",
      "Which at-risk customer has the highest predicted lifetime value?",
      "Why is user 873 predicted as a high churn risk?",
    ],
  },
  {
    label: "Inventory clearance",
    desc: "Find the buyers most likely to purchase a specific slow-moving item in the next 30 days.",
    icon: ShoppingBag,
    menuIntro: "Inventory clearance selected. Pick a targeting question for slow-moving inventory:",
    followUps: [
      "Which users are predicted to buy item 5 in the next 30 days?",
      "Predict the top 10 buyers most likely to purchase the Bug jumper sweater",
      "Which users are most likely to buy the Bug jumper sweater in the next 30 days?",
      "What is the predicted conversion if we run a targeted campaign for item 5?",
      "Predict which slow-moving item has the largest targetable audience right now",
      "Can we run the same reverse recommendation for item 57?",
    ],
  },
  {
    label: "New category launch",
    desc: "Discover high-affinity customers for a category before it launches, using adjacent purchase signals.",
    icon: Sparkles,
    menuIntro: "New category launch selected. Choose one audience-discovery question:",
    followUps: [
      "Predict which customers have the highest affinity for a new activewear launch",
      "Which users are predicted to purchase from a new sportswear category?",
      "How large is the predicted high-affinity audience for a new activewear line?",
      "Predict first-week engagement if we launch activewear to the top affinity segment",
      "Which users are predicted to become repeat buyers in a new category launch?",
      "What's the predicted conversion for the top 10 affinity users in a sportswear launch?",
    ],
  },
  {
    label: "Competitive churn risk",
    desc: "Detect customers showing drift signals toward competitors and prioritize proactive retention.",
    icon: Users,
    menuIntro: "Competitive churn risk selected. Choose one protection question:",
    followUps: [
      "Which customers are predicted to switch to a competitor this month?",
      "Predict the revenue at risk if we lose the top 5 competitive-drift customers",
      "Who has the highest predicted probability of switching to a competitor?",
      "Which customers are predicted to respond to a retention offer before they drift?",
      "Predict how long we have before user 909 is likely to churn to a competitor",
      "Why is user 909 predicted as a competitive churn risk?",
    ],
  },
  {
    label: "Explainability trace",
    desc: "Inspect why a specific customer was flagged — signals, peer comparisons, and recommended actions.",
    icon: Search,
    menuIntro: "Explainability trace selected. Pick one explanation question:",
    followUps: [
      "Why is user 873 predicted to churn? Walk me through the signals.",
      "Explain the top prediction signals for user 909.",
      "What are the 3 strongest signals driving user 250's predicted risk score?",
      "How does user 873's predicted risk compare to a lower-risk peer?",
      "If user 873 makes one more purchase, how does their predicted churn score change?",
      "Which other users share user 873's predicted churn signal pattern?",
    ],
  },
];

export const INPUT_QUICK_SUGGESTIONS = [
  "Which product categories are about to peak in the next 30 days?",
  "Show me customers who are about to churn.",
  "Item 5 has been sitting in inventory. Who should we target?",
  "We're launching an activewear line. Which customers should we reach?",
  "Show me the top 3 products with the highest projected sales in the next 30 days.",
];
