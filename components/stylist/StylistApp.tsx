"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { addToHistory, saveQuery } from "@/lib/utils/saved-queries";
import { SessionsSidebar } from "@/components/chat/SessionsSidebar";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { SavedQueriesPanel } from "@/components/SavedQueriesPanel";
import { SearchModal } from "@/components/SearchModal";
import { useStylistStore, selectActiveMessages } from "@/lib/store";
import type { BoardFocus, HandoffDestination, Message, MessageFeedback } from "@/lib/types";
import { type StarterPrompt } from "@/lib/constants/prompts";
import {
  buildDynamicStarterFollowUps,
  nextMessageId,
} from "@/lib/utils/message-helpers";
import {
  buildHandoffRecord,
  handoffSummary,
} from "@/lib/business/stylist-handoff";
import type { CloudDiscoverySnapshot } from "@/lib/chat/discovery-chips";
import { sameOriginApiUrl } from "@/lib/utils/same-origin-api";
import { chatClientErrorMessage } from "@/lib/utils/chat-client";
import { StylistHeader } from "./StylistHeader";
import { StylistComposer } from "./StylistComposer";
import { StylistCapabilityLanding } from "./StylistCapabilityLanding";
import { FloatingBoardPanel } from "./FloatingBoardPanel";
import dynamic from "next/dynamic";

const ReportModal = dynamic(
  () => import("@/components/report/ReportModal").then((m) => ({ default: m.ReportModal })),
  { ssr: false }
);

export function StylistApp() {
  const messages = useStylistStore(selectActiveMessages);
  const {
    board,
    rightPanel,
    sidecarConnected,
    sidecarMode,
    refreshHealth,
    loadBoard,
    addMessage,
    addHandoff,
    updateLastMessage,
    setRightPanel,
    setBoardFocus,
    loadExplain,
    clearExplain,
  } = useStylistStore();

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  /** 0 = intent routing, 1 = fetch / sidecar + context, 2 = narration synthesis */
  const [pipelinePhase, setPipelinePhase] = useState<0 | 1 | 2>(0);
  const [cloudDiscovery, setCloudDiscovery] = useState<CloudDiscoverySnapshot | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const floatPanelRef = useRef<HTMLDivElement>(null);

  /** Floating board/explain panel: open vs pill; position after first drag */
  const [floatOpen, setFloatOpen] = useState(false);
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    let cancelled = false;
    void fetch(sameOriginApiUrl("/api/kumo/discovery"))
      .then((r) => r.json())
      .then((data: CloudDiscoverySnapshot) => {
        if (!cancelled) setCloudDiscovery(data);
      })
      .catch(() => {
        if (!cancelled) setCloudDiscovery(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (board) return;

    const reconnectTimer = window.setInterval(() => {
      void loadBoard();
    }, 5000);

    return () => window.clearInterval(reconnectTimer);
  }, [board, loadBoard]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (input.trim()) {
          saveQuery(input.trim());
        }
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowSavedQueries(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [input]);

  const handleFloatDragStart = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("button")) return;
    e.preventDefault();
    const el = floatPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const onMove = (ev: MouseEvent) => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let nx = ev.clientX - offsetX;
      let ny = ev.clientY - offsetY;
      nx = Math.max(8, Math.min(nx, window.innerWidth - w - 8));
      ny = Math.max(8, Math.min(ny, window.innerHeight - h - 8));
      setFloatPos({ x: nx, y: ny });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleOpenBoard = useCallback(
    (focus: BoardFocus) => {
      setBoardFocus(focus);
      setRightPanel("board");
      setFloatOpen(true);
    },
    [setBoardFocus, setRightPanel]
  );

  const handleExplain = useCallback(
    async (entityId: number) => {
      const explainMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: `Why did you flag user ${entityId} as high churn risk? Walk me through it.`,
        type: "text",
      };
      addMessage(explainMsg);
      setIsTyping(true);
      setPipelinePhase(0);

      const tempId = `temp-${Date.now()}`;
      addMessage({
        id: tempId,
        role: "assistant",
        content: "",
        type: "text",
      });

      try {
        setPipelinePhase(1);
        await loadExplain(entityId);
        await refreshHealth();
        setPipelinePhase(2);

        const narRes = await fetch(sameOriginApiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: "narrate",
            message: `Why did you flag user ${entityId} as high churn risk? Walk me through it.`,
            intentData: { capability: "explain", userId: entityId },
          }),
        });
        const narData = await narRes.json().catch(() => ({}));
        if (!narRes.ok) {
          updateLastMessage(tempId, {
            content:
              typeof (narData as { error?: string }).error === "string"
                ? (narData as { error: string }).error
                : `Chat request failed (${narRes.status}).`,
            type: "text",
          });
          return;
        }
        await refreshHealth();
        updateLastMessage(tempId, {
          content:
            narData.narration ||
            "Explainability trace loaded. See the right panel for the full signal breakdown.",
          type: "explain",
          followUps: narData.followUps,
          pql: narData.pql,
          trace: narData.trace,
          feedback: null,
        });
      } catch (err) {
        console.error("Explain narrate error:", err);
        updateLastMessage(tempId, {
          content: chatClientErrorMessage(err),
          type: "text",
        });
      } finally {
        setIsTyping(false);
        setPipelinePhase(0);
      }
    },
    [addMessage, updateLastMessage, loadExplain, refreshHealth]
  );

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = overrideText ?? input;
      if (!text.trim() || isTyping) return;
      setInput("");
      addToHistory(text.trim());

      addMessage({
        id: Date.now().toString(),
        role: "user",
        content: text,
        type: "text",
      });

      setIsTyping(true);
      setPipelinePhase(0);
      const tempId = `temp-${Date.now()}`;
      addMessage({
        id: tempId,
        role: "assistant",
        content: "",
        type: "text",
      });

      try {
        const intentRes = await fetch(sameOriginApiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "intent", message: text }),
        });
        const intentData = await intentRes.json().catch(() => ({}));
        if (!intentRes.ok) {
          updateLastMessage(tempId, {
            content:
              typeof (intentData as { error?: string }).error === "string"
                ? (intentData as { error: string }).error
                : `Chat request failed (${intentRes.status}).`,
            type: "text",
            feedback: null,
          });
          return;
        }

        if (intentData.fastResponse) {
          updateLastMessage(tempId, {
            content: intentData.fastResponse,
            type: "text",
            followUps: intentData.followUps,
            trace: intentData.trace,
            feedback: null,
          });
          return;
        }

        if (intentData.intent?.capability === "explain") {
          const userId = intentData.intent.userId ?? 873;
          setPipelinePhase(1);
          updateLastMessage(tempId, {
            content: "",
          });
          await loadExplain(userId);
          setPipelinePhase(2);
          updateLastMessage(tempId, {
            content:
              "Explainability trace loaded. The right panel now shows the full signal breakdown and peer comparison for this user.",
            type: "explain",
            followUps: [
              "What actions are predicted to reduce this user's churn risk the most?",
              "Predict how this user's risk score changes if they make one more purchase",
              "Which other customers share this exact predicted churn profile?",
            ],
            trace: intentData.trace,
            feedback: null,
          });
          return;
        }

        setPipelinePhase(1);
        await new Promise((r) => window.setTimeout(r, 120));
        setPipelinePhase(2);
        const narRes = await fetch(sameOriginApiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: "narrate",
            message: text,
            intentData: intentData.intent,
          }),
        });
        const narData = await narRes.json().catch(() => ({}));
        if (!narRes.ok) {
          updateLastMessage(tempId, {
            content:
              typeof (narData as { error?: string }).error === "string"
                ? (narData as { error: string }).error
                : `Chat request failed (${narRes.status}).`,
            type: "text",
            feedback: null,
          });
          return;
        }
        await refreshHealth();
        const combinedTrace =
          intentData.trace || narData.trace
            ? {
                ...(narData.trace ?? intentData.trace),
                steps: [
                  ...((intentData.trace?.steps ?? []).filter(
                    (step: { id: string }) =>
                      !((narData.trace?.steps ?? []) as Array<{ id: string }>).some(
                        (narStep) => narStep.id === step.id
                      )
                  ) as Array<{
                    id: string;
                    label: string;
                    detail: string;
                    latencyMs?: number | null;
                    status: "ok" | "warning" | "error";
                  }>),
                  ...(narData.trace?.steps ?? []),
                ],
                warnings: Array.from(
                  new Set([
                    ...(intentData.trace?.warnings ?? []),
                    ...(narData.trace?.warnings ?? []),
                  ])
                ),
              }
            : undefined;

        updateLastMessage(tempId, {
          content:
            narData.narration ||
            "The model has surfaced results. Check the right panel.",
          type: narData.type || "text",
          data: narData.results ?? narData.data,
          item: narData.item ?? narData.article,
          itemResults: narData.itemResults ?? narData.items,
          resultLimit:
            Number.isFinite(narData.resultLimit) && narData.resultLimit > 0
              ? narData.resultLimit
              : undefined,
          pql: narData.pql,
          followUps: narData.followUps,
          trace: combinedTrace,
          feedback: null,
        });

        if (narData.type === "explain" && narData.intent?.userId) {
          const autoExplainUserId = narData.intent.userId;
          loadExplain(autoExplainUserId);
        } else {
          clearExplain();
          if (
            narData.type === "demand_forecast" ||
            narData.type === "churn_list" ||
            narData.type === "competitive_churn"
          ) {
            useStylistStore.setState((state) => ({
              board: state.board
                ? {
                    ...state.board,
                    categoryDemand:
                      narData.type === "demand_forecast"
                        ? narData.results || state.board.categoryDemand
                        : state.board.categoryDemand,
                    itemDemand:
                      narData.type === "demand_forecast"
                        ? narData.itemResults || state.board.itemDemand
                        : state.board.itemDemand,
                    churnAtRisk:
                      narData.type === "churn_list" || narData.type === "competitive_churn"
                        ? narData.results || state.board.churnAtRisk
                        : state.board.churnAtRisk,
                    timeframeDays:
                      narData.type === "demand_forecast"
                        ? narData.intent?.timeframeDays || 30
                        : state.board.timeframeDays,
                  }
                : null,
            }));
          }
          setRightPanel("board");
        }
      } catch (err) {
        console.error("Chat error:", err);
        updateLastMessage(tempId, {
          content: chatClientErrorMessage(err),
          type: "text",
        });
      } finally {
        setIsTyping(false);
        setPipelinePhase(0);
        inputRef.current?.focus();
      }
    },
    [
      input,
      isTyping,
      addMessage,
      updateLastMessage,
      loadExplain,
      refreshHealth,
      clearExplain,
      setRightPanel,
    ]
  );

  const handleStarterTopic = useCallback(
    (prompt: StarterPrompt) => {
      if (isTyping) return;
      const dynamicFollowUps = buildDynamicStarterFollowUps(prompt, board, messages);

      addMessage({
        id: nextMessageId(),
        role: "user",
        content: prompt.label,
        type: "text",
      });

      addMessage({
        id: nextMessageId(),
        role: "assistant",
        content: `${prompt.menuIntro} I’ve tailored these to the latest board context so they feel like the next step in the conversation.`,
        type: "text",
        followUps: dynamicFollowUps,
      });

      inputRef.current?.focus();
    },
    [addMessage, board, isTyping, messages]
  );

  const handleMessageFeedback = useCallback(
    (id: string, feedback: MessageFeedback) => {
      updateLastMessage(id, { feedback });
    },
    [updateLastMessage]
  );

  const handleHandoff = useCallback(
    (message: Message, destination: HandoffDestination) => {
      const handoff = buildHandoffRecord(message, destination);
      if (!handoff) return;

      addHandoff(handoff);
      addMessage({
        id: nextMessageId(),
        role: "assistant",
        content: handoffSummary(handoff),
        type: "text",
      });
    },
    [addHandoff, addMessage]
  );

  return (
    <div className="stylist-root">
      <SessionsSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="chat-panel">
        <StylistHeader
          sidecarConnected={sidecarConnected}
          sidecarMode={sidecarMode}
          floatOpen={floatOpen}
          onToggleFloatPanel={() => setFloatOpen((o) => !o)}
          onOpenReport={() => setShowReport(true)}
        />

        <div className="chat-messages" ref={scrollRef}>
          <div className="messages-inner">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onExplain={handleExplain}
                onSend={handleSend}
                onFeedback={handleMessageFeedback}
                onHandoff={handleHandoff}
                onOpenBoard={handleOpenBoard}
                cloudDiscovery={cloudDiscovery}
              />
            ))}

            <StylistCapabilityLanding
              visible={messages.length === 1 && !isTyping}
              onStarterTopic={handleStarterTopic}
            />

            {isTyping && <ThinkingIndicator phase={pipelinePhase} />}
          </div>
        </div>

        <StylistComposer
          input={input}
          onInputChange={setInput}
          onSend={() => void handleSend()}
          isTyping={isTyping}
          inputRef={inputRef}
          onOpenSavedQueries={() => setShowSavedQueries(true)}
        />
      </div>

      <FloatingBoardPanel
        floatOpen={floatOpen}
        floatPos={floatPos}
        floatPanelRef={floatPanelRef}
        rightPanel={rightPanel}
        onFloatDragStart={handleFloatDragStart}
        onMinimize={() => setFloatOpen(false)}
        onOpen={() => setFloatOpen(true)}
        onSelectBoard={() => setRightPanel("board")}
        onSelectExplain={() => setRightPanel("explain")}
        onCustomerExplain={handleExplain}
        onSend={handleSend}
        onHandoff={handleHandoff}
        onCloseExplain={clearExplain}
      />

      {showSearch && (
        <SearchModal
          onSelectQuery={(query) => {
            setInput(query);
            setShowSearch(false);
            inputRef.current?.focus();
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showSavedQueries && (
        <>
          <div
            className="saved-queries-overlay"
            onClick={() => setShowSavedQueries(false)}
          />
          <SavedQueriesPanel
            onSelectQuery={(query) => {
              setInput(query);
              setShowSavedQueries(false);
              inputRef.current?.focus();
            }}
            onClose={() => setShowSavedQueries(false)}
          />
        </>
      )}

      {showReport && (
        <ReportModal onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
