"use client";

import { Sparkles, Loader2, Bookmark } from "lucide-react";
import type { RefObject } from "react";

export function StylistComposer({
  input,
  onInputChange,
  onSend,
  isTyping,
  inputRef,
  onOpenSavedQueries,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isTyping: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onOpenSavedQueries: () => void;
}) {
  return (
    <div className="chat-input-wrap">
      <div className="agent-input-wrap">
        <button
          type="button"
          onClick={onOpenSavedQueries}
          className="chat-action-btn chat-action-btn--inline"
          title="Saved queries"
        >
          <Bookmark size={13} />
        </button>
        <span className="input-tool-divider" aria-hidden />
        <input
          ref={inputRef}
          className="agent-input-field"
          placeholder="Ask about your customers, products, or inventory…"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          disabled={isTyping}
        />
        <button
          className="agent-run-btn"
          onClick={() => onSend()}
          disabled={!input.trim() || isTyping}
          type="button"
        >
          {isTyping ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>{isTyping ? "Running…" : "Run"}</span>
        </button>
      </div>
    </div>
  );
}
