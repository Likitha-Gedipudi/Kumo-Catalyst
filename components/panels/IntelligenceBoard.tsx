"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity,
  BarChart3,
  ChevronRight,
  Compass,
  Layers,
  Loader2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { ChurnBar, DemandChart } from "@/components/stylist/result-widgets";
import { buildRetentionAction } from "@/lib/business/stylist-handoff";
import { buildEvalSnapshot } from "@/lib/business/stylist-eval";
import { buildBoardActions, buildDecisionLens } from "@/lib/business/stylist-decision-lens";
import { useStylistStore, selectActiveMessages } from "@/lib/store";
import type { CustomerRisk, HandoffDestination, Message } from "@/lib/types";
import {
  clampPercent,
  formatStatThousands,
  formatUtcTimestamp,
  formatUptime,
  healthModeReason,
  summarizeSignal,
} from "@/lib/utils/formatters";

export function IntelligenceBoard({
  onCustomerExplain,
  onSend,
  onHandoff,
}: {
  onCustomerExplain: (id: number) => void;
  onSend: (text: string) => void;
  onHandoff: (message: Message, destination: HandoffDestination) => void;
}) {
  const messages = useStylistStore(selectActiveMessages);
  const {
    board,
    analyticsRuns,
    feedbackLog,
    handoffLog,
    sidecarHealth,
    loadBoard,
    boardFocus,
    setBoardFocus,
  } = useStylistStore();
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const demandSectionRef = useRef<HTMLDivElement>(null);
  const churnSectionRef = useRef<HTMLDivElement>(null);
  const [cloudDiscovery, setCloudDiscovery] = useState<{
    configured: boolean;
    jobsSource?: string;
    jobs?: unknown[];
    predictiveQueriesLoaded?: boolean;
    predictiveQueries?: unknown[];
    kumoAppBaseUrl?: string | null;
    message?: string;
  } | null>(null);

  const refreshDiscovery = useCallback(() => {
    void fetch("/api/kumo/discovery")
      .then((r) => r.json())
      .then(setCloudDiscovery)
      .catch(() => setCloudDiscovery(null));
  }, []);

  useEffect(() => {
    refreshDiscovery();
  }, [refreshDiscovery]);

  useEffect(() => {
    if (!boardFocus) return;
    const ref =
      boardFocus.kind === "demand" ? demandSectionRef : churnSectionRef;
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [boardFocus]);

  if (!board) {
    return (
      <div className="board-loading">
        <Loader2 className="animate-spin" size={24} />
        <div className="board-loading-copy">
          <p>Loading intelligence board…</p>
          <p className="board-loading-sub">
            {sidecarHealth
              ? "The board is reconnecting while the graph finishes warming."
              : "Waiting for the Kumo sidecar on 127.0.0.1:8000."}
          </p>
        </div>
        <button
          type="button"
          className="board-action-btn board-loading-btn"
          onClick={() => void loadBoard()}
        >
          Retry connection
        </button>
      </div>
    );
  }

  const latestBoardMessage = [...messages]
    .reverse()
    .find(
      (msg) =>
        msg.role === "assistant" &&
        msg.type &&
        msg.type !== "text" &&
        msg.type !== "explain"
    );

  const demandFromChat =
    latestBoardMessage?.type === "demand_forecast" &&
    Array.isArray(latestBoardMessage.data) &&
    latestBoardMessage.data.length > 0;

  const demandData = demandFromChat
    ? latestBoardMessage!.data
    : board.categoryDemand;

  const itemDemandData = board.itemDemand ?? [];

  const churnFromChat =
    (latestBoardMessage?.type === "churn_list" ||
      latestBoardMessage?.type === "competitive_churn") &&
    Array.isArray(latestBoardMessage.data) &&
    latestBoardMessage.data.length > 0;

  const churnData = churnFromChat
    ? latestBoardMessage!.data
    : board.churnAtRisk;

  const decisionLens = buildDecisionLens(
    latestBoardMessage,
    board.timeframeDays || 30,
    sidecarHealth
      ? sidecarHealth.totalPredictionRequests > 0
        ? Math.round((sidecarHealth.cachedPredictionRequests / sidecarHealth.totalPredictionRequests) * 100)
        : sidecarHealth.cacheCoveragePct
      : undefined
  );
  const boardActions = buildBoardActions(latestBoardMessage);
  const evalSnapshot = buildEvalSnapshot(messages, analyticsRuns, feedbackLog, sidecarHealth);
  const healthMode = sidecarHealth?.mode ?? board.stats.mode;
  const modeReason = healthModeReason(sidecarHealth?.modeReason);
  const healthSummary =
    !sidecarHealth
      ? "Health unavailable"
      : sidecarHealth.graphLoaded
        ? `${formatUptime(sidecarHealth.uptimeSec)} · ${
            sidecarHealth.cacheWarmedAt
              ? `cache warmed ${formatUtcTimestamp(sidecarHealth.cacheWarmedAt)}`
              : "cache warming"
          }`
        : "Awaiting successful graph build";

  // Dynamic eval summary — never static copy
  const blendedScore = Math.round(
    (evalSnapshot.traceCoveragePct +
      evalSnapshot.liveServingPct +
      (evalSnapshot.helpfulRatePct || evalSnapshot.reviewCoveragePct)) /
      3
  );
  const evalSummaryText =
    evalSnapshot.totalRuns === 0
      ? "No assistant runs evaluated yet. Ask a business question to start tracking session trust."
      : `${blendedScore}% blended trust score across ${evalSnapshot.totalRuns} assistant ${evalSnapshot.totalRuns === 1 ? "run" : "runs"}. ${evalSnapshot.observedCapabilities.length} of ${evalSnapshot.supportedCapabilityCount} workflow types exercised this session.`;


  return (
    <div className="board-content">

      {/* ── Kumo Cloud strip ── */}
      {cloudDiscovery && (
        <div className="board-cloud-strip">
          <span className="board-cloud-strip-title">Kumo Cloud</span>
          <span className="board-cloud-strip-meta">
            {cloudDiscovery.configured
              ? `${cloudDiscovery.jobsSource === "rest" ? "Live jobs" : "Jobs"} · ${
                  cloudDiscovery.jobs?.length ?? 0
                } listed`
              : "REST key not set"}
            {cloudDiscovery.predictiveQueriesLoaded
              ? ` · ${cloudDiscovery.predictiveQueries?.length ?? 0} predictive queries`
              : ""}
          </span>
          {!cloudDiscovery.configured && (
            <span style={{ fontSize: 10, color: "var(--color-muted-fg)", fontStyle: "italic" }}>
              Add KUMO_REST_API_KEY to .env
            </span>
          )}
          {cloudDiscovery.kumoAppBaseUrl && (
            <a
              href={cloudDiscovery.kumoAppBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="board-cloud-link"
            >
              Open console
            </a>
          )}
          <button
            type="button"
            className="board-cloud-refresh"
            onClick={() => {
              refreshDiscovery();
              void loadBoard();
            }}
          >
            Refresh
          </button>
        </div>
      )}

      {/* ── Stats strip ── */}
      <div className="board-stats">
        <div className="board-stat" title="Total customer profiles currently loaded into the Kumo graph.">
          <Users size={14} />
          <span>{formatStatThousands(board.stats.totalUsers)} customers</span>
        </div>
        <div className="board-stat" title="Total merchandise items available for analysis.">
          <Layers size={14} />
          <span>{formatStatThousands(board.stats.totalItems)} items</span>
        </div>
        <div className="board-stat" title="Historical order records powering predictions.">
          <ShoppingBag size={14} />
          <span>{formatStatThousands(board.stats.totalOrders ?? 0)} orders</span>
        </div>
        <div className="board-stat" title="Current graph / session health.">
          <ShieldCheck size={14} />
          <span>{healthSummary}</span>
        </div>
        <button
          type="button"
          className={`mode-badge mode-badge-btn ${
            healthMode === "live"
              ? "mode-live"
              : healthMode === "degraded"
                ? "mode-degraded"
                : healthMode === "error"
                  ? "mode-error"
                  : "mode-mock"
          }`}
          onClick={() => setShowHealthDetails((prev) => !prev)}
          title="Click to view health diagnostics"
        >
          {healthMode === "live"
            ? "● Live"
            : healthMode === "degraded"
              ? "● Degraded"
              : healthMode === "error"
                ? "● Error"
                : "● Mock"}
        </button>
      </div>

      {/* ── Health detail panel ── */}
      {showHealthDetails && sidecarHealth && (
        <div className="health-detail-panel">
          <p className="health-detail-title">Status Diagnostics</p>
          <p className="health-detail-row">
            <span>Reason:</span>
            <strong>{modeReason}</strong>
          </p>
          <p className="health-detail-row">
            <span>Cache Coverage:</span>
            <strong>{sidecarHealth.cacheCoveragePct}%</strong>
          </p>
          {sidecarHealth.linkHealth?.length > 0 && (
            <div className="health-link-table">
              {sidecarHealth.linkHealth.map((link) => (
                <p key={link.name} className="health-link-row">
                  {link.sourceTable}.{link.sourceColumn} → {link.targetTable}.{link.targetColumn}:{" "}
                  <strong>{link.matchedPct}% matched</strong>
                </p>
              ))}
            </div>
          )}
          {sidecarHealth.warnings?.length > 0 && (
            <div className="trust-warning-list">
              {sidecarHealth.warnings.slice(0, 3).map((warning) => (
                <p key={warning} className="trust-warning-item">
                  {warning}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Decision Lens ── */}
      <div className="board-section">
        <div className="board-section-header">
          <Target size={14} className="text-kumo-pink" />
          <h3>Decision Lens</h3>
        </div>
        <div className="decision-topline">
          <span className="decision-focus">{decisionLens.focus}</span>
          <span className="decision-confidence">{decisionLens.confidenceLabel}</span>
        </div>
        <h4 className="decision-title">{decisionLens.title}</h4>
        <p className="decision-summary">{decisionLens.summary}</p>

        <div className="confidence-meter">
          <div className="confidence-meter-track">
            <div
              className="confidence-meter-fill"
              style={{ width: `${clampPercent(Math.max(decisionLens.confidencePct, 8))}%` }}
            />
          </div>
          <span className="confidence-meter-value">{decisionLens.confidencePct}%</span>
        </div>

        <div className="evidence-chip-row">
          {decisionLens.evidence.map((chip) => (
            <span key={chip} className="evidence-chip">
              {chip}
            </span>
          ))}
        </div>
        {sidecarHealth?.warnings && sidecarHealth.warnings.length > 0 && (
          <div className="trust-warning-list">
            {sidecarHealth.warnings.slice(0, 2).map((warning) => (
              <p key={warning} className="trust-warning-item">
                {warning}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ── Recommended Action ── */}
      <div className="board-section">
        <div className="board-section-header">
          <Compass size={14} className="text-kumo-pink" />
          <h3>Recommended Action</h3>
        </div>
        <div className="action-card">
          <div className="action-block">
            <span className="action-label">Next move</span>
            <p className="action-text">{decisionLens.action}</p>
          </div>
          <div className="action-divider" />
          <div className="action-block">
            <span className="action-label">Caution</span>
            <p className="action-text action-text-muted">{decisionLens.caution}</p>
          </div>
          {latestBoardMessage && latestBoardMessage.type !== "text" && latestBoardMessage.type !== "explain" && (
            <>
              <div className="action-divider" />
              <div className="handoff-action-row">
                <button
                  type="button"
                  className="handoff-btn"
                  onClick={() =>
                    onHandoff(
                      latestBoardMessage,
                      latestBoardMessage.type === "churn_list" || latestBoardMessage.type === "competitive_churn"
                        ? "CRM audience"
                        : latestBoardMessage.type === "cold_affinity"
                          ? "Launch segment"
                          : "Email campaign"
                    )
                  }
                >
                  <Upload size={12} />
                  Queue handoff
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Explore Further (Board Actions) ── */}
      {boardActions.length > 0 && (
        <div className="board-section">
          <div className="board-section-header">
            <Sparkles size={14} className="text-kumo-pink" />
            <h3>Explore Further</h3>
          </div>
          <div className="board-actions">
            {boardActions.map((action, ai) => (
              <button
                key={`${action.kind}-${action.label}-${ai}`}
                type="button"
                className="board-action-btn"
                onClick={() => {
                  if (action.kind === "explain" && action.userId != null) {
                    onCustomerExplain(action.userId);
                    return;
                  }
                  if (action.kind === "chat" && action.question) {
                    onSend(action.question);
                  }
                }}
              >
                <ChevronRight size={11} className="board-action-icon" />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Business Outlook ── */}
      <div
        ref={demandSectionRef}
        id="board-section-demand"
        className={`board-section ${boardFocus?.kind === "demand" ? "board-section-focused" : ""}`}
      >
        <div className="board-section-header">
          <TrendingUp size={14} className="text-kumo-pink" />
          <h3>Business Outlook — Next {board.timeframeDays || 30} Days</h3>
          <span className={`board-data-source ${demandFromChat ? "board-data-source--chat" : ""}`}>
            {demandFromChat ? "From chat" : "Baseline"}
          </span>
        </div>
        {demandData.length > 0 ? (
          <DemandChart data={demandData} showAll maxBars={50} />
        ) : (
          <p className="board-empty">No demand data loaded.</p>
        )}
      </div>

      {/* ── Top Items by Demand ── */}
      {itemDemandData.length > 0 && (
        <div className="board-section">
          <div className="board-section-header">
            <BarChart3 size={12} className="text-kumo-pink" />
            <h3>Top Items by Demand</h3>
          </div>
          <div className="item-demand-list">
            {itemDemandData.slice(0, 5).map((item, idx) => (
              <div key={item.itemId} className="item-demand-row">
                <span className="item-demand-rank">#{idx + 1}</span>
                <div className="item-demand-info">
                  <p className="item-demand-name">{item.itemName ?? `Item ${item.itemId}`}</p>
                  <p className="item-demand-meta">{item.category}{item.color ? ` · ${item.color}` : ""}</p>
                </div>
                <span className="item-demand-score">
                  {Number.isFinite(item.demandScore)
                    ? `${Math.round(item.demandScore * 100)}%`
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Risk Monitor ── */}
      <div
        ref={churnSectionRef}
        id="board-section-churn"
        className={`board-section ${boardFocus?.kind === "churn" ? "board-section-focused" : ""}`}
      >
        <div className="board-section-header">
          <Activity size={14} className="text-risk-high" />
          <h3>Risk Monitor</h3>
          <span className={`board-data-source ${churnFromChat ? "board-data-source--chat" : ""}`}>
            {churnFromChat ? "From chat" : "Baseline"}
          </span>
        </div>
        {churnData.length > 0 ? (
          <div className="churn-board-list">
            {churnData.slice(0, 4).map((c: CustomerRisk) => {
              const action = buildRetentionAction(c);
              return (
                <div key={c.userId} className="churn-board-row">
                  <div className="churn-board-avatar">
                    {String(c.userId).slice(-2).toUpperCase()}
                  </div>
                  <div className="churn-board-info">
                    <div className="churn-board-heading">
                      <p className="churn-board-id">{c.name}</p>
                      <button type="button" className="churn-board-why" onClick={() => onCustomerExplain(c.userId)}>
                        Inspect
                      </button>
                    </div>
                    <p className="churn-board-signal">{summarizeSignal(c.topSignal)}</p>
                    <ChurnBar value={c.churnProbability} />
                    <button
                      type="button"
                      className="churn-board-action-btn"
                      onClick={() => onSend(action.prompt)}
                    >
                      {action.label}
                    </button>
                  </div>
                  <span className="churn-board-pct">
                    {Math.round(c.churnProbability * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="board-empty">No churn data loaded.</p>
        )}
      </div>

      {/* ── Session Trust (Evaluation Snapshot) ── */}
      <div className="board-section">
        <div className="board-section-header">
          <Zap size={14} className="text-kumo-pink" />
          <h3>Session Trust</h3>
        </div>
        <div className="eval-grid">
          <div className="eval-card">
            <span>Workflow coverage</span>
            <strong>{evalSnapshot.coveragePct}%</strong>
            <p>{evalSnapshot.observedCapabilities.length} of {evalSnapshot.supportedCapabilityCount} types used</p>
          </div>
          <div className="eval-card">
            <span>Trace coverage</span>
            <strong>{evalSnapshot.traceCoveragePct}%</strong>
            <p>{evalSnapshot.totalRuns} assistant runs evaluated</p>
          </div>
          <div className="eval-card">
            <span>Human review</span>
            <strong>{evalSnapshot.reviewCoveragePct}%</strong>
            <p>{evalSnapshot.reviewedCount} reviewed · {evalSnapshot.helpfulRatePct}% helpful</p>
          </div>
          <div className="eval-card">
            <span>Live serving</span>
            <strong>{evalSnapshot.liveServingPct}%</strong>
            <p>{evalSnapshot.fallbackCount} fallbacks · {evalSnapshot.cacheReusePct}% cache reuse</p>
          </div>
        </div>
        <div className="confidence-meter eval-meter">
          <div className="confidence-meter-track">
            <div
              className="confidence-meter-fill"
              style={{ width: `${clampPercent(blendedScore)}%` }}
            />
          </div>
          <span className="confidence-meter-value">{evalSnapshot.avgLatencyMs} ms avg</span>
        </div>
        <div className="evidence-chip-row">
          {(evalSnapshot.observedCapabilities.length > 0
            ? evalSnapshot.observedCapabilities
            : ["Awaiting live runs"]
          ).map((chip) => (
            <span key={chip} className="evidence-chip">
              {chip.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        <p className="eval-summary">{evalSummaryText}</p>
      </div>

      {/* ── Integration Handoffs — only shown when entries exist ── */}
      {handoffLog.length > 0 && (
        <div className="board-section">
          <div className="board-section-header">
            <Upload size={14} className="text-kumo-pink" />
            <h3>Integration Handoffs</h3>
          </div>
          <div className="handoff-log-list">
            {[...handoffLog].reverse().slice(0, 4).map((handoff) => (
              <div key={handoff.id} className="handoff-log-row">
                <div className="handoff-log-copy">
                  <strong>{handoff.audienceLabel}</strong>
                  <p>
                    {handoff.destination} · {handoff.audienceSize} records ·{" "}
                    {formatUtcTimestamp(handoff.createdAt)}
                  </p>
                </div>
                <span className="handoff-log-status">{handoff.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
