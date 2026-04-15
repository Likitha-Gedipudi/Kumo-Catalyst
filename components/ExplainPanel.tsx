"use client";

import { useState } from "react";
import {
  X,
  BarChart3,
  Users,
  Network,
  Layers,
  Search,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExplainResult, PredictionItem, SubgraphTableRow, SubgraphColumn } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ══════════════════════════════════════════════════════════════════════════
// SIGNALS TAB
// ══════════════════════════════════════════════════════════════════════════

function SignalsTab({ data }: { data: ExplainResult }) {
  return (
    <div className="signal-list">
      {data.signalBreakdown?.map((s, i) => (
        <div key={i} className="signal-row">
          <div className="signal-header">
            <span className="signal-label">{s.label}</span>
            <span className="signal-importance">
              {Math.round(s.importance * 100)}%
            </span>
          </div>
          <div className="signal-bar-track">
            <div
              className="signal-bar-fill"
              style={{ width: `${Math.max(s.importance * 100, 2)}%` }}
            />
          </div>
          <p className="signal-value">Value: {s.value}</p>
        </div>
      ))}

      {/* Peer comparison inline */}
      {data.peerComparison && (
        <div className="peer-panel" style={{ marginTop: 8 }}>
          <p className="peer-desc">{data.peerComparison.description}</p>
          <div className="peer-stats">
            <div className="peer-stat">
              <span className="peer-stat-value peer-churned">
                {data.peerComparison.churnedPct}%
              </span>
              <span className="peer-stat-label">Churned</span>
            </div>
            <div className="peer-stat">
              <span className="peer-stat-value peer-retained">
                {data.peerComparison.retainedPct}%
              </span>
              <span className="peer-stat-label">Retained</span>
            </div>
            <div className="peer-stat">
              <span className="peer-stat-value">
                {data.peerComparison.totalPeers}
              </span>
              <span className="peer-stat-label">Total Peers</span>
            </div>
          </div>
          <div className="peer-bar-track">
            <div
              className="peer-bar-fill"
              style={{
                width: `${data.peerComparison.thisCustomerPercentile}%`,
              }}
            />
            <div
              className="peer-bar-marker"
              style={{
                left: `${data.peerComparison.thisCustomerPercentile}%`,
              }}
            />
          </div>
          <div className="peer-bar-labels">
            <span>Low Risk</span>
            <span>High Risk</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SUBGRAPH TAB (Nested table layout like Kumo platform)
// ══════════════════════════════════════════════════════════════════════════

function SubgraphTab({ data }: { data: ExplainResult }) {
  const table = data.subgraphTable;
  const [expandedTxn, setExpandedTxn] = useState<number | null>(null);

  if (!table) {
    return <p className="xai-empty">Subgraph data not available.</p>;
  }

  const scoreColor = (score: number) => {
    if (score >= 0.3) return "xai-score-high";
    if (score >= 0.1) return "xai-score-mid";
    return "xai-score-low";
  };

  const orderRows = (table.connectedTables?.orders as SubgraphTableRow[] | undefined) ?? [];
  const diagramRows = orderRows.slice(0, 5);
  const diagramHeight = Math.max(180, diagramRows.length * 54 + 44);
  const userY = diagramHeight / 2;

  return (
    <div className="xai-subgraph-layout">
      <div className="xai-subgraph-diagram-wrap">
        <div className="xai-connected-header">
          <Network size={12} />
          <span>Interactive Subgraph Map</span>
        </div>
        <svg
          className="xai-subgraph-diagram"
          viewBox={`0 0 520 ${diagramHeight}`}
          role="img"
          aria-label="Customer to order to item relationship map"
        >
          {diagramRows.map((row, idx) => {
            const y = 28 + idx * 54;
            const itemName = String(row?.linkedItem?.itemName || `Item ${idx + 1}`).slice(0, 18);
            return (
              <g key={`diagram-${idx}`}>
                <line x1="108" y1={userY} x2="200" y2={y} className="xai-subgraph-edge" />
                <line x1="294" y1={y} x2="340" y2={y} className="xai-subgraph-edge" />

                <g
                  className={`xai-subgraph-node ${expandedTxn === idx ? "xai-subgraph-node-active" : ""}`}
                  onClick={() => setExpandedTxn(expandedTxn === idx ? null : idx)}
                >
                  <rect x="200" y={y - 15} width="94" height="30" rx="8" />
                  <text x="247" y={y + 4} textAnchor="middle">
                    Order {idx + 1}
                  </text>
                </g>

                <g
                  className={`xai-subgraph-node xai-subgraph-item ${expandedTxn === idx ? "xai-subgraph-node-active" : ""}`}
                  onClick={() => setExpandedTxn(expandedTxn === idx ? null : idx)}
                >
                  <rect x="340" y={y - 15} width="150" height="30" rx="8" />
                  <text x="415" y={y + 4} textAnchor="middle">
                    {itemName}
                  </text>
                </g>
              </g>
            );
          })}

          <g className="xai-subgraph-node xai-subgraph-user">
            <circle cx="80" cy={userY} r="28" />
            <text x="80" y={userY - 2} textAnchor="middle">
              User
            </text>
            <text x="80" y={userY + 12} textAnchor="middle">
              {data.entityId}
            </text>
          </g>
        </svg>
      </div>

      {/* Entity item card */}
      <div className="xai-entity-card">
        <div className="xai-card-header">
          <span className="xai-card-label">Entity Item:</span>
          <span className="xai-card-id">{table.entityItem.id}</span>
        </div>
        <div className="xai-score-badge">
          Total Score: {table.entityItem.totalScore.toFixed(2)}
        </div>
        <table className="xai-col-table">
          <thead>
            <tr>
              <th>Column/Link</th>
              <th>Value</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {table.entityItem.columns.map((c, i) => (
              <tr key={i}>
                <td>{c.column}</td>
                <td className="xai-val-cell">{c.value}</td>
                <td className={scoreColor(c.score)}>{c.score.toFixed(2)}</td>
              </tr>
            ))}
            {table.entityItem.links.map((link, i) => (
              <tr key={`link-${i}`} className="xai-link-row">
                <td colSpan={3}>
                  <span className="xai-link-name">{link}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Connected tables */}
      {Object.entries(table.connectedTables).map(([tableName, rows]) => (
        <div key={tableName} className="xai-connected-section">
          <div className="xai-connected-header">
            <Network size={12} />
            <span>Connected Items of Table: <strong>{tableName}</strong></span>
          </div>
          <div className="xai-connected-rows">
            {(rows as SubgraphTableRow[]).map((row: SubgraphTableRow, ri: number) => (
              <div key={ri} className="xai-txn-card">
                <div
                  className="xai-txn-header"
                  onClick={() => setExpandedTxn(expandedTxn === ri ? null : ri)}
                >
                  <span className="xai-txn-score">
                    Total Score: {row.totalScore.toFixed(2)}
                  </span>
                  <ChevronRight
                    size={12}
                    className={`xai-chevron ${expandedTxn === ri ? "xai-chevron-open" : ""}`}
                  />
                </div>
                {(expandedTxn === ri || rows.length <= 3) && (
                  <table className="xai-col-table">
                    <thead>
                      <tr>
                        <th>Column/Link</th>
                        <th>Value</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.columns.map((c: SubgraphColumn, ci: number) => (
                        <tr key={ci}>
                          <td>{c.column}</td>
                          <td className="xai-val-cell">{c.value}</td>
                          <td className={scoreColor(c.score)}>
                            {c.score.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {row.linkedItem && (
                        <tr className="xai-link-row">
                          <td colSpan={2}>
                            <span className="xai-link-name">
                              → {row.linkedItem.itemName}
                            </span>
                          </td>
                          <td className="xai-val-cell xai-link-cat">
                            {row.linkedItem.category}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PREDICTIONS TAB (3-pane: Historical / Ground Truth / Predictions)
// ══════════════════════════════════════════════════════════════════════════

function PredictionPane({
  title,
  items,
  color,
}: {
  title: string;
  items: PredictionItem[];
  color: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = items.filter(
    (it) =>
      it.itemName.toLowerCase().includes(search.toLowerCase()) ||
      String(it.itemId).includes(search)
  );

  return (
    <div className="xai-pred-pane">
      <div className="xai-pred-pane-header" style={{ borderColor: color }}>
        <span>
          {title} ({items.length} items)
        </span>
      </div>
      <div className="xai-pred-search">
        <Search size={11} />
        <input
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="xai-pred-list">
        {filtered.map((item, i) => (
          <div
            key={i}
            className={`xai-pred-item ${item.highlighted ? "xai-pred-highlighted" : ""}`}
          >
            <div className="xai-pred-item-info">
              <span className="xai-pred-item-name">{item.itemName}</span>
              <span className="xai-pred-item-cat">{item.category}</span>
            </div>
            <span className="xai-pred-item-id">#{item.itemId}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="xai-empty">No items found.</p>
        )}
      </div>
    </div>
  );
}

function PredictionsTab({ data }: { data: ExplainResult }) {
  const pa = data.predictionAnalysis;
  if (!pa) {
    return <p className="xai-empty">Prediction analysis not available.</p>;
  }

  return (
    <div className="xai-pred-layout">
      <PredictionPane
        title="Historical Items"
        items={pa.historicalItems}
        color="var(--color-fg-secondary)"
      />
      <PredictionPane
        title="Ground Truth"
        items={pa.groundTruth}
        color="var(--color-risk-low)"
      />
      <PredictionPane
        title="Predictions"
        items={pa.predictions}
        color="var(--color-kumo-pink)"
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// GLOBAL TAB (Column contribution scores + chart)
// ══════════════════════════════════════════════════════════════════════════

function GlobalTab({ data }: { data: ExplainResult }) {
  const cols = data.globalExplainability;
  const [selected, setSelected] = useState(0);
  const [search, setSearch] = useState("");

  if (!cols || cols.length === 0) {
    return <p className="xai-empty">Global explainability not available.</p>;
  }

  const filtered = cols.filter(
    (c) =>
      c.column.toLowerCase().includes(search.toLowerCase()) ||
      c.table.toLowerCase().includes(search.toLowerCase())
  );

  const sel = filtered[selected] || cols[0];

  // Build chart data for the selected column
  const chartData = [
    { range: "Low", prediction: sel.variationPct * 0.3, label: sel.variationPct * 0.25 },
    { range: "Med-Low", prediction: sel.variationPct * 0.6, label: sel.variationPct * 0.55 },
    { range: "Medium", prediction: sel.variationPct * 0.85, label: sel.variationPct * 0.9 },
    { range: "Med-High", prediction: sel.variationPct * 1.1, label: sel.variationPct * 1.15 },
    { range: "High", prediction: sel.variationPct * 1.4, label: sel.variationPct * 1.3 },
  ];

  return (
    <div className="xai-global-layout">
      {/* Column list sidebar */}
      <div className="xai-global-sidebar">
        <div className="xai-global-search">
          <Search size={11} />
          <input
            placeholder="Search columns"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(0); }}
          />
        </div>
        <div className="xai-global-col-list">
          {filtered.map((c, i) => (
            <button
              key={i}
              className={`xai-global-col-item ${i === selected ? "xai-global-col-active" : ""}`}
              onClick={() => setSelected(i)}
            >
              <span className="xai-global-col-name">
                {c.table}.{c.column}
              </span>
              <span className="xai-global-col-pct">
                {c.variationPct.toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="xai-global-chart">
        <div className="xai-global-chart-header">
          <h4 className="xai-global-chart-title">
            {sel.table}.{sel.column}
          </h4>
          <div className="xai-global-chart-meta">
            <span>Hops: <strong>{sel.hops} hop</strong></span>
            <span>Type: <strong>{sel.type}</strong></span>
            <span>
              Variation: <strong>{sel.variationPct.toFixed(2)}%</strong>
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 8 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="range"
              type="category"
              width={60}
              tick={{ fontSize: 10, fill: "var(--color-muted-fg)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Bar dataKey="prediction" name="Prediction" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="rgba(148, 130, 210, 0.7)" />
              ))}
            </Bar>
            <Bar dataKey="label" name="Label" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="rgba(233, 30, 140, 0.5)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="xai-global-legend">
          <span className="xai-legend-item">
            <span className="xai-legend-dot" style={{ background: "rgba(148, 130, 210, 0.7)" }} />
            Prediction
          </span>
          <span className="xai-legend-item">
            <span className="xai-legend-dot" style={{ background: "rgba(233, 30, 140, 0.5)" }} />
            Label
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN EXPLAIN PANEL
// ══════════════════════════════════════════════════════════════════════════

export default function ExplainPanel({
  data,
  onClose,
}: {
  data: ExplainResult;
  onClose: () => void;
}) {
  const isRealKumo = data.source === "kumo";

  return (
    <div className="explain-panel">
      <div className="explain-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <p className="explain-title" style={{ margin: 0 }}>
              Explainability — Customer {data.entityId}
            </p>
            {data.source && (
              <span
                className="explain-source-badge"
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 4,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase" as const,
                  background: isRealKumo
                    ? "rgba(233,30,140,0.15)"
                    : "rgba(148,130,210,0.15)",
                  color: isRealKumo
                    ? "var(--color-kumo-pink)"
                    : "var(--color-fg-secondary)",
                  border: `1px solid ${isRealKumo ? "rgba(233,30,140,0.3)" : "rgba(148,130,210,0.3)"}`,
                  flexShrink: 0,
                }}
              >
                {isRealKumo ? "Kumo GNN attribution" : "Heuristic signals"}
              </span>
            )}
          </div>
          <p className="explain-subtitle" style={{ margin: 0 }}>{data.prediction}</p>
          {data.pql && (
            <code
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 9,
                color: "var(--color-muted-fg)",
                fontFamily: "var(--font-mono, monospace)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--color-border)",
                borderRadius: 4,
                padding: "2px 6px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
              title={data.pql}
            >
              {data.pql}
            </code>
          )}
        </div>
        <button
          className="explain-close"
          onClick={onClose}
          aria-label="Close explanation panel"
          type="button"
        >
          <X size={14} />
        </button>
      </div>

      <Tabs defaultValue="signals" className="explain-tabs">
        <TabsList className="explain-tabs-list">
          <TabsTrigger value="signals">
            <BarChart3 size={11} /> Signals
          </TabsTrigger>
          <TabsTrigger value="subgraph">
            <Network size={11} /> Subgraph
          </TabsTrigger>
          <TabsTrigger value="predictions">
            <Eye size={11} /> Predictions
          </TabsTrigger>
          <TabsTrigger value="global">
            <Layers size={11} /> Global
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signals" className="explain-tab-content">
          <SignalsTab data={data} />
        </TabsContent>

        <TabsContent value="subgraph" className="explain-tab-content">
          <SubgraphTab data={data} />
        </TabsContent>

        <TabsContent value="predictions" className="explain-tab-content">
          <PredictionsTab data={data} />
        </TabsContent>

        <TabsContent value="global" className="explain-tab-content">
          <GlobalTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
