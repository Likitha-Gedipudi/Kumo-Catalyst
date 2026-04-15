import { NextResponse } from "next/server";
import { fetchJobById, isKumoRestConfigured } from "@/lib/kumo-rest/server-client";
import { enrichJobsWithConsoleLinks } from "@/lib/kumo-rest/job-links";
import { normalizeJobs } from "@/lib/kumo-rest/normalize-jobs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * GET /api/kumo/jobs/[jobId] — single job from Kumo REST (server-only).
 */
export async function GET(_req: Request, context: RouteContext) {
  const { jobId } = await context.params;
  if (!jobId?.trim()) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  if (!isKumoRestConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        job: null,
        message: "Set KUMO_REST_API_KEY to load jobs from Kumo Cloud.",
      },
      { status: 200 }
    );
  }

  const { raw, ok } = await fetchJobById(decodeURIComponent(jobId));
  if (!ok || raw == null || (typeof raw === "object" && raw !== null && !Array.isArray(raw) && Object.keys(raw as object).length === 0)) {
    return NextResponse.json(
      {
        configured: true,
        job: null,
        message: "Job not found or endpoint not available for this API version.",
      },
      { status: 404 }
    );
  }

  const list = Array.isArray(raw) ? raw : [raw];
  const normalized = enrichJobsWithConsoleLinks(normalizeJobs(list));
  const job = normalized[0] ?? null;

  return NextResponse.json({
    configured: true,
    job,
    raw,
  });
}
