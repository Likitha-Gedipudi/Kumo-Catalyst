"use client";

import type { CategoryDemand, CustomerRisk } from "@/lib/types";
import { buildRetentionAction } from "@/lib/business/stylist-handoff";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function TrendBadge({ trend }: { trend: string }) {
  if (trend === "rising")
    return (
      <span className="trend-badge trend-rising">↑ Rising</span>
    );
  if (trend === "falling")
    return (
      <span className="trend-badge trend-falling">↓ Falling</span>
    );
  return <span className="trend-badge trend-stable">→ Stable</span>;
}

export function ChurnBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? "var(--color-risk-high)"
      : pct >= 60
        ? "var(--color-risk-mid)"
        : "var(--color-risk-low)";
  return (
    <div className="churn-bar-track">
      <div
        className="churn-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function ProductCard({
  article,
  probability,
}: {
  article: { name?: string; itemName?: string; productType?: string; category?: string };
  probability?: number;
}) {
  const articleName = article.name || article.itemName || "H&M";
  const articleType = article.productType || article.category || "";

  return (
    <div className="product-card product-card-textonly">
      <div className="product-info p-2">
        <p className="product-name text-[12px] font-semibold leading-tight text-white mb-1">
          {articleName}
        </p>
        <p className="product-type text-[9px] font-medium text-stone-400 uppercase tracking-wider">
          {articleType}
        </p>
        {probability !== undefined && (
          <p className="text-[10px] font-semibold text-kumo-pink mt-1">
            {Math.round(probability * 100)}% match
          </p>
        )}
      </div>
    </div>
  );
}

export function ChurnRow({
  customer,
  onSend,
}: {
  customer: CustomerRisk;
  onSend: (text: string) => void;
}) {
  const action = buildRetentionAction(customer);

  return (
    <div className="churn-row">
      <div className="churn-row-header">
        <div className="churn-avatar">
          {String(customer.userId).slice(-2).toUpperCase()}
        </div>
        <div className="churn-row-info">
          <p className="churn-name">{customer.name}</p>
          <p className="churn-signal">{customer.topSignal}</p>
        </div>
        <div className="churn-row-right">
          <span className="churn-pct">
            {Math.round(customer.churnProbability * 100)}%
          </span>
        </div>
      </div>
      <ChurnBar value={customer.churnProbability} />
      {customer.winBackArticle && (
        <div className="win-back-row">
          <span className="win-back-label">Win-back:</span>
          <ProductCard
            article={customer.winBackArticle}
            probability={customer.winBackArticle.purchaseProbability}
          />
        </div>
      )}
      {customer.winBackAll && customer.winBackAll.length > 1 && (
        <p className="win-back-alt text-[10px] text-stone-500 mt-1 leading-snug">
          Also ranked:{" "}
          {customer.winBackAll
            .slice(1, 4)
            .map((w) => w.name)
            .join(" · ")}
        </p>
      )}
      <button
        type="button"
        className="churn-action-btn"
        onClick={() => onSend(action.prompt)}
      >
        {action.label}
      </button>
    </div>
  );
}

export function DemandChart({
  data,
  maxBars = 6,
  showAll = false,
  onBarClick,
}: {
  data: CategoryDemand[];
  /** When showAll is false, only first maxBars rows are shown */
  maxBars?: number;
  showAll?: boolean;
  onBarClick?: (category: string) => void;
}) {
  const rows = showAll ? data : data.slice(0, maxBars);
  const height = Math.min(340, Math.max(140, rows.length * 34 + 40));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          dataKey="category"
          type="category"
          width={110}
          tick={{ fontSize: 11, fill: "var(--color-muted-fg)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(233,30,140,0.05)" }}
          contentStyle={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="demandScore"
          radius={[0, 6, 6, 0]}
          cursor={onBarClick ? "pointer" : "default"}
          onClick={(_, index) => {
            const row = rows[index];
            if (row?.category) onBarClick?.(row.category);
          }}
        >
          {rows.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.trend === "rising"
                  ? "var(--color-kumo-pink)"
                  : entry.trend === "stable"
                    ? "var(--color-kumo-pink-muted)"
                    : "var(--color-risk-low)"
              }
              opacity={1 - i * 0.06}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
