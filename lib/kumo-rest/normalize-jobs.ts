import type { KumoRestJob } from "@/lib/types/kumo-enterprise";

/** Map arbitrary REST payloads into KumoRestJob for the timeline UI. */
export function normalizeJobs(raw: unknown[]): KumoRestJob[] {
  return raw.map((item, i) => {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const id = String(o.id ?? o.job_id ?? o.uuid ?? `job-${i}`);
      const statusRaw = String(o.status ?? o.state ?? "unknown").toLowerCase();
      let status: KumoRestJob["status"] = "queued";
      if (statusRaw.includes("queue") || statusRaw === "pending") status = "queued";
      else if (statusRaw.includes("run") || statusRaw === "in_progress") status = "running";
      else if (statusRaw.includes("success") || statusRaw === "completed" || statusRaw === "done")
        status = "succeeded";
      else if (statusRaw.includes("fail") || statusRaw === "error") status = "failed";
      else if (statusRaw.includes("cancel")) status = "cancelled";
      else status = "queued";

      const typeRaw = String(o.type ?? o.job_type ?? "").toLowerCase();
      let type: KumoRestJob["type"] = "unknown";
      if (typeRaw.includes("batch") || typeRaw.includes("predict")) type = "batch_prediction";
      else if (typeRaw.includes("retrain") || typeRaw.includes("train")) type = "retrain";

      return {
        id,
        name: typeof o.name === "string" ? o.name : typeof o.title === "string" ? o.title : undefined,
        type,
        status,
        createdAt: typeof o.created_at === "string" ? o.created_at : typeof o.createdAt === "string" ? o.createdAt : undefined,
        updatedAt: typeof o.updated_at === "string" ? o.updated_at : typeof o.updatedAt === "string" ? o.updatedAt : undefined,
        predictiveQueryId:
          typeof o.predictive_query_id === "string"
            ? o.predictive_query_id
            : typeof o.query_id === "string"
              ? o.query_id
              : undefined,
        errorMessage: typeof o.error === "string" ? o.error : typeof o.message === "string" ? o.message : undefined,
      };
    }
    return {
      id: `job-${i}`,
      type: "unknown",
      status: "queued",
    };
  });
}

export function demoMockJobs(): KumoRestJob[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-batch-1",
      name: "Nightly category demand batch",
      type: "batch_prediction",
      status: "succeeded",
      createdAt: now,
      metricsSummary: "Completed — evaluation metrics available in Kumo UI",
    },
    {
      id: "demo-retrain-1",
      name: "Weekly graph retrain",
      type: "retrain",
      status: "running",
      createdAt: now,
    },
  ];
}
