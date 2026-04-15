import type {
  AnalyticsRun,
  FeedbackRecord,
  Message,
  MessageFeedback,
  SidecarHealth,
} from "@/lib/types";
import type { EvalSnapshot } from "@/lib/types/stylist-board";

export function buildEvalSnapshot(
  messages: Message[],
  analyticsRuns: AnalyticsRun[],
  feedbackLog: FeedbackRecord[],
  sidecarHealth: SidecarHealth | null
): EvalSnapshot {
  const supportedCapabilities = [
    "demand_forecast",
    "churn_list",
    "competitive_churn",
    "reverse_rec",
    "cold_affinity",
    "explain",
    "graph_schema",
  ] as const;

  const evaluatedMessages = messages.filter(
    (msg) => msg.role === "assistant" && msg.type && msg.type !== "text"
  );
  const sessionRunIds = new Set(evaluatedMessages.map((msg) => msg.id));
  const mergedRuns = [
    ...analyticsRuns.filter((run) => !sessionRunIds.has(run.messageId)),
    ...evaluatedMessages.map((msg) => ({
      messageId: msg.id,
      capability: msg.trace?.capability ?? msg.type ?? "text",
      createdAt: new Date().toISOString(),
      hasTrace: Boolean(msg.trace),
      servingMode: msg.trace?.servingMode,
      latencyMs:
        msg.trace?.steps
          ?.map((step) => step.latencyMs)
          .filter((latency): latency is number => typeof latency === "number" && Number.isFinite(latency))
          .reduce((sum, value, _, arr) => sum + value / arr.length, 0) ?? null,
      resultCount: msg.trace?.resultCount ?? null,
    })),
  ];
  const mergedFeedback = [
    ...feedbackLog.filter((entry) => !sessionRunIds.has(entry.messageId)),
    ...evaluatedMessages
      .filter((msg) => msg.feedback)
      .map((msg) => ({
        messageId: msg.id,
        capability: msg.trace?.capability ?? msg.type ?? "text",
        feedback: msg.feedback as Exclude<MessageFeedback, null>,
        createdAt: new Date().toISOString(),
        servingMode: msg.trace?.servingMode,
      })),
  ];
  const tracedRuns = mergedRuns.filter((run) => run.hasTrace);
  const positiveReviews = mergedFeedback.filter((entry) => entry.feedback === "positive");
  const liveTraces = tracedRuns.filter((run) => run.servingMode === "live");
  const fallbackCount = tracedRuns.filter((run) => run.servingMode === "fallback").length;
  const latencySamples = tracedRuns
    .map((run) => run.latencyMs)
    .filter((latency): latency is number => typeof latency === "number" && Number.isFinite(latency));
  const observedCapabilities = Array.from(
    new Set(
      tracedRuns
        .map((run) => run.capability)
        .filter(
          (
            capability
          ): capability is NonNullable<Message["trace"]>["capability"] =>
            capability != null && capability !== "text"
        )
    )
  );
  const totalRuns = mergedRuns.length;
  const cacheReusePct =
    sidecarHealth && sidecarHealth.totalPredictionRequests > 0
      ? Math.round(
          (sidecarHealth.cachedPredictionRequests /
            sidecarHealth.totalPredictionRequests) *
            100
        )
      : 0;

  return {
    coveragePct: Math.round(
      (observedCapabilities.filter((capability) =>
        supportedCapabilities.includes(
          capability as (typeof supportedCapabilities)[number]
        )
      ).length /
        supportedCapabilities.length) *
        100
    ),
    traceCoveragePct:
      totalRuns > 0 ? Math.round((tracedRuns.length / totalRuns) * 100) : 0,
    reviewCoveragePct:
      totalRuns > 0
        ? Math.round((mergedFeedback.length / totalRuns) * 100)
        : 0,
    helpfulRatePct:
      mergedFeedback.length > 0
        ? Math.round((positiveReviews.length / mergedFeedback.length) * 100)
        : 0,
    liveServingPct:
      tracedRuns.length > 0
        ? Math.round((liveTraces.length / tracedRuns.length) * 100)
        : 0,
    avgLatencyMs:
      latencySamples.length > 0
        ? Math.round(
            latencySamples.reduce((sum, value) => sum + value, 0) /
              latencySamples.length
          )
        : 0,
    observedCapabilities,
    reviewedCount: mergedFeedback.length,
    fallbackCount,
    totalRuns,
    cacheReusePct,
    supportedCapabilityCount: supportedCapabilities.length,
  };
}
