/**
 * Builds an absolute same-origin URL for browser `fetch` calls.
 * Relative paths like `/api/chat` usually work, but using the page origin avoids
 * edge cases (unusual hosts, some dev proxies, or opened tabs on a different origin).
 */
export function sameOriginApiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${window.location.origin}${p}`;
}
