export type DecisionLens = {
  focus: string;
  title: string;
  summary: string;
  confidencePct: number;
  confidenceLabel: string;
  supportLabel: string;
  horizonLabel: string;
  evidence: string[];
  action: string;
  caution: string;
};

export type BoardAction = {
  label: string;
  kind: "chat" | "explain";
  question?: string;
  userId?: number;
};

export type EvalSnapshot = {
  coveragePct: number;
  traceCoveragePct: number;
  reviewCoveragePct: number;
  helpfulRatePct: number;
  liveServingPct: number;
  avgLatencyMs: number;
  observedCapabilities: string[];
  reviewedCount: number;
  fallbackCount: number;
  totalRuns: number;
  cacheReusePct: number;
  supportedCapabilityCount: number;
};
