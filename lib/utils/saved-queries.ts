// ── Saved Queries Utilities ──────────────────────────────────────────────

import type { SavedQuery, QueryHistory } from "@/lib/types/saved-queries";

const SAVED_QUERIES_KEY = "kumo-saved-queries";
const QUERY_HISTORY_KEY = "kumo-query-history";
const MAX_HISTORY_SIZE = 50;

// ── Saved Queries ─────────────────────────────────────────────────────────

/**
 * Get all saved queries from localStorage
 */
export function getSavedQueries(): SavedQuery[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SAVED_QUERIES_KEY);
    if (!stored) return [];

    const queries = JSON.parse(stored) as SavedQuery[];
    // Sort by lastUsed (most recent first), then by createdAt
    return queries.sort((a, b) => {
      const aTime = a.lastUsed || a.createdAt;
      const bTime = b.lastUsed || b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  } catch (error) {
    console.error("Failed to load saved queries:", error);
    return [];
  }
}

/**
 * Save a query to bookmarks
 */
export function saveQuery(query: string, label?: string): SavedQuery {
  const queries = getSavedQueries();

  // Check if query already exists
  const existing = queries.find((q) => q.query.toLowerCase() === query.toLowerCase());
  if (existing) {
    // Update existing query
    existing.lastUsed = new Date().toISOString();
    existing.useCount += 1;
    if (label) existing.label = label;

    localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(queries));
    return existing;
  }

  // Create new saved query
  const newQuery: SavedQuery = {
    id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: label || generateQueryLabel(query),
    query,
    createdAt: new Date().toISOString(),
    useCount: 1,
  };

  queries.push(newQuery);
  localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(queries));

  return newQuery;
}

/**
 * Update a saved query label
 */
export function updateQueryLabel(id: string, newLabel: string): void {
  const queries = getSavedQueries();
  const query = queries.find((q) => q.id === id);

  if (query) {
    query.label = newLabel;
    localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(queries));
  }
}

/**
 * Delete a saved query
 */
export function deleteSavedQuery(id: string): void {
  const queries = getSavedQueries();
  const filtered = queries.filter((q) => q.id !== id);
  localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(filtered));
}

/**
 * Mark a saved query as used
 */
export function markQueryUsed(id: string): void {
  const queries = getSavedQueries();
  const query = queries.find((q) => q.id === id);

  if (query) {
    query.lastUsed = new Date().toISOString();
    query.useCount += 1;
    localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(queries));
  }
}

/**
 * Generate a smart label from query text
 */
function generateQueryLabel(query: string): string {
  // Truncate long queries
  if (query.length > 50) {
    return query.slice(0, 47) + "...";
  }
  return query;
}

// ── Query History ─────────────────────────────────────────────────────────

/**
 * Get query history from localStorage
 */
export function getQueryHistory(): QueryHistory[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(QUERY_HISTORY_KEY);
    if (!stored) return [];

    return JSON.parse(stored) as QueryHistory[];
  } catch (error) {
    console.error("Failed to load query history:", error);
    return [];
  }
}

/**
 * Add query to history
 */
export function addToHistory(query: string): void {
  const history = getQueryHistory();

  // Don't add duplicates of the most recent query
  if (history.length > 0 && history[0].query === query) {
    return;
  }

  const newEntry: QueryHistory = {
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query,
    timestamp: new Date().toISOString(),
  };

  // Add to front of array
  history.unshift(newEntry);

  // Limit history size
  const trimmed = history.slice(0, MAX_HISTORY_SIZE);

  localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(trimmed));
}

/**
 * Clear all query history
 */
export function clearHistory(): void {
  localStorage.removeItem(QUERY_HISTORY_KEY);
}

/**
 * Get recent queries (last 10)
 */
export function getRecentQueries(limit: number = 10): QueryHistory[] {
  return getQueryHistory().slice(0, limit);
}
