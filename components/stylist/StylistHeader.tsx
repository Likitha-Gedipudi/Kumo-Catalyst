"use client";

import { BarChart3, FileText, Sun, Moon } from "lucide-react";

type SidecarMode = "live" | "mock" | "degraded" | "error" | null;

function reportButtonLabel(): { label: string; Icon: typeof Sun } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { label: "Morning Briefing", Icon: Sun };
  if (h >= 15 && h < 24) return { label: "End-of-Day Recap", Icon: Moon };
  return { label: "Daily Report", Icon: FileText };
}

export function StylistHeader({
  sidecarConnected,
  sidecarMode,
  floatOpen,
  onToggleFloatPanel,
  onOpenReport,
}: {
  sidecarConnected: boolean;
  sidecarMode: SidecarMode;
  floatOpen: boolean;
  onToggleFloatPanel: () => void;
  onOpenReport: () => void;
}) {
  const statusLabel = sidecarConnected
    ? `Graph ${
        sidecarMode === "degraded"
          ? "degraded"
          : sidecarMode === "error"
            ? "error"
            : "live"
      } · ${
        sidecarMode === "live"
          ? "KumoRFM"
          : sidecarMode === "degraded"
            ? "KumoRFM"
            : sidecarMode === "error"
              ? "Unavailable"
              : "Mock"
      }`
    : "Sidecar offline";

  const { label, Icon } = reportButtonLabel();

  return (
    <header className="chat-header">
      <div className="chat-logo">
        <div className="chat-logo-mark" aria-hidden>
          <svg
            className="chat-logo-svg"
            viewBox="0 0 32 32"
            width={26}
            height={26}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="chat-logo-grad"
                x1="4"
                y1="4"
                x2="28"
                y2="28"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#e91e8c" />
                <stop offset="100%" stopColor="#9b1dff" />
              </linearGradient>
            </defs>
            <path
              fill="url(#chat-logo-grad)"
              d="M24.5 14.2c-.2-3.2-2.8-5.7-6-5.7-.5 0-1 .1-1.5.2a6.8 6.8 0 0 0-12.8 3.4c-2.4.4-4.2 2.5-4.2 5 0 2.8 2.3 5.1 5.1 5.1h15.8c2.5 0 4.6-2 4.6-4.5 0-1.8-1-3.3-2.4-3.9z"
            />
          </svg>
        </div>
        <h1 className="chat-logo-title">Kumo Catalyst</h1>
      </div>
      <div className="chat-header-right">
        <div className="chat-status">
          <span
            className={`status-dot ${sidecarConnected ? "status-live" : "status-offline"}`}
          />
          <span className="status-text">{statusLabel}</span>
        </div>
        <button
          type="button"
          className="chat-header-report-btn"
          title={label}
          onClick={onOpenReport}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
        <button
          type="button"
          className="chat-header-panel-toggle"
          title={floatOpen ? "Hide board panel" : "Show board panel"}
          aria-expanded={floatOpen}
          onClick={onToggleFloatPanel}
        >
          <BarChart3 size={16} />
        </button>
      </div>
    </header>
  );
}
