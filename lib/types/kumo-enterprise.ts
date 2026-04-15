/** Kumo REST API job (normalized for UI; exact shape may vary by API version). */
export type KumoRestJob = {
  id: string;
  name?: string;
  type: "batch_prediction" | "retrain" | "unknown";
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  createdAt?: string;
  updatedAt?: string;
  predictiveQueryId?: string;
  errorMessage?: string;
  metricsSummary?: string;
  /** Deep link when `KUMO_APP_BASE_URL` is set (pattern may vary by tenant). */
  consoleUrl?: string | null;
};
