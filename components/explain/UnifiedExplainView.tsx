"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import ExplainPanel from "@/components/ExplainPanel";
import { useStylistStore, selectActiveMessages } from "@/lib/store";
import { buildEvalSnapshot } from "@/lib/business/stylist-eval";
import { clampPercent } from "@/lib/utils/formatters";

export function UnifiedExplainView({
  onClose,
}: {
  onClose: () => void;
}) {
  const explainData = useStylistStore((s) => s.explainData);
  const messages = useStylistStore(selectActiveMessages);
  const analyticsRuns = useStylistStore((s) => s.analyticsRuns);
  const feedbackLog = useStylistStore((s) => s.feedbackLog);
  const sidecarHealth = useStylistStore((s) => s.sidecarHealth);
  const activeExplainEntityId = useStylistStore((s) => s.activeExplainEntityId);
  const explainExcludeLastDays = useStylistStore((s) => s.explainExcludeLastDays);
  const setExplainExcludeLastDays = useStylistStore((s) => s.setExplainExcludeLastDays);
  const loadExplain = useStylistStore((s) => s.loadExplain);

  const latestTraceMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.trace && m.id !== "welcome"),
    [messages]
  );

  const evalSnap = useMemo(
    () => buildEvalSnapshot(messages, analyticsRuns, feedbackLog, sidecarHealth),
    [messages, analyticsRuns, feedbackLog, sidecarHealth]
  );

  const uid = activeExplainEntityId ? Number(activeExplainEntityId) : NaN;

  return (
    <div className="unified-explain">
      <section className="unified-explain-strip">
        <h4>Session evaluation</h4>
        <div className="eval-grid unified-mini-eval">
          <div className="eval-card">
            <span>Trace coverage</span>
            <strong>{evalSnap.traceCoveragePct}%</strong>
          </div>
          <div className="eval-card">
            <span>Live serving</span>
            <strong>{evalSnap.liveServingPct}%</strong>
          </div>
          <div className="eval-card">
            <span>Explainability</span>
            <strong>{explainData?.source === "kumo" ? "GNN attribution" : "Heuristic"}</strong>
          </div>
        </div>
        <div className="confidence-meter unified-meter">
          <div className="confidence-meter-track">
            <div
              className="confidence-meter-fill"
              style={{
                width: `${clampPercent(
                  Math.round((evalSnap.traceCoveragePct + evalSnap.liveServingPct) / 2)
                )}%`,
              }}
            />
          </div>
        </div>
      </section>

      {latestTraceMessage?.trace && (
        <section className="unified-trace-inline">
          <h4>
            <Activity size={14} /> Latest chat trace
          </h4>
          <div className="trace-meta-grid">
            <div className="trace-meta-card">
              <span>Capability</span>
              <strong>{latestTraceMessage.trace.capability.replaceAll("_", " ")}</strong>
            </div>
            <div className="trace-meta-card">
              <span>Serving</span>
              <strong>{latestTraceMessage.trace.servingMode}</strong>
            </div>
            <div className="trace-meta-card">
              <span>Steps</span>
              <strong>{latestTraceMessage.trace.steps.length}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="unified-sensitivity">
        <h4>Counterfactual / sensitivity (MVP)</h4>
        <p className="automation-sub">
          Exclude recent days from order stats for explain calls. Requires sidecar support.
        </p>
        <div className="sensitivity-controls">
          <label>
            Exclude last N days
            <input
              type="number"
              min={0}
              max={90}
              value={explainExcludeLastDays ?? ""}
              placeholder="0"
              onChange={(e) => {
                const v = e.target.value;
                setExplainExcludeLastDays(v === "" ? null : Math.min(90, Math.max(0, Number(v))));
              }}
            />
          </label>
          <button
            type="button"
            className="board-action-btn"
            disabled={!Number.isFinite(uid)}
            onClick={() => {
              if (!Number.isFinite(uid)) return;
              void loadExplain(uid, { excludeLastDays: explainExcludeLastDays ?? undefined });
            }}
          >
            Re-run explain
          </button>
        </div>
      </section>

      {explainData ? (
        <ExplainPanel data={explainData} onClose={onClose} />
      ) : (
        <div className="board-loading">
          <p>No explain payload loaded.</p>
        </div>
      )}
    </div>
  );
}
