"use client";

import { Check, ArrowRight } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

const STEPS = [
  {
    id: "route",
    label: "Intent",
    sub: "Routing your question",
    detail: "Classifying request type",
  },
  {
    id: "fetch",
    label: "Data",
    sub: "KumoRFM · graph queries",
    detail: "Running sidecar predictions",
  },
  {
    id: "synth",
    label: "Synthesis",
    sub: "Composing the answer",
    detail: "Narration model writing",
  },
] as const;

/** Fraction of overall progress bar to show per phase (never reaches 100 — completes on unmount) */
const PHASE_PROGRESS = [0.2, 0.6, 0.88];

export function ThinkingIndicator({ phase: rawPhase }: { phase: number }) {
  const phase = Math.min(
    2,
    Math.max(0, Math.floor(Number.isFinite(rawPhase) ? rawPhase : 0))
  ) as 0 | 1 | 2;

  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const progressPct = PHASE_PROGRESS[phase] * 100;

  return (
    <div className="thinking-row">
      <div className="thinking-comet-wrap">
        <div className="pipeline-track">

          {/* ── Header ── */}
          <div className="pipeline-hd">
            <span className="pipeline-hd-dot" />
            <span className="pipeline-hd-label">Agent processing</span>
            <span className="pipeline-hd-step">Step {phase + 1} / {STEPS.length}</span>
            <span className="pipeline-hd-timer">{mm}:{ss}</span>
          </div>

          {/* ── Progress bar ── */}
          <div className="pipeline-progress-track">
            <div
              className="pipeline-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* ── Steps ── */}
          <div className="pipeline-steps">
            {STEPS.map((step, i) => {
              const done   = i < phase;
              const active = i === phase;
              const pending = !done && !active;
              return (
                <React.Fragment key={step.id}>
                  <div className={[
                    "pipeline-step-card",
                    done    ? "pipeline-step-card--done"    : "",
                    active  ? "pipeline-step-card--active"  : "",
                    pending ? "pipeline-step-card--pending" : "",
                  ].filter(Boolean).join(" ")}>
                    <div className="pipeline-step-circle">
                      {done ? (
                        <Check size={11} strokeWidth={3} />
                      ) : active ? (
                        <span className="pipeline-step-pulse" />
                      ) : null}
                    </div>
                    <div className="pipeline-step-text-col">
                      <span className="pipeline-step-label">{step.label}</span>
                      <span className="pipeline-step-sub">{step.sub}</span>
                      {active && (
                        <span className="pipeline-step-activity">{step.detail}</span>
                      )}
                      {done && (
                        <span className="pipeline-step-done-tag">Done</span>
                      )}
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`pipeline-arrow${done ? " pipeline-arrow--filled" : ""}`}>
                      <ArrowRight size={10} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
