"use client";

import { BarChart3, Search, Minimize2 } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import { IntelligenceBoard } from "@/components/panels/IntelligenceBoard";
import { UnifiedExplainView } from "@/components/explain/UnifiedExplainView";
import type { HandoffDestination, Message, RightPanelView } from "@/lib/types";

export function FloatingBoardPanel({
  floatOpen,
  floatPos,
  floatPanelRef,
  rightPanel,
  onFloatDragStart,
  onMinimize,
  onOpen,
  onSelectBoard,
  onSelectExplain,
  onCustomerExplain,
  onSend,
  onHandoff,
  onCloseExplain,
}: {
  floatOpen: boolean;
  floatPos: { x: number; y: number } | null;
  floatPanelRef: RefObject<HTMLDivElement | null>;
  rightPanel: RightPanelView;
  onFloatDragStart: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onMinimize: () => void;
  onOpen: () => void;
  onSelectBoard: () => void;
  onSelectExplain: () => void;
  onCustomerExplain: (entityId: number) => void;
  onSend: (overrideText?: string) => void;
  onHandoff: (message: Message, destination: HandoffDestination) => void;
  onCloseExplain: () => void;
}) {
  if (floatOpen) {
    return (
      <div
        ref={floatPanelRef}
        className={`float-panel ${floatPos == null ? "float-panel--anchored" : ""}`}
        style={
          floatPos
            ? { left: floatPos.x, top: floatPos.y, right: "auto", bottom: "auto" }
            : undefined
        }
      >
        <div className="float-panel-handle" onMouseDown={onFloatDragStart}>
          <div className="float-panel-tabs">
            <button
              type="button"
              className={`float-tab ${rightPanel === "board" ? "float-tab-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBoard();
              }}
            >
              <BarChart3 size={13} />
              Board
            </button>
            <button
              type="button"
              className={`float-tab ${rightPanel === "explain" ? "float-tab-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectExplain();
              }}
            >
              <Search size={13} />
              Explain
            </button>
          </div>
          <div className="float-panel-actions">
            <button
              type="button"
              className="float-panel-min-btn"
              title="Minimize"
              aria-label="Minimize panel"
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
            >
              <Minimize2 size={14} />
            </button>
          </div>
        </div>

        <div className="float-panel-scroll">
          {rightPanel === "board" ? (
            <IntelligenceBoard
              onCustomerExplain={onCustomerExplain}
              onSend={onSend}
              onHandoff={onHandoff}
            />
          ) : (
            <UnifiedExplainView onClose={onCloseExplain} />
          )}
        </div>

        <div className="float-panel-footer">
          <span>KumoRFM · H&M Dataset</span>
          <span>© Kumo AI</span>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="float-panel-pill" onClick={onOpen}>
      <BarChart3 size={14} />
      {rightPanel === "board" ? "Board" : "Explain"}
    </button>
  );
}
