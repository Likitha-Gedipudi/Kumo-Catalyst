import { NextResponse } from "next/server";
import { fetchJobsList, isKumoRestConfigured } from "@/lib/kumo-rest/server-client";
import { normalizeJobs } from "@/lib/kumo-rest/normalize-jobs";

export const dynamic = "force-dynamic";

/**
 * GET /api/kumo/jobs — server-only list of Kumo REST jobs.
 * Returns an empty array with a clear message when REST key is not configured.
 */
export async function GET() {
  const configured = isKumoRestConfigured();

  if (!configured) {
    return NextResponse.json({
      configured: false,
      source: "not_configured",
      jobs: [],
      message: "Add KUMO_REST_API_KEY to .env to connect Kumo Cloud REST.",
    });
  }

  try {
    const { raw, ok } = await fetchJobsList();
    if (ok && raw.length > 0) {
      return NextResponse.json({
        configured: true,
        source: "rest",
        jobs: normalizeJobs(raw),
      });
    }
  } catch {
    /* fall through to empty */
  }

  return NextResponse.json({
    configured: true,
    source: "rest_empty",
    jobs: [],
    message: "No jobs returned from API (check predictive queries exist in Kumo).",
  });
}
