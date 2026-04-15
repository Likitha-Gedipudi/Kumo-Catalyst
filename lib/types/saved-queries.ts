// ── Saved Queries Types ──────────────────────────────────────────────────

export type SavedQuery = {
  id: string;
  label: string;
  query: string;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
};

export type QueryHistory = {
  id: string;
  query: string;
  timestamp: string;
};
