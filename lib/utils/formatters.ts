// ── Utility functions for formatting data ─────────────────────────────────

import type { Message, AgentRunTrace } from "@/lib/types";

/**
 * Format large numbers in compact notation (K, M)
 * @example formatCompactNumber(1500) // "2K"
 * @example formatCompactNumber(2500000) // "2.5M"
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(Math.round(value));
}

/** Board stat line: avoid "0K" for hundreds; only compact at 1K+. */
export function formatStatThousands(n: number | undefined | null): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return String(Math.round(v));
}

/**
 * Format number as USD currency
 * @example formatCurrency(1234.56) // "$1,235"
 */
export function formatCurrency(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Summarize churn signal into human-readable label
 * @example summarizeSignal("lost customer signal") // "Lost customer"
 */
export function summarizeSignal(signal?: string): string {
  const normalized = (signal || "").toLowerCase();
  if (normalized.includes("lost customer")) {
    return "Lost customer";
  }
  if (normalized.includes("no purchases") || normalized.includes("last purchase")) {
    return "Recency deterioration";
  }
  if (normalized.includes("frequency")) {
    return "Frequency decline";
  }
  if (normalized.includes("low engagement")) {
    return "Low engagement";
  }
  if (normalized.includes("lower price") || normalized.includes("order value")) {
    return "Basket value pressure";
  }
  if (normalized.includes("inactive")) {
    return "Inactive account";
  }
  return "Behavior shift";
}

/**
 * Format capability type into human-readable label
 * @example formatCapabilityLabel("demand_forecast") // "demand forecast"
 * @example formatCapabilityLabel("graph_schema") // "graph schema lookup"
 */
export function formatCapabilityLabel(
  capability?: Message["type"] | AgentRunTrace["capability"]
): string {
  if (!capability) return "guided response";
  if (capability === "graph_schema") return "graph schema lookup";
  return capability.replaceAll("_", " ");
}

/**
 * Get confidence label based on percentage
 * @example getConfidenceLabel(85) // "High confidence"
 * @example getConfidenceLabel(60) // "Moderate confidence"
 */
export function getConfidenceLabel(confidencePct: number): string {
  if (confidencePct >= 75) return "High confidence";
  if (confidencePct >= 50) return "Moderate confidence";
  return "Exploratory signal";
}

/**
 * Clamp percentage value between 0 and 100
 * @example clampPercent(120) // 100
 * @example clampPercent(-5) // 0
 */
export function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

/**
 * Format UTC timestamp into readable format
 * @example formatUtcTimestamp("2024-01-15T10:30:00Z") // "2024-01-15 10:30 UTC"
 */
export function formatUtcTimestamp(timestamp?: string | null): string {
  if (!timestamp) return "Not available";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Not available";
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

/**
 * Format uptime seconds into human-readable format
 * @example formatUptime(45) // "45s uptime"
 * @example formatUptime(150) // "2m uptime"
 * @example formatUptime(7200) // "2h uptime"
 */
export function formatUptime(uptimeSec?: number): string {
  if (!uptimeSec || uptimeSec < 60) return `${Math.max(uptimeSec ?? 0, 0)}s uptime`;
  if (uptimeSec < 3600) return `${Math.floor(uptimeSec / 60)}m uptime`;
  return `${Math.floor(uptimeSec / 3600)}h uptime`;
}

/**
 * Get human-readable health mode reason
 * @example healthModeReason("cache_warming") // "Cache warm-up in progress"
 */
export function healthModeReason(modeReason?: string | null): string {
  switch (modeReason) {
    case "cache_warming":
      return "Cache warm-up in progress";
    case "link_health_mismatch":
      return "Detected link/schema integrity mismatch";
    case "graph_not_ready":
      return "Graph has not finished initialization";
    case "graph_error":
      return "Graph build error";
    default:
      return "Unknown";
  }
}
