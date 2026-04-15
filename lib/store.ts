import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AnalyticsRun,
  BoardFocus,
  ChatSession,
  HandoffRecord,
  IntelligenceBoard,
  ExplainResult,
  FeedbackRecord,
  Message,
  RightPanelView,
  SidecarHealth,
} from "./types";
const PRIMARY_SIDECAR_URL =
  process.env.NEXT_PUBLIC_SIDECAR_URL ||
  process.env.NEXT_PUBLIC_KUMO_SIDECAR_URL ||
  "http://127.0.0.1:8000";

const SIDECAR_URLS = Array.from(
  new Set([
    PRIMARY_SIDECAR_URL.replace(/\/+$/, ""),
    "http://127.0.0.1:8000",
    "http://localhost:8000",
  ])
);

function buildRequestInit(init: RequestInit | undefined, timeoutMs: number): RequestInit {
  return { ...init, signal: AbortSignal.timeout(timeoutMs) };
}

async function fetchFromSidecar(
  path: string,
  init?: RequestInit,
  timeoutMs = 5000
): Promise<Response> {
  let lastError: unknown = null;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  for (const baseUrl of SIDECAR_URLS) {
    try {
      const res = await fetch(
        `${baseUrl}${normalizedPath}`,
        buildRequestInit(init, timeoutMs)
      );
      if (res.ok) return res;
      lastError = new Error(`Sidecar ${baseUrl} responded ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Sidecar not available");
}

const WELCOME_CONTENT =
  "Hey! I'm Kumo Catalyst - your retail intelligence copilot, running live predictions on the H&M dataset.\n\nThe intelligence board on your right is populated with real KumoRFM predictions. Ask me anything about your customers and products.";

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createWelcomeMessage(): Message {
  return {
    id: "welcome",
    role: "assistant",
    content: WELCOME_CONTENT,
    type: "text",
  };
}

function createInitialSession(): ChatSession {
  const now = new Date().toISOString();
  const id = newSessionId();
  return {
    id,
    title: "New chat",
    messages: [createWelcomeMessage()],
    createdAt: now,
    updatedAt: now,
  };
}

export interface StylistState {
  board: IntelligenceBoard | null;
  sessions: ChatSession[];
  activeSessionId: string;
  analyticsRuns: AnalyticsRun[];
  feedbackLog: FeedbackRecord[];
  handoffLog: HandoffRecord[];
  rightPanel: RightPanelView;
  explainData: ExplainResult | null;
  activeExplainEntityId: string | null;
  sidecarHealth: SidecarHealth | null;
  sidecarConnected: boolean;
  sidecarMode: "live" | "mock" | "degraded" | "error" | null;

  boardFocus: BoardFocus;
  explainExcludeLastDays: number | null;

  refreshHealth: () => Promise<SidecarHealth | null>;
  loadBoard: () => Promise<void>;
  addMessage: (msg: Message) => void;
  updateLastMessage: (id: string, patch: Partial<Message>) => void;
  addHandoff: (handoff: HandoffRecord) => void;
  setRightPanel: (panel: RightPanelView) => void;
  setBoardFocus: (focus: BoardFocus) => void;
  loadExplain: (
    userId: number,
    opts?: { excludeLastDays?: number | null }
  ) => Promise<void>;
  clearExplain: () => void;

  setExplainExcludeLastDays: (days: number | null) => void;

  newSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

/** Messages for the active chat thread (use in selectors). */
export function selectActiveMessages(state: StylistState): Message[] {
  const session = state.sessions.find((s) => s.id === state.activeSessionId);
  return session?.messages ?? [];
}

function mergeAnalyticsRun(message: Message, patch: Partial<Message>): AnalyticsRun | null {
  const trace = patch.trace ?? message.trace;
  const capability = patch.type ?? message.type;

  if (message.role !== "assistant" || !capability) return null;

  const latencySamples = trace?.steps
    ?.map((step) => step.latencyMs)
    .filter((latency): latency is number => typeof latency === "number" && Number.isFinite(latency));

  return {
    messageId: message.id,
    capability,
    createdAt: new Date().toISOString(),
    hasTrace: Boolean(trace),
    servingMode: trace?.servingMode,
    latencyMs:
      latencySamples && latencySamples.length > 0
        ? Math.round(latencySamples.reduce((sum, value) => sum + value, 0) / latencySamples.length)
        : null,
    resultCount: trace?.resultCount ?? null,
  };
}

function mergeFeedbackRecord(message: Message, patch: Partial<Message>): FeedbackRecord | null {
  const nextFeedback = patch.feedback;
  const trace = patch.trace ?? message.trace;
  const capability = patch.type ?? message.type ?? "text";

  if (message.role !== "assistant" || nextFeedback == null) return null;

  return {
    messageId: message.id,
    capability,
    feedback: nextFeedback,
    createdAt: new Date().toISOString(),
    servingMode: trace?.servingMode,
  };
}

const initialSession = createInitialSession();

export const useStylistStore = create<StylistState>()(
  persist(
    (set, get) => ({
      board: null,
      sessions: [initialSession],
      activeSessionId: initialSession.id,
      analyticsRuns: [],
      feedbackLog: [],
      handoffLog: [],
      rightPanel: "board",
      explainData: null,
      activeExplainEntityId: null,
      sidecarHealth: null,
      sidecarConnected: false,
      sidecarMode: null,

      boardFocus: null,
      explainExcludeLastDays: null,

      refreshHealth: async () => {
        try {
          const healthRes = await fetchFromSidecar("/health");
          const health: SidecarHealth = await healthRes.json();
          set({
            sidecarHealth: health,
            sidecarConnected: true,
            sidecarMode: health.mode ?? "live",
          });
          return health;
        } catch (err) {
          console.warn("⚠️ Health check unavailable:", err);
          set({
            sidecarHealth: null,
            sidecarConnected: false,
            sidecarMode: null,
          });
          return null;
        }
      },

      loadBoard: async () => {
        try {
          const health = await get().refreshHealth();
          if (!health?.graphLoaded) {
            return;
          }

          const boardRes = await fetchFromSidecar("/data/intelligence-board");
          const board: IntelligenceBoard = await boardRes.json();
          set({ board });
        } catch (err) {
          console.warn("⚠️ Sidecar unavailable:", err);
        }
      },

      addMessage: (msg) =>
        set((state) => {
          const idx = state.sessions.findIndex((s) => s.id === state.activeSessionId);
          if (idx < 0) return state;
          const session = state.sessions[idx];
          const nextMessages = [...session.messages, msg];
          const now = new Date().toISOString();
          let title = session.title;
          if (msg.role === "user") {
            const hadUserBefore = session.messages.some((m) => m.role === "user");
            if (!hadUserBefore) {
              const t = msg.content.trim().slice(0, 40);
              title = t.length > 0 ? t : "New chat";
            }
          }
          const nextSessions = [...state.sessions];
          nextSessions[idx] = {
            ...session,
            messages: nextMessages,
            title,
            updatedAt: now,
          };
          return { sessions: nextSessions };
        }),

      updateLastMessage: (id, patch) =>
        set((state) => {
          const sIdx = state.sessions.findIndex((s) => s.id === state.activeSessionId);
          if (sIdx < 0) return state;
          const session = state.sessions[sIdx];
          const target = session.messages.find((m) => m.id === id);
          if (!target) return state;

          const nextMessages = session.messages.map((m) =>
            m.id === id ? { ...m, ...patch } : m
          );

          const runUpdate = mergeAnalyticsRun(target, patch);
          const nextAnalyticsRuns = runUpdate
            ? [
                ...state.analyticsRuns.filter((run) => run.messageId !== id),
                runUpdate,
              ].slice(-150)
            : state.analyticsRuns;

          let nextFeedbackLog = state.feedbackLog;
          if (Object.prototype.hasOwnProperty.call(patch, "feedback")) {
            if (patch.feedback == null) {
              nextFeedbackLog = state.feedbackLog.filter((entry) => entry.messageId !== id);
            } else {
              const feedbackUpdate = mergeFeedbackRecord(target, patch);
              if (feedbackUpdate) {
                nextFeedbackLog = [
                  ...state.feedbackLog.filter((entry) => entry.messageId !== id),
                  feedbackUpdate,
                ].slice(-150);
              }
            }
          }

          const now = new Date().toISOString();
          const nextSessions = [...state.sessions];
          nextSessions[sIdx] = {
            ...session,
            messages: nextMessages,
            updatedAt: now,
          };

          return {
            ...state,
            sessions: nextSessions,
            analyticsRuns: nextAnalyticsRuns,
            feedbackLog: nextFeedbackLog,
          };
        }),

      addHandoff: (handoff) =>
        set((state) => ({
          handoffLog: [...state.handoffLog, handoff].slice(-100),
        })),

      setRightPanel: (panel) => set({ rightPanel: panel }),

      setBoardFocus: (focus) => set({ boardFocus: focus }),

      loadExplain: async (userId, opts) => {
        const excludeLastDays =
          opts?.excludeLastDays !== undefined
            ? opts.excludeLastDays
            : get().explainExcludeLastDays;
        set({ rightPanel: "explain", activeExplainEntityId: String(userId) });
        try {
          const body: Record<string, unknown> = { userId };
          if (excludeLastDays != null && excludeLastDays > 0) {
            body.exclude_last_days = excludeLastDays;
          }
          const res = await fetchFromSidecar(
            "/predict/explain",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
            10000
          );
          const data: ExplainResult = await res.json();
          if (excludeLastDays != null && excludeLastDays > 0) {
            data.appliedFilters = { ...data.appliedFilters, excludeLastDays };
            if (!data.sensitivityNote) {
              data.sensitivityNote = `Sensitivity preview: excluding roughly the last ${excludeLastDays} day(s) (demo).`;
            }
          }
          set({ explainData: data });
        } catch (err) {
          console.error("Explain load error:", err);
          set({ explainData: null });
        }
      },

      clearExplain: () =>
        set((state) => ({
          explainData: null,
          activeExplainEntityId: null,
          rightPanel: state.rightPanel === "explain" ? "board" : state.rightPanel,
        })),

      setExplainExcludeLastDays: (days) => set({ explainExcludeLastDays: days }),

      newSession: () => {
        const now = new Date().toISOString();
        const id = newSessionId();
        const session: ChatSession = {
          id,
          title: "New chat",
          messages: [createWelcomeMessage()],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: id,
          explainData: null,
          activeExplainEntityId: null,
          boardFocus: null,
          rightPanel: "board",
        }));
      },

      switchSession: (id) => {
        const exists = get().sessions.some((s) => s.id === id);
        if (!exists) return;
        set({
          activeSessionId: id,
          explainData: null,
          activeExplainEntityId: null,
          boardFocus: null,
          rightPanel: "board",
        });
      },

      deleteSession: (id) =>
        set((state) => {
          const filtered = state.sessions.filter((s) => s.id !== id);
          if (filtered.length === state.sessions.length) return state;

          if (filtered.length === 0) {
            const fresh = createInitialSession();
            return {
              sessions: [fresh],
              activeSessionId: fresh.id,
              explainData: null,
              activeExplainEntityId: null,
              boardFocus: null,
              rightPanel: "board",
            };
          }

          const sorted = [...filtered].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          let nextActive = state.activeSessionId;
          if (id === state.activeSessionId) {
            nextActive = sorted[0].id;
          } else if (!filtered.some((s) => s.id === state.activeSessionId)) {
            nextActive = sorted[0].id;
          }

          return {
            sessions: filtered,
            activeSessionId: nextActive,
            explainData: null,
            activeExplainEntityId: null,
            boardFocus: null,
            rightPanel: "board",
          };
        }),
    }),
    {
      name: "kumo-stylist-analytics",
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        feedbackLog: state.feedbackLog,
        handoffLog: state.handoffLog,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<StylistState>;
        const hasSessions = p.sessions && p.sessions.length > 0;
        const sessions = hasSessions ? (p.sessions as ChatSession[]) : current.sessions;
        const activeOk =
          p.activeSessionId &&
          sessions.some((s) => s.id === p.activeSessionId);
        return {
          ...current,
          ...p,
          sessions,
          activeSessionId: activeOk ? p.activeSessionId! : sessions[0]?.id ?? current.activeSessionId,
        };
      },
    }
  )
);
