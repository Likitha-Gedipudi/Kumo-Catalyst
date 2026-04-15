// ── Search Utilities ────────────────────────────────────────────────────

export type SearchResultType = "customer" | "item" | "category" | "action";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  icon?: string;
  action: () => void;
};

/**
 * Simple fuzzy search implementation
 * Returns a score between 0-1 (higher is better match)
 */
export function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (t === q) return 1.0;

  // Starts with query
  if (t.startsWith(q)) return 0.9;

  // Contains query
  if (t.includes(q)) return 0.7;

  // Fuzzy character matching
  let queryIndex = 0;
  let targetIndex = 0;
  let matches = 0;

  while (queryIndex < q.length && targetIndex < t.length) {
    if (q[queryIndex] === t[targetIndex]) {
      matches++;
      queryIndex++;
    }
    targetIndex++;
  }

  if (queryIndex === q.length) {
    // All query characters found in order
    return 0.5 * (matches / q.length);
  }

  return 0;
}

/**
 * Filter and sort items by fuzzy search score
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
  minScore: number = 0.3
): T[] {
  if (!query.trim()) return items;

  const results = items
    .map((item) => ({
      item,
      score: fuzzyMatch(query, getSearchText(item)),
    }))
    .filter((result) => result.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return results.map((r) => r.item);
}

/**
 * Highlight matching characters in search results
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text;

  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const indices: number[] = [];

  let queryIndex = 0;
  for (let i = 0; i < t.length && queryIndex < q.length; i++) {
    if (t[i] === q[queryIndex]) {
      indices.push(i);
      queryIndex++;
    }
  }

  if (indices.length === 0) return text;

  let result = "";
  for (let i = 0; i < text.length; i++) {
    if (indices.includes(i)) {
      result += `<mark>${text[i]}</mark>`;
    } else {
      result += text[i];
    }
  }

  return result;
}

// ── Search History ────────────────────────────────────────────────────

const SEARCH_HISTORY_KEY = "kumo-search-history";
const MAX_SEARCH_HISTORY = 20;

export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as string[];
  } catch (error) {
    console.error("Failed to load search history:", error);
    return [];
  }
}

export function addToSearchHistory(query: string): void {
  if (!query.trim()) return;

  const history = getSearchHistory();

  // Remove duplicates
  const filtered = history.filter((q) => q.toLowerCase() !== query.toLowerCase());

  // Add to front
  filtered.unshift(query.trim());

  // Limit size
  const trimmed = filtered.slice(0, MAX_SEARCH_HISTORY);

  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
}

export function clearSearchHistory(): void {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}
