/**
 * Server-only Kumo REST API client.
 * Never import from client components — use Route Handlers under app/api/kumo/*.
 *
 * Auth: https://kumo.ai/docs/rest-api/ — header `X-API-Key: <customer_id:secret>`
 */

const DEFAULT_BASE = "https://api.kumo.ai";

function getBaseUrl(): string {
  return (
    process.env.KUMO_REST_BASE_URL?.replace(/\/+$/, "") ||
    process.env.KUMO_API_BASE_URL?.replace(/\/+$/, "") ||
    DEFAULT_BASE
  );
}

function getApiKey(): string | null {
  const key =
    process.env.KUMO_REST_API_KEY?.trim() ||
    process.env.KUMO_REST_X_API_KEY?.trim() ||
    "";
  return key.length > 0 ? key : null;
}

export function isKumoRestConfigured(): boolean {
  return getApiKey() != null;
}

export type KumoRestFetchOptions = RequestInit & {
  path: string;
};

/**
 * Low-level fetch to Kumo REST API (server-side only).
 */
export async function kumoRestFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const key = getApiKey();
  if (!key) {
    throw new Error("KUMO_REST_API_KEY is not configured");
  }
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": key,
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
}

/**
 * Attempt to list jobs — endpoint path may differ by tenant/API version.
 * Returns empty array on 404 or parse errors so the UI can show demo data.
 */
export async function fetchJobsList(): Promise<{ raw: unknown[]; ok: boolean }> {
  if (!isKumoRestConfigured()) {
    return { raw: [], ok: false };
  }
  const candidates = [
    "/v1/jobs",
    "/api/v1/jobs",
    "/v1/predictive-queries/jobs",
  ];
  for (const p of candidates) {
    try {
      const res = await kumoRestFetch(p, { method: "GET" });
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as { jobs?: unknown[] }).jobs)
          ? (data as { jobs: unknown[] }).jobs
          : Array.isArray((data as { data?: unknown[] }).data)
            ? (data as { data: unknown[] }).data
            : [];
      return { raw: list, ok: true };
    } catch {
      continue;
    }
  }
  return { raw: [], ok: false };
}

/**
 * Best-effort list of predictive queries — paths vary by API version; empty if unavailable.
 */
export async function fetchPredictiveQueriesList(): Promise<{
  raw: unknown[];
  ok: boolean;
}> {
  if (!isKumoRestConfigured()) {
    return { raw: [], ok: false };
  }
  const candidates = [
    "/v1/predictive-queries",
    "/api/v1/predictive-queries",
    "/v1/predictive_queries",
  ];
  for (const p of candidates) {
    try {
      const res = await kumoRestFetch(p, { method: "GET" });
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as { predictive_queries?: unknown[] }).predictive_queries)
          ? (data as { predictive_queries: unknown[] }).predictive_queries
          : Array.isArray((data as { data?: unknown[] }).data)
            ? (data as { data: unknown[] }).data
            : [];
      return { raw: list, ok: true };
    } catch {
      continue;
    }
  }
  return { raw: [], ok: false };
}

/**
 * Fetch a single job by id — tries common REST paths; returns null if not found.
 */
export async function fetchJobById(
  jobId: string
): Promise<{ raw: unknown | null; ok: boolean }> {
  if (!isKumoRestConfigured()) {
    return { raw: null, ok: false };
  }
  const encoded = encodeURIComponent(jobId);
  const candidates = [`/v1/jobs/${encoded}`, `/api/v1/jobs/${encoded}`, `/v1/jobs/${jobId}`];
  for (const p of candidates) {
    try {
      const res = await kumoRestFetch(p, { method: "GET" });
      if (!res.ok) continue;
      const data: unknown = await res.json();
      return { raw: data, ok: true };
    } catch {
      continue;
    }
  }
  return { raw: null, ok: false };
}
