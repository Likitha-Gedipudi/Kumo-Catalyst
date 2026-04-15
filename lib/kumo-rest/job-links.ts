import type { KumoRestJob } from "@/lib/types/kumo-enterprise";

/** Public Kumo app / console base URL (optional). */
export function getKumoAppBaseUrl(): string | null {
  return process.env.KUMO_APP_BASE_URL?.replace(/\/+$/, "") || null;
}

/**
 * Best-effort deep link for a job in the Kumo web app. Path pattern may differ by tenant;
 * override env if your console uses a different route shape.
 */
export function buildJobConsoleUrl(jobId: string): string | null {
  const base = getKumoAppBaseUrl();
  if (!base) return null;
  return `${base}/jobs/${encodeURIComponent(jobId)}`;
}

/** Attach `consoleUrl` to each job when `KUMO_APP_BASE_URL` is set. */
export function enrichJobsWithConsoleLinks(jobs: KumoRestJob[]): KumoRestJob[] {
  return jobs.map((j) => ({
    ...j,
    consoleUrl: buildJobConsoleUrl(j.id),
  }));
}
