import {
  fetchJobsList,
  fetchPredictiveQueriesList,
  isKumoRestConfigured,
} from "@/lib/kumo-rest/server-client";

let cache: { at: number; text: string } | null = null;
const TTL_MS = 60_000;

/**
 * Short, bounded text appended to Gemini system prompts when REST is configured.
 * Cached ~60s to avoid hammering Kumo Cloud on every chat turn.
 */
export async function getRestContextSnippetForPrompt(): Promise<string> {
  if (!isKumoRestConfigured()) {
    return "";
  }
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return cache.text;
  }

  const [jobs, pqs] = await Promise.all([
    fetchJobsList(),
    fetchPredictiveQueriesList(),
  ]);

  const parts: string[] = [];
  if (jobs.ok && jobs.raw.length > 0) {
    parts.push(`${jobs.raw.length} job record(s) visible via Kumo REST for this deployment.`);
  }
  if (pqs.ok && pqs.raw.length > 0) {
    parts.push(`${pqs.raw.length} predictive quer(ies) listed via REST.`);
  }

  const text =
    parts.length > 0
      ? `\n\n## Kumo Cloud snapshot (server-injected, do not fabricate IDs)\n${parts.join(" ")}\nWhen the user asks about jobs or batches, describe that operations are in Kumo Cloud (REST), not the sidecar trace, unless trace explicitly includes them.`
      : "";

  cache = { at: now, text };
  return text;
}
