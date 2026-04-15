"use client";

import { ChevronLeft, ChevronRight, MessageSquarePlus, Trash2 } from "lucide-react";
import { useStylistStore } from "@/lib/store";
import type { ChatSession } from "@/lib/types";

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const d = Date.now() - t;
  const sec = Math.floor(d / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SessionsSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const sessions = useStylistStore((s) => s.sessions);
  const activeSessionId = useStylistStore((s) => s.activeSessionId);
  const newSession = useStylistStore((s) => s.newSession);
  const switchSession = useStylistStore((s) => s.switchSession);
  const deleteSession = useStylistStore((s) => s.deleteSession);

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <aside
      className={`sessions-sidebar ${collapsed ? "sessions-sidebar--collapsed" : ""}`}
      aria-label="Chat history"
    >
      <div className="sessions-sidebar-header">
        {!collapsed && <span className="sessions-sidebar-title">Chats</span>}
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div className="sessions-sidebar-inner">
        {collapsed ? (
          <button
            type="button"
            className="session-new-btn session-new-btn--icon-only"
            title="New chat"
            onClick={() => newSession()}
          >
            <MessageSquarePlus size={17} />
          </button>
        ) : (
          <button
            type="button"
            className="session-new-btn"
            onClick={() => newSession()}
          >
            <MessageSquarePlus size={15} />
            <span>New chat</span>
          </button>
        )}

        <div className="session-list-wrap">
          <ul className="session-list" role="list">
            {sorted.map((session: ChatSession) => (
              <li key={session.id}>
                <div
                  className={`session-item ${session.id === activeSessionId ? "session-item--active" : ""}`}
                >
                  {collapsed ? (
                    <button
                      type="button"
                      className="session-item-dot"
                      title={session.title}
                      aria-current={session.id === activeSessionId ? "true" : undefined}
                      onClick={() => switchSession(session.id)}
                    >
                      <span className="session-item-dot-inner" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="session-item-main"
                        title={session.title}
                        onClick={() => switchSession(session.id)}
                      >
                        <span className="session-item-title">{session.title}</span>
                        <span className="session-item-time">
                          {formatRelativeTime(session.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="session-delete-btn"
                        title="Delete chat"
                        aria-label={`Delete ${session.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
