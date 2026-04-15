import { NextResponse } from "next/server";
import {
  fetchJobsList,
  fetchPredictiveQueriesList,
  isKumoRestConfigured,
} from "@/lib/kumo-rest/server-client";
import { enrichJobsWithConsoleLinks } from "@/lib/kumo-rest/job-links";
import { normalizeJobs } from "@/lib/kumo-rest/normalize-jobs";

export const dynamic = "force-dynamic";

/**
 * Aggregated Kumo Cloud discovery: jobs + predictive queries (when REST key is set).
 */
export async function GET() {
  const configured = isKumoRestConfigured();
  const kumoAppBaseUrl =
    process.env.KUMO_APP_BASE_URL?.replace(/\/+$/, "") || null;

  let jobsNormalized: ReturnType<typeof normalizeJobs> = [];
  let jobsSource: "rest" | "not_configured" | "rest_empty" = configured ? "rest_empty" : "not_configured";
  let pqRaw: unknown[] = [];
  let pqOk = false;

  if (configured) {
    try {
      const { raw, ok } = await fetchJobsList();
      if (ok && raw.length > 0) {
        jobsNormalized = enrichJobsWithConsoleLinks(normalizeJobs(raw));
        jobsSource = "rest";
      }
    } catch {
      /* leave empty */
    }

    try {
      const pq = await fetchPredictiveQueriesList();
      pqRaw = pq.raw;
      pqOk = pq.ok && pq.raw.length > 0;
    } catch {
      pqOk = false;
    }
  }

  return NextResponse.json({
    configured,
    kumoAppBaseUrl,
    jobs: jobsNormalized,
    jobsSource,
    predictiveQueries: pqRaw,
    predictiveQueriesLoaded: pqOk,
    message: configured
      ? "Kumo REST API key is set — jobs and predictive queries reflect your tenant when endpoints match."
      : "Add KUMO_REST_API_KEY to .env to connect Kumo Cloud REST.",
  });
}
