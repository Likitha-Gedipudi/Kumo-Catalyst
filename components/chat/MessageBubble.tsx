"use client";

import { useState } from "react";

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function MarkdownParagraphs({ content, className }: { content: string; className?: string }) {
  const paragraphs = content.trim().split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i} className={className}>
          {renderInlineMarkdown(para)}
        </p>
      ))}
    </>
  );
}
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Code2,
  Download,
  ShoppingBag,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import {
  exportChurnCustomers,
  exportColdAffinity,
  exportDemandForecast,
  exportReverseRecommendation,
} from "@/lib/utils/csv-export";
import { buildExplainabilityItem } from "@/lib/business/stylist-explainability";
import type {
  BoardFocus,
  CustomerRisk,
  HandoffDestination,
  Message,
  MessageFeedback,
} from "@/lib/types";
import {
  ChurnRow,
  DemandChart,
  ProductCard,
} from "@/components/stylist/result-widgets";
import {
  mergeDiscoveryChips,
  type CloudDiscoverySnapshot,
} from "@/lib/chat/discovery-chips";

/** Map msg.type to a human-readable capability label — no hardcoded display strings elsewhere. */
function capabilityLabel(type: string | undefined): string {
  switch (type) {
    case "demand_forecast":    return "Demand Forecast";
    case "churn_list":         return "Churn Risk";
    case "competitive_churn":  return "Competitive Churn";
    case "reverse_rec":        return "Inventory Clearance";
    case "cold_affinity":      return "Launch Audience";
    case "explain":            return "Explainability";
    default:                   return "Kumo Agent";
  }
}

/** Sum step latencies from a trace to get total latency in ms. */
function totalLatencyMs(trace: Message["trace"]): number | null {
  if (!trace?.steps?.length) return null;
  const sum = trace.steps.reduce((acc, s) => acc + (s.latencyMs ?? 0), 0);
  return sum > 0 ? Math.round(sum) : null;
}

/** CSS modifier class based on sidecar serving mode. */
function modeDotClass(servingMode: string | undefined): string {
  switch (servingMode) {
    case "live":     return "agent-output-dot--live";
    case "mock":     return "agent-output-dot--mock";
    case "fallback": return "agent-output-dot--fallback";
    default:         return "agent-output-dot--default";
  }
}

export function MessageBubble({
  msg,
  onExplain,
  onSend,
  onFeedback,
  onHandoff,
  onOpenBoard,
  cloudDiscovery,
}: {
  msg: Message;
  onExplain: (id: number) => void;
  onSend: (text: string) => void;
  onFeedback: (id: string, feedback: MessageFeedback) => void;
  onHandoff: (message: Message, destination: HandoffDestination) => void;
  onOpenBoard?: (focus: BoardFocus) => void;
  cloudDiscovery?: CloudDiscoverySnapshot | null;
}) {
  const isUser = msg.role === "user";
  const [showTrace, setShowTrace] = useState(false);
  const [demandShowAll, setDemandShowAll] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const safeExport = (fn: () => void) => {
    try {
      fn();
      setCsvError(null);
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : "Export failed");
    }
  };
  const explainabilityItem = buildExplainabilityItem(msg);
  const discoveryChips = !isUser ? mergeDiscoveryChips(msg, cloudDiscovery) : [];

  // ── User turn — lightweight query pill ──────────────────────────────────
  if (isUser) {
    return (
      <div className="msg-row msg-user">
        <p className="user-query">{msg.content}</p>
      </div>
    );
  }

  // ── Agent turn — structured output card ─────────────────────────────────
  const capLabel = capabilityLabel(msg.type);
  const latency  = totalLatencyMs(msg.trace);
  const dotClass = modeDotClass(msg.trace?.servingMode);

  return (
    <div className="msg-row msg-assistant">
      <div className="msg-content-wrap">
        {/* ── Agent output card ── */}
        <div className="agent-output">
          {/* Status badge */}
          <div className="agent-output-badge">
            <span className={`agent-output-dot ${dotClass}`} />
            <span className="agent-output-cap-label">{capLabel}</span>
            {latency != null && (
              <span className="agent-output-latency">{latency} ms</span>
            )}
            {msg.trace?.servingMode && (
              <span className="agent-output-mode">{msg.trace.servingMode}</span>
            )}
          </div>

          {/* Body */}
          <div className="agent-output-body">
            {msg.content.trim().length > 0 && <MarkdownParagraphs content={msg.content} className="msg-text" />}
            {csvError && (
              <p className="text-xs text-amber-400/90" role="status">
                {csvError}
              </p>
            )}

            {msg.pql && (
              <div className="pql-trace">
                <Code2 size={11} className="pql-icon" />
                <span className="pql-label">KumoRFM PQL</span>
                <pre className="pql-code">{msg.pql}</pre>
              </div>
            )}

            {(msg.trace || msg.feedback !== undefined) && (
              <div className="message-review-row">
                {msg.trace && (
                  <button
                    type="button"
                    className={`trace-toggle-btn ${showTrace ? "trace-toggle-btn-active" : ""}`}
                    onClick={() => setShowTrace((v) => !v)}
                  >
                    <Activity size={12} />
                    {showTrace ? "Hide run trace" : "Show run trace"}
                  </button>
                )}
                <div className="message-feedback-actions">
                  <button
                    type="button"
                    className={`message-feedback-btn ${msg.feedback === "positive" ? "message-feedback-btn-active" : ""}`}
                    onClick={() => onFeedback(msg.id, msg.feedback === "positive" ? null : "positive")}
                  >
                    <ThumbsUp size={12} />
                    Helpful
                  </button>
                  <button
                    type="button"
                    className={`message-feedback-btn ${msg.feedback === "negative" ? "message-feedback-btn-active" : ""}`}
                    onClick={() => onFeedback(msg.id, msg.feedback === "negative" ? null : "negative")}
                  >
                    <ThumbsDown size={12} />
                    Needs work
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Explainability item card ── */}
        {explainabilityItem && (
          <div className="explain-item-card">
            <div className="explain-item-header">
              <Sparkles size={12} />
              <span>Explainability item</span>
              {msg.trace?.servingMode === "fallback" && (
                <span className="explain-item-mode-badge">Cached / fallback</span>
              )}
            </div>
            <strong className="explain-item-title">{explainabilityItem.title}</strong>
            <div className="explain-item-list">
              {explainabilityItem.bullets.map((bullet) => (
                <div key={bullet} className="explain-item-row">
                  <span className="explain-item-dot" />
                  <p>{bullet}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Run trace panel ── */}
        {msg.trace && showTrace && (
          <div className="trace-panel">
            <div className="trace-panel-head">
              <Activity size={12} />
              <span>Run Trace</span>
              {msg.trace.capability && (
                <span className="trace-panel-capability">
                  {String(msg.trace.capability).replaceAll("_", " ")}
                </span>
              )}
            </div>
            <div className="trace-meta-row">
              <div className="trace-meta-pill">
                <span>Mode</span>
                <strong>{msg.trace.servingMode ?? "—"}</strong>
              </div>
              <div className="trace-meta-pill">
                <span>Results</span>
                <strong>{msg.trace.resultCount ?? 0}</strong>
              </div>
              <div className="trace-meta-pill">
                <span>Entity</span>
                <strong>{msg.trace.entityId ?? "Portfolio-wide"}</strong>
              </div>
            </div>
            {msg.trace.sidecarEndpoint && (
              <div className="trace-endpoint-row">
                <span>Endpoint</span>
                <code>{msg.trace.sidecarEndpoint}</code>
              </div>
            )}
            <div className="trace-steps">
              {(msg.trace.steps ?? []).map((step) => (
                <div key={step.id} className={`trace-step trace-step-${step.status}`}>
                  <div className="trace-step-head">
                    <span>{step.label}</span>
                    {step.latencyMs != null && (
                      <strong>{Math.round(step.latencyMs)} ms</strong>
                    )}
                  </div>
                  <p>{step.detail}</p>
                </div>
              ))}
            </div>
            {msg.trace.warnings && msg.trace.warnings.length > 0 && (
              <div className="trace-warning-list">
                {msg.trace.warnings.map((warning, i) => (
                  <div key={`${i}-${warning}`} className="trace-warning-item">
                    <AlertTriangle size={12} />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Demand forecast result ── */}
        {msg.type === "demand_forecast" && Array.isArray(msg.data) && msg.data.length > 0 && (
          <div className="result-card">
            <div className="result-card-header">
              <TrendingUp size={14} className="text-kumo-pink" />
              <span>Category Demand Forecast</span>
              <button
                onClick={() => safeExport(() => exportDemandForecast(msg.data, msg.itemResults))}
                className="download-csv-btn"
                title="Download as CSV"
                type="button"
              >
                <Download size={16} />
              </button>
            </div>
            <div className="result-card-body">
              <DemandChart
                data={msg.data}
                maxBars={6}
                showAll={demandShowAll}
                onBarClick={(category) =>
                  onSend(`Drill into demand for category "${category}": which items and customer behaviors are driving the score?`)
                }
              />
              {msg.data.length > 6 && (
                <button
                  type="button"
                  className="demand-expand-btn"
                  onClick={() => setDemandShowAll((v) => !v)}
                >
                  {demandShowAll ? "Show top categories" : `Show all ${msg.data.length} categories`}
                </button>
              )}
              {msg.itemResults && msg.itemResults.length > 0 && (
                <div className="demand-name-list">
                  {msg.itemResults
                    .slice(0, Math.max(1, Math.min(Number.isFinite(msg.resultLimit) ? Number(msg.resultLimit) : 10, 10)))
                    .map((item: { itemName?: string; itemId?: number; category?: string }, idx: number) => (
                      <div key={idx} className="demand-name-row">
                        <span className="demand-name-rank">#{idx + 1}</span>
                        <div className="demand-name-copy">
                          <p className="demand-name-title">{item.itemName || `Item ${item.itemId}`}</p>
                          <p className="demand-name-meta">{item.category || "Uncategorized"}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Churn list result ── */}
        {(msg.type === "churn_list" || msg.type === "competitive_churn") &&
          Array.isArray(msg.data) && msg.data.length > 0 && (
            <div className="result-card">
              <div className="result-card-header">
                <AlertTriangle size={14} className="text-risk-high" />
                <span>Churn Risk — Top Customers</span>
                <button
                  onClick={() => safeExport(() => exportChurnCustomers(msg.data))}
                  className="download-csv-btn"
                  title="Download as CSV"
                  type="button"
                >
                  <Download size={16} />
                </button>
              </div>
              <div className="result-card-actions">
                <button type="button" className="handoff-btn" onClick={() => onHandoff(msg, "CRM audience")}>
                  <Upload size={12} />
                  Export to CRM
                </button>
                <button type="button" className="handoff-btn" onClick={() => onHandoff(msg, "SMS platform")}>
                  <Upload size={12} />
                  Queue SMS win-back
                </button>
              </div>
              <div className="churn-result-list">
                {msg.data.slice(0, 4).map((c: CustomerRisk) => (
                  <ChurnRow key={c.userId} customer={c} onSend={onSend} />
                ))}
              </div>
            </div>
          )}

        {/* ── Reverse rec result ── */}
        {msg.type === "reverse_rec" &&
          (msg.item || (Array.isArray(msg.data) && msg.data.length > 0)) && (
          <div className="result-card">
            <div className="result-card-header">
              <ShoppingBag size={14} className="text-kumo-pink" />
              <span>Target Customers</span>
              <button
                onClick={() =>
                  safeExport(() =>
                    exportReverseRecommendation(msg.data, msg.item?.itemName || msg.item?.name)
                  )
                }
                className="download-csv-btn"
                title="Download as CSV"
                type="button"
              >
                <Download size={16} />
              </button>
            </div>
            <div className="result-card-body">
              <div className="result-card-actions">
                <button type="button" className="handoff-btn" onClick={() => onHandoff(msg, "Email campaign")}>
                  <Upload size={12} />
                  Export audience
                </button>
              </div>
              <p className="result-sub">
                {Array.isArray(msg.data) ? msg.data.length : 0} customers identified
              </p>
              {msg.item && (
                <div className="mb-4">
                  <ProductCard article={msg.item} />
                </div>
              )}
              {Array.isArray(msg.data) && (
                <div className="rec-customer-list">
                  {msg.data.slice(0, 6).map((c: { userId?: number; user_id?: number; purchaseProbability?: number }, i: number) => {
                    const uid = c.userId ?? c.user_id;
                    const uidOk = typeof uid === "number" && Number.isFinite(uid);
                    const prob = c.purchaseProbability;
                    const probOk = typeof prob === "number" && Number.isFinite(prob);
                    return (
                    <div key={i} className="rec-customer-row">
                      <span className="rec-rank">#{i + 1}</span>
                      <div className="churn-board-avatar" style={{ width: 24, height: 24, fontSize: 9 }}>
                        {uidOk ? String(uid).slice(-2).toUpperCase() : "—"}
                      </div>
                      <span className="rec-cid" style={{ marginLeft: 6 }}>
                        {uidOk ? `User ${uid}` : "User —"}
                      </span>
                      {probOk ? (
                        <span className="rec-prob">{Math.round(prob * 100)}%</span>
                      ) : (
                        <span className="rec-prob text-muted-fg">—</span>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Cold affinity result ── */}
        {msg.type === "cold_affinity" && Array.isArray(msg.data) && msg.data.length > 0 && (
          <div className="result-card">
            <div className="result-card-header">
              <Sparkles size={14} className="text-kumo-pink" />
              <span>Affinity Audience</span>
              <button
                onClick={() => safeExport(() => exportColdAffinity(msg.data, msg.trace?.entityId ?? undefined))}
                className="download-csv-btn"
                title="Download as CSV"
                type="button"
              >
                <Download size={16} />
              </button>
            </div>
            <div className="result-card-body">
              <div className="result-card-actions">
                <button type="button" className="handoff-btn" onClick={() => onHandoff(msg, "Launch segment")}>
                  <Upload size={12} />
                  Export launch segment
                </button>
              </div>
              <p className="result-sub">{msg.data.length} customers identified with high category affinity</p>
              {Array.isArray(msg.data) && (
                <div className="rec-customer-list" style={{ marginTop: 12 }}>
                  {msg.data.slice(0, 6).map((c: { userId?: number; user_id?: number; affinityScore?: number }, i: number) => {
                    const uid = c.userId ?? c.user_id;
                    const uidOk = typeof uid === "number" && Number.isFinite(uid);
                    const aff = c.affinityScore;
                    const affOk = typeof aff === "number" && Number.isFinite(aff);
                    return (
                    <div key={i} className="rec-customer-row">
                      <span className="rec-rank">#{i + 1}</span>
                      <div className="churn-board-avatar" style={{ width: 24, height: 24, fontSize: 9 }}>
                        {uidOk ? String(uid).slice(-2).toUpperCase() : "—"}
                      </div>
                      <span className="rec-cid" style={{ marginLeft: 6 }}>
                        {uidOk ? `User ${uid}` : "User —"}
                      </span>
                      {affOk ? (
                        <span className="rec-prob">{Math.round(aff * 100)}%</span>
                      ) : (
                        <span className="rec-prob text-muted-fg">—</span>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Follow-up explore buttons ── */}
        {msg.followUps && msg.followUps.length > 0 && (
          <div className="explore-list">
            {msg.followUps.map((q, i) => (
              <button
                type="button"
                key={i}
                className="explore-btn"
                onClick={() => onSend(q)}
              >
                <Zap size={11} className="explore-btn-icon" />
                <span>{q}</span>
                <ChevronRight size={12} className="explore-btn-arrow" />
              </button>
            ))}
          </div>
        )}

        {/* ── Discovery chips ── */}
        {discoveryChips.length > 0 && (
          <div className="discovery-chips">
            {discoveryChips.map((chip, ci) => (
              <button
                type="button"
                key={`${chip.label}-${ci}`}
                className="discovery-chip"
                onClick={() => {
                  if (chip.action.type === "send") {
                    onSend(chip.action.text);
                  } else if (chip.action.type === "board" && onOpenBoard) {
                    onOpenBoard(chip.action.focus);
                  } else if (chip.action.type === "open_url") {
                    window.open(chip.action.url, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
