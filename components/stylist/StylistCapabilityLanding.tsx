"use client";

import { STARTER_PROMPTS, type StarterPrompt } from "@/lib/constants/prompts";

export function StylistCapabilityLanding({
  visible,
  onStarterTopic,
}: {
  visible: boolean;
  onStarterTopic: (prompt: StarterPrompt) => void;
}) {
  if (!visible) return null;

  return (
    <div className="agent-landing">
      <p className="agent-landing-title">What would you like to explore?</p>
      <div className="capability-chips">
        {STARTER_PROMPTS.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.label}
              type="button"
              className="capability-chip"
              onClick={() => onStarterTopic(p)}
            >
              <Icon size={13} />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
