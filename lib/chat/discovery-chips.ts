import type { KumoRestJob } from "@/lib/types/kumo-enterprise";
import type { BoardFocus, Message } from "@/lib/types";

export type CloudDiscoverySnapshot = {
  configured: boolean;
  kumoAppBaseUrl: string | null;
  jobs: KumoRestJob[];
  jobsSource: string;
  predictiveQueries: unknown[];
  predictiveQueriesLoaded: boolean;
};

export type DiscoveryChipAction =
  | { type: "send"; text: string }
  | { type: "board"; focus: BoardFocus }
  | { type: "open_url"; url: string };

export type DiscoveryChip = { label: string; action: DiscoveryChipAction };

/** Short-lived chips from `/api/kumo/discovery` when REST is configured or demo jobs exist */
export function buildCloudDiscoveryChips(
  snapshot: CloudDiscoverySnapshot | null | undefined
): DiscoveryChip[] {
  if (!snapshot?.jobs?.length) return [];
  const chips: DiscoveryChip[] = [];
  for (const j of snapshot.jobs.slice(0, 2)) {
    const name = j.name?.trim() || `Job ${j.id.slice(0, 8)}`;
    const short = name.length > 42 ? `${name.slice(0, 40)}…` : name;
    if (j.consoleUrl) {
      chips.push({
        label: `Open job · ${short}`,
        action: { type: "open_url", url: j.consoleUrl },
      });
    } else {
      chips.push({
        label: `Ask about · ${short}`,
        action: {
          type: "send",
          text: `Summarize Kumo Cloud job "${name}" (id ${j.id}) and its latest status.`,
        },
      });
    }
  }
  if (snapshot.predictiveQueriesLoaded && snapshot.predictiveQueries.length > 0) {
    chips.push({
      label: "Predictive queries in tenant",
      action: {
        type: "send",
        text: "What predictive queries are available in our Kumo Cloud tenant, and which look most relevant to merchandising?",
      },
    });
  }
  return chips.slice(0, 4);
}

/** Curated drill-down actions shown under in-thread result cards */
export function buildDiscoveryChips(msg: Message): DiscoveryChip[] {
  const t = msg.type;
  const out: DiscoveryChip[] = [];

  if (t === "demand_forecast" && Array.isArray(msg.data) && msg.data.length >= 2) {
    const top = msg.data[0] as { category?: string };
    const second = msg.data[1] as { category?: string };
    const a = top.category ?? "top category";
    const b = second.category ?? "second category";
    out.push({
      label: `Compare ${a} vs ${b}`,
      action: {
        type: "send",
        text: `Compare demand outlook for "${a}" versus "${b}" over the same horizon. Which should we prioritize and why?`,
      },
    });
    if (msg.itemResults && msg.itemResults.length > 0) {
      const it = msg.itemResults[0] as { itemName?: string; category?: string };
      out.push({
        label: "Top item drivers",
        action: {
          type: "send",
          text: `Which products are driving demand in "${a}"? Drill into item-level drivers for category "${it.category ?? a}".`,
        },
      });
    }
    out.push({
      label: "View on Board",
      action: { type: "board", focus: { kind: "demand", category: a } },
    });
  }

  if ((t === "churn_list" || t === "competitive_churn") && Array.isArray(msg.data) && msg.data.length > 0) {
    const first = msg.data[0] as { userId?: number };
    const uid = first.userId;
    if (uid != null) {
      out.push({
        label: `Explain user ${uid}`,
        action: {
          type: "send",
          text: `Why is user ${uid} flagged as high churn risk? Walk me through the top signals.`,
        },
      });
    }
    out.push({
      label: "More at-risk customers",
      action: {
        type: "send",
        text: "List the next set of highest churn-risk customers after this group and what differentiates them.",
      },
    });
    out.push({
      label: "View on Board",
      action: { type: "board", focus: { kind: "churn" } },
    });
  }

  if (t === "reverse_rec" && msg.item) {
    const name =
      (msg.item as { name?: string; itemName?: string }).name ??
      (msg.item as { itemName?: string }).itemName ??
      "this item";
    out.push({
      label: "Narrow audience",
      action: {
        type: "send",
        text: `For "${name}", who are the next-best prospects after the top matches?`,
      },
    });
  }

  if (t === "explain" && msg.trace?.entityId) {
    out.push({
      label: "Peer comparison",
      action: {
        type: "send",
        text: "Compare this user's risk pattern to a lower-risk peer in the same segment.",
      },
    });
  }

  return out.slice(0, 5);
}

export function mergeDiscoveryChips(
  msg: Message,
  cloud: CloudDiscoverySnapshot | null | undefined
): DiscoveryChip[] {
  const fromCloud = buildCloudDiscoveryChips(cloud);
  const local = buildDiscoveryChips(msg);
  const seen = new Set<string>();
  const out: DiscoveryChip[] = [];
  for (const c of [...fromCloud, ...local]) {
    const key = `${c.label}|${JSON.stringify(c.action)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.slice(0, 8);
}
