"use client";

import { useState, useCallback } from "react";
import { X, Sun, Moon, FileText, Download, CheckCircle2 } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { ReportDocument } from "./ReportDocument";
import type { ReportSection } from "./ReportDocument";
import type { MessageType } from "@/lib/types";
import { sameOriginApiUrl } from "@/lib/utils/same-origin-api";

// ── Time detection ────────────────────────────────────────────────────────────
function detectReportType(): "morning" | "eod" | null {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 15 && h < 24) return "eod";
  return null;
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Question runner ───────────────────────────────────────────────────────────
async function runQuestion(question: string): Promise<ReportSection> {
  try {
    const intentRes = await fetch(sameOriginApiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "intent", message: question }),
    });
    const intentData = await intentRes.json().catch(() => ({}));
    if (!intentRes.ok) throw new Error("Intent step failed");

    // Fast-path (text response)
    if ((intentData as { fastResponse?: string }).fastResponse) {
      return {
        question,
        narrative: (intentData as { fastResponse: string }).fastResponse,
        type: "text",
      };
    }

    const narRes = await fetch(sameOriginApiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "narrate",
        message: question,
        intentData: (intentData as { intent?: unknown }).intent,
      }),
    });
    const narData = await narRes.json().catch(() => ({}));
    if (!narRes.ok) throw new Error("Narrate step failed");

    return {
      question,
      narrative:
        (narData as { narration?: string }).narration ||
        "No narration available for this question.",
      type: ((narData as { type?: string }).type as MessageType) || "text",
      data: (narData as { results?: unknown; data?: unknown }).results ??
            (narData as { data?: unknown }).data,
      pql: (narData as { pql?: string }).pql,
    };
  } catch {
    return {
      question,
      narrative:
        "Data was unavailable for this question. Check that the Kumo sidecar is running and try again.",
      type: "text",
    };
  }
}

// ── Main modal ────────────────────────────────────────────────────────────────
type Phase = "select" | "generating" | "ready";
type StepStatus = "skeleton" | "pending" | "running" | "done" | "error";

interface Step {
  question: string;
  status: StepStatus;
}

export function ReportModal({ onClose }: { onClose: () => void }) {
  const autoType = detectReportType();
  const [reportType, setReportType] = useState<"morning" | "eod">(autoType ?? "morning");
  const [phase, setPhase] = useState<Phase>("select");
  const [steps, setSteps] = useState<Step[]>([]);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const date = formatDate();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hour = new Date().getHours();

  const generate = useCallback(async () => {
    setPhase("generating");
    setError(null);

    // Show 5 skeleton placeholders immediately while fetching questions
    setSteps(Array.from({ length: 5 }, () => ({ question: "", status: "skeleton" as StepStatus })));

    // 1 — Fetch questions from Gemini
    let questions: string[];
    try {
      const res = await fetch(sameOriginApiUrl("/api/report/questions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, date, timezone, hour }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.questions)) {
        throw new Error(data.error ?? "Failed to generate questions");
      }
      questions = data.questions as string[];
    } catch (e) {
      setError(`Could not generate questions: ${e instanceof Error ? e.message : String(e)}`);
      setPhase("select");
      return;
    }

    // 2 — Initialise step list
    setSteps(questions.map((q) => ({ question: q, status: "pending" })));

    // 3 — Run each question sequentially
    const collectedSections: ReportSection[] = [];
    for (let i = 0; i < questions.length; i++) {
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s))
      );
      const section = await runQuestion(questions[i]);
      collectedSections.push(section);
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === i
            ? { ...s, status: section.narrative.startsWith("Data was unavailable") ? "error" : "done" }
            : s
        )
      );
    }

    setSections(collectedSections);
    setPhase("ready");
  }, [reportType, date, timezone, hour]);

  const downloadPdf = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await pdf(
        <ReportDocument reportType={reportType} date={date} sections={sections} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = reportType === "morning" ? "morning" : "eod";
      const fileDateSlug = new Date().toISOString().slice(0, 10);
      a.download = `kumo-${slug}-${fileDateSlug}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`PDF generation failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDownloading(false);
    }
  }, [reportType, date, sections]);

  const reset = () => {
    setPhase("select");
    setSteps([]);
    setSections([]);
    setError(null);
  };

  // ── Render ──
  return (
    <div className="report-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="report-modal">
        {/* Close */}
        <button type="button" className="report-modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        {/* ── Phase: SELECT ── */}
        {phase === "select" && (
          <>
            <div className="report-modal-header">
              <FileText size={18} className="report-modal-icon" />
              <div>
                <h2 className="report-modal-title">Daily Report</h2>
                <p className="report-modal-subtitle">{date}</p>
              </div>
            </div>

            <div className="report-type-grid">
              <button
                type="button"
                className={`report-type-card ${reportType === "morning" ? "report-type-card-active" : ""}`}
                onClick={() => setReportType("morning")}
              >
                <Sun size={22} className="report-type-icon" />
                <span className="report-type-label">Morning Briefing</span>
                <span className="report-type-desc">Plan your day — who to target, what to stock, which campaigns to run</span>
                {autoType === "morning" && (
                  <span className="report-type-badge">Recommended now</span>
                )}
              </button>

              <button
                type="button"
                className={`report-type-card ${reportType === "eod" ? "report-type-card-active" : ""}`}
                onClick={() => setReportType("eod")}
              >
                <Moon size={22} className="report-type-icon" />
                <span className="report-type-label">End-of-Day Recap</span>
                <span className="report-type-desc">Review performance — churn shifts, demand trends, actions to carry forward</span>
                {autoType === "eod" && (
                  <span className="report-type-badge">Recommended now</span>
                )}
              </button>
            </div>

            <p className="report-modal-hint">
              Kumo AI will generate 5 tailored questions, run them through KumoRFM, and compile a branded PDF report.
            </p>

            {error && <p className="report-modal-error">{error}</p>}

            <button type="button" className="report-generate-btn" onClick={generate}>
              Generate Report
            </button>
          </>
        )}

        {/* ── Phase: GENERATING ── */}
        {phase === "generating" && (
          <>
            <div className="report-modal-header">
              <FileText size={18} className="report-modal-icon" />
              <div>
                <h2 className="report-modal-title">
                  Generating {reportType === "morning" ? "Morning Briefing" : "End-of-Day Recap"}…
                </h2>
                <p className="report-modal-subtitle">
                  {steps.filter((s) => s.status === "done" || s.status === "error").length} of {steps.length || 5} questions complete
                </p>
              </div>
            </div>

            <div className="report-pipeline">
              {steps.map((step, i) => (
                <div key={i} className="report-pipeline-row">
                  {/* Left: node + connector */}
                  <div className="report-pipeline-track">
                    <div className={`report-pipeline-node report-pipeline-node-${step.status}`} />
                    {i < steps.length - 1 && (
                      <div className={`report-pipeline-line${
                        step.status === "done" ? " report-pipeline-line-done" :
                        step.status === "running" ? " report-pipeline-line-running" : ""
                      }`} />
                    )}
                  </div>
                  {/* Right: card — comet border when running */}
                  <div className={step.status === "running" ? "report-step-comet-wrap" : "report-step-plain-wrap"}>
                    <div className={`report-step-card report-step-card-${step.status}`}>
                      {step.status === "skeleton" ? (
                        <div className="report-skeleton-lines">
                          <div className="report-skeleton-line" style={{ width: "88%" }} />
                          <div className="report-skeleton-line" style={{ width: "62%", marginTop: "6px" }} />
                        </div>
                      ) : (
                        <span className="report-step-text">{step.question}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Phase: READY ── */}
        {phase === "ready" && (
          <>
            <div className="report-modal-header">
              <CheckCircle2 size={18} className="report-modal-icon" />
              <div>
                <h2 className="report-modal-title">Report Ready</h2>
                <p className="report-modal-subtitle">
                  Your {reportType === "morning" ? "Morning Briefing" : "End-of-Day Recap"} for {date}
                </p>
              </div>
            </div>

            <div className="report-sections-summary">
              {sections.map((sec, i) => (
                <div key={i} className="report-summary-row">
                  <span className="report-summary-num">{i + 1}</span>
                  <span className="report-summary-q">{sec.question}</span>
                </div>
              ))}
            </div>

            {error && <p className="report-modal-error">{error}</p>}

            <button
              type="button"
              className="report-download-btn"
              onClick={downloadPdf}
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <div className="report-gen-pulse report-gen-pulse-sm"><span /><span /><span /></div>
                  Preparing PDF…
                </>
              ) : (
                <>
                  <Download size={15} />
                  Download PDF
                </>
              )}
            </button>

            <button type="button" className="report-reset-btn" onClick={reset}>
              Generate another report
            </button>
          </>
        )}
      </div>
    </div>
  );
}
