// Kumo Catalyst — Type Definitions
// Aligned to real H&M dataset: users/items/orders

export type CategoryDemand = {
  category: string;
  demandScore: number;
  trend: "rising" | "stable" | "falling";
};

export type ItemDemand = {
  itemId: number;
  itemName: string;
  category: string;
  color: string;
  demandScore: number;
};

export type WinBackArticle = {
  itemId: number;
  name: string;
  category: string;
  purchaseProbability: number;
  imageUrl?: string;
};

export type CustomerRisk = {
  userId: number;
  name: string;
  age: number;
  active: boolean;
  churnProbability: number;
  totalSpend: number;
  orderCount: number;
  daysSinceLastPurchase: number;
  topSignal: string;
  winBackArticle?: WinBackArticle;
  winBackAll?: WinBackArticle[];
};

export type Signal = {
  column: string;
  importance: number;
  value: string;
  label: string;
};

export type SubgraphNode = {
  id: string;
  label: string;
  type: "customer" | "transaction_recent" | "transaction_old" | "article" | "peer";
};

export type SubgraphLink = {
  source: string;
  target: string;
};

// ── Subgraph Table (nested layout like Kumo platform) ─────────────────────
export type SubgraphColumn = {
  column: string;
  value: string;
  score: number;
};

export type LinkedItem = {
  itemName: string;
  category: string;
  itemId?: number;
};

export type SubgraphTableRow = {
  totalScore: number;
  columns: SubgraphColumn[];
  links?: string[];
  linkedItem?: LinkedItem;
};

export type SubgraphTableData = {
  entityItem: {
    id: string;
    totalScore: number;
    columns: SubgraphColumn[];
    links: string[];
  };
  connectedTables: Record<string, SubgraphTableRow[]>;
};

// ── Prediction Analysis (3-pane) ──────────────────────────────────────────
export type PredictionItem = {
  itemId: number;
  itemName: string;
  category: string;
  imageUrl: string;
  highlighted?: boolean; // true if correctly predicted
};

export type PredictionAnalysis = {
  historicalItems: PredictionItem[];
  groundTruth: PredictionItem[];
  predictions: PredictionItem[];
};

// ── Global Explainability ─────────────────────────────────────────────────
export type GlobalColumnContrib = {
  table: string;
  column: string;
  hops: number;
  type: string; // "Numerical" | "Categorical" | "Boolean" | "Datetime"
  variationPct: number;
};

// ── Peer Comparison ───────────────────────────────────────────────────────
export type PeerComparison = {
  churnedPct: number;
  retainedPct: number;
  thisCustomerPercentile: number;
  totalPeers: number;
  description: string;
};

// ── Full Explain Result ───────────────────────────────────────────────────
export type ExplainResult = {
  entityId: string;
  entityType: "customer" | "article";
  prediction?: string;
  /** The PQL query that was run with explain=True to generate this result */
  pql?: string;
  /** Whether attribution came from the real Kumo GNN model or heuristic fallback */
  source?: "kumo" | "heuristic";
  /** Counterfactual / sensitivity labelling when filters are applied (MVP). */
  sensitivityNote?: string;
  appliedFilters?: { excludeLastDays?: number; channelId?: number };
  signalBreakdown: Signal[];
  subgraph: SubgraphNode[];
  subgraphLinks: SubgraphLink[];
  peerComparison: PeerComparison;
  // New rich explainability
  subgraphTable?: SubgraphTableData;
  predictionAnalysis?: PredictionAnalysis;
  globalExplainability?: GlobalColumnContrib[];
};

// ── Intelligence Board ────────────────────────────────────────────────────
export type IntelligenceBoardStats = {
  totalUsers: number;
  totalItems: number;
  totalOrders: number;
  churnRiskCount: number;
  mode: "live" | "mock" | "degraded" | "error";
};

export type IntelligenceBoard = {
  categoryDemand: CategoryDemand[];
  itemDemand: ItemDemand[];
  churnAtRisk: CustomerRisk[];
  stats: IntelligenceBoardStats;
  timeframeDays?: number;
};

export type SidecarHealth = {
  linkHealth: Array<{
    name: string;
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    totalRows: number;
    matchedRows: number;
    unmatchedRows: number;
    matchedPct: number;
  }>;
  status: "ok" | "degraded" | "error";
  mode: "live" | "mock" | "degraded" | "error";
  modeReason?: string | null;
  graphLoaded: boolean;
  loadError?: string | null;
  dataset: string;
  startedAt?: string | null;
  graphBuildStartedAt?: string | null;
  graphBuiltAt?: string | null;
  cacheWarmedAt?: string | null;
  uptimeSec: number;
  cacheKeys: string[];
  cacheReadyKeys: number;
  cacheExpectedKeys: number;
  cacheCoveragePct: number;
  warnings: string[];
  lastPredictionAt?: string | null;
  lastPredictionCapability?: string | null;
  totalPredictionRequests: number;
  cachedPredictionRequests: number;
  stats: {
    users: number;
    items: number;
    orders: number;
  };
};

// ── Messages ──────────────────────────────────────────────────────────────
export type MessageType =
  | "text"
  | "demand_forecast"
  | "churn_list"
  | "competitive_churn"
  | "reverse_rec"
  | "cold_affinity"
  | "explain";

export type TraceStepStatus = "ok" | "warning" | "error";

export type AgentTraceStep = {
  id: string;
  label: string;
  detail: string;
  latencyMs?: number | null;
  status: TraceStepStatus;
};

export type AgentRunTrace = {
  capability: MessageType | "graph_schema";
  entityId?: string | null;
  resultCount?: number | null;
  sidecarEndpoint?: string | null;
  servingMode?: "live" | "fallback";
  warnings?: string[];
  steps: AgentTraceStep[];
};

export type MessageFeedback = "positive" | "negative" | null;

export type FeedbackRecord = {
  messageId: string;
  capability: MessageType | "graph_schema" | "text";
  feedback: Exclude<MessageFeedback, null>;
  createdAt: string;
  servingMode?: "live" | "fallback";
};

export type AnalyticsRun = {
  messageId: string;
  capability: MessageType | "graph_schema" | "text";
  createdAt: string;
  hasTrace: boolean;
  servingMode?: "live" | "fallback";
  latencyMs?: number | null;
  resultCount?: number | null;
};

export type HandoffDestination =
  | "CRM audience"
  | "Email campaign"
  | "SMS platform"
  | "Launch segment";

export type HandoffRecord = {
  id: string;
  createdAt: string;
  sourceCapability: MessageType | "graph_schema" | "text";
  destination: HandoffDestination;
  audienceLabel: string;
  audienceSize: number;
  status: "queued" | "exported";
  entityIds: string[];
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: MessageType;
  data?: any;
  item?: any;
  itemResults?: any[];
  resultLimit?: number;
  pql?: string;
  followUps?: string[];
  trace?: AgentRunTrace;
  feedback?: MessageFeedback;
};

/** One chat thread; messages live per session */
export type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};

export type RightPanelView = "board" | "explain";

/** Highlights a section on the intelligence board when drilling down from chat */
export type BoardFocus =
  | null
  | { kind: "demand"; category?: string }
  | { kind: "churn" };
