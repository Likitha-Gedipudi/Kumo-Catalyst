"use client";

import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Rect,
  Defs,
  LinearGradient,
  Stop,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { MessageType } from "@/lib/types";
import type { CategoryDemand, CustomerRisk } from "@/lib/types";

// ── Colour palette ───────────────────────────────────────────────────────────
const P = {
  bg: "#0d0d1a",
  card: "#12122a",
  cardAlt: "#0f0f22",
  border: "#1e1e3a",
  pink: "#e91e8c",
  purple: "#9b1dff",
  teal: "#22d3a8",
  fg: "#f0f0ff",
  fgSecondary: "#b0b0cc",
  muted: "#55557a",
  codeBg: "#09091a",
  codeColor: "#8888cc",
  amber: "#fbbf24",
  white: "#ffffff",
};

// ── Fonts (built-in; no remote fetch needed) ─────────────────────────────────
Font.registerHyphenationCallback((word) => [word]);

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  /* page bases */
  coverPage: { backgroundColor: P.bg, flexDirection: "column" },
  sectionPage: { backgroundColor: P.bg },
  summaryPage: { backgroundColor: P.bg },
  sectionContent: { flex: 1, paddingTop: 28, paddingBottom: 60, paddingHorizontal: 44 },
  summaryContent: { flex: 1, paddingTop: 28, paddingBottom: 60, paddingHorizontal: 44 },

  /* cover */
  coverAccentSvg: { width: "100%", height: 8 },
  coverBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 60 },
  coverLogoRow: { flexDirection: "row", alignItems: "center", marginBottom: 40 },
  coverLogoText: { fontSize: 13, color: P.muted, fontFamily: "Helvetica", letterSpacing: 2, marginLeft: 8 },
  coverTitle: { fontSize: 38, fontFamily: "Helvetica-Bold", color: P.fg, textAlign: "center", marginBottom: 14, lineHeight: 1.2 },
  coverDate: { fontSize: 14, color: P.fgSecondary, fontFamily: "Helvetica", textAlign: "center", marginBottom: 48 },
  coverBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: P.pink, borderStyle: "solid" },
  coverBadgeText: { color: P.pink, fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 1.5 },
  coverBottomBar: { height: 4, backgroundColor: P.purple },

  /* section header */
  sectionQNum: { fontSize: 9, color: P.pink, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, marginBottom: 6 },
  sectionQuestion: { fontSize: 20, color: P.fg, fontFamily: "Helvetica-Bold", lineHeight: 1.3, marginBottom: 12 },
  sectionDivider: { height: 2, width: 36, backgroundColor: P.pink, marginBottom: 16 },

  /* body text */
  narrativeText: { fontSize: 11, color: P.fgSecondary, fontFamily: "Helvetica", lineHeight: 1.75 },

  /* chart container */
  chartWrap: { marginTop: 18, backgroundColor: P.card, borderRadius: 8, padding: 16 },
  chartTitle: { fontSize: 8, color: P.muted, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, marginBottom: 12 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  barLabel: { width: 90, fontSize: 9, color: P.fgSecondary, fontFamily: "Helvetica", textAlign: "right", paddingRight: 8 },
  barTrack: { flex: 1, height: 12, backgroundColor: P.border, borderRadius: 3 },
  barFill: { height: 12, borderRadius: 3 },
  barValue: { width: 34, fontSize: 9, color: P.fg, fontFamily: "Helvetica", paddingLeft: 6 },

  /* PQL */
  pqlWrap: { marginTop: 16, backgroundColor: P.codeBg, borderRadius: 6, padding: 12, borderLeftWidth: 3, borderLeftColor: P.purple, borderLeftStyle: "solid" },
  pqlLabel: { fontSize: 8, color: P.purple, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, marginBottom: 6 },
  pqlCode: { fontSize: 9, color: P.codeColor, fontFamily: "Courier" },

  /* footer */
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 8, color: P.muted, fontFamily: "Helvetica" },
  footerPage: { fontSize: 8, color: P.muted, fontFamily: "Helvetica" },

  /* summary */
  summaryHeading: { fontSize: 22, color: P.fg, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  summarySubheading: { fontSize: 11, color: P.muted, fontFamily: "Helvetica", marginBottom: 28 },
  summaryItemWrap: { marginBottom: 18, flexDirection: "row" },
  summaryBullet: { width: 24, height: 24, borderRadius: 12, backgroundColor: P.pink, alignItems: "center", justifyContent: "center", marginRight: 12, marginTop: 2, flexShrink: 0 },
  summaryBulletText: { fontSize: 9, color: P.white, fontFamily: "Helvetica-Bold" },
  summaryItemBody: { flex: 1 },
  summaryItemQuestion: { fontSize: 10, color: P.muted, fontFamily: "Helvetica", marginBottom: 4 },
  summaryItemText: { fontSize: 11, color: P.fgSecondary, fontFamily: "Helvetica", lineHeight: 1.6 },

  /* section page top accent */
  sectionTopBar: { height: 3, backgroundColor: P.pink, marginBottom: 0 },
  sectionCapabilityBadge: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  sectionCapabilityText: { fontSize: 9, color: P.muted, fontFamily: "Helvetica", marginLeft: 4 },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function firstSentences(text: string, n = 2): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.slice(0, n).join(" ").trim();
}

const CAPABILITY_LABELS: Partial<Record<MessageType, string>> = {
  demand_forecast: "Demand Forecast",
  churn_list: "Churn Risk",
  competitive_churn: "Competitive Churn",
  reverse_rec: "Win-Back",
  cold_affinity: "Launch Audience",
};

// ── Mini bar chart (View-based, no SVG text needed) ──────────────────────────
function BarChart({
  items,
  color = P.pink,
}: {
  items: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <View>
      {items.map((item) => {
        const pct = Math.max((item.value / max) * 100, 2);
        return (
          <View key={item.label} style={s.barRow}>
            <Text style={s.barLabel}>{truncate(item.label, 13)}</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={s.barValue}>{item.value.toFixed(1)}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Accent bar (cover gradient) ───────────────────────────────────────────────
function GradientBar({ height = 8 }: { height?: number }) {
  return (
    <Svg style={{ width: "100%", height }} viewBox={`0 0 595 ${height}`}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="595" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={P.pink} />
          <Stop offset="100%" stopColor={P.purple} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="595" height={height} fill="url(#grad)" />
    </Svg>
  );
}

// ── Kumo cloud logo (SVG path from StylistHeader) ────────────────────────────
function KumoLogo({ size = 28 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 32 32" style={{ width: size, height: size }}>
      <Defs>
        <LinearGradient id="logoGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={P.pink} />
          <Stop offset="100%" stopColor={P.purple} />
        </LinearGradient>
      </Defs>
      <Rect
        x="0" y="0" width="32" height="32"
        fill="transparent"
      />
      {/* Simplified cloud shape using rectangles */}
      <Rect x="4" y="12" width="24" height="12" rx="6" fill="url(#logoGrad)" />
      <Rect x="8" y="8" width="12" height="10" rx="5" fill="url(#logoGrad)" />
    </Svg>
  );
}

// ── ReportSection type (local) ────────────────────────────────────────────────
export interface ReportSection {
  question: string;
  narrative: string;
  type: MessageType;
  data?: unknown;
  pql?: string;
}

// ── Section page ──────────────────────────────────────────────────────────────
function SectionPage({
  section,
  index,
  total,
}: {
  section: ReportSection;
  index: number;
  total: number;
}) {
  const capLabel = section.type ? (CAPABILITY_LABELS[section.type] ?? null) : null;

  // Extract chart data
  const demandItems: { label: string; value: number }[] | null =
    section.type === "demand_forecast" && Array.isArray(section.data)
      ? (section.data as CategoryDemand[])
          .slice(0, 6)
          .map((d) => ({ label: d.category ?? "?", value: d.demandScore ?? 0 }))
      : null;

  const churnItems: { label: string; value: number }[] | null =
    (section.type === "churn_list" || section.type === "competitive_churn") &&
    Array.isArray(section.data)
      ? (section.data as CustomerRisk[])
          .slice(0, 6)
          .map((c) => ({ label: c.name ?? `User ${c.userId}`, value: Math.round((c.churnProbability ?? 0) * 100) }))
      : null;

  const chartItems = demandItems ?? churnItems;
  const chartColor = demandItems ? P.pink : P.amber;
  const chartTitle = demandItems
    ? "DEMAND SCORE BY CATEGORY"
    : "CHURN PROBABILITY (%) BY CUSTOMER";

  return (
    <Page size="A4" style={s.sectionPage}>
      {/* Top accent — outside padding so it touches the page edge */}
      <GradientBar height={3} />

      <View style={s.sectionContent}>
        {/* Section number + capability badge */}
        <View style={s.sectionCapabilityBadge}>
          <Text style={s.sectionQNum}>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            {capLabel ? `  ·  ${capLabel.toUpperCase()}` : ""}
          </Text>
        </View>

        {/* Question */}
        <Text style={s.sectionQuestion}>{section.question}</Text>
        <View style={s.sectionDivider} />

        {/* Narration */}
        <Text style={s.narrativeText}>{section.narrative}</Text>

        {/* Chart */}
        {chartItems && chartItems.length > 0 && (
          <View style={s.chartWrap}>
            <Text style={s.chartTitle}>{chartTitle}</Text>
            <BarChart items={chartItems} color={chartColor} />
          </View>
        )}

        {/* PQL */}
        {section.pql && (
          <View style={s.pqlWrap}>
            <Text style={s.pqlLabel}>KUMO PQL</Text>
            <Text style={s.pqlCode}>{section.pql}</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>Kumo Catalyst · Powered by KumoRFM</Text>
        <Text style={s.footerPage}>Page {index + 2}</Text>
      </View>
    </Page>
  );
}

// ── Summary page ──────────────────────────────────────────────────────────────
function SummaryPage({ sections, pageStart }: { sections: ReportSection[]; pageStart: number }) {
  return (
    <Page size="A4" style={s.summaryPage}>
      <GradientBar height={3} />

      <View style={s.summaryContent}>
        <Text style={s.summaryHeading}>Key Actions</Text>
        <Text style={s.summarySubheading}>Recommended actions based on today&apos;s analysis</Text>

        {sections.map((sec, i) => (
          <View key={i} style={s.summaryItemWrap}>
            <View style={s.summaryBullet}>
              <Text style={s.summaryBulletText}>{i + 1}</Text>
            </View>
            <View style={s.summaryItemBody}>
              <Text style={s.summaryItemQuestion}>{truncate(sec.question, 80)}</Text>
              <Text style={s.summaryItemText}>{firstSentences(sec.narrative, 2)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>Kumo Catalyst · Powered by KumoRFM</Text>
        <Text style={s.footerPage}>Page {pageStart}</Text>
      </View>
    </Page>
  );
}

// ── Root document ─────────────────────────────────────────────────────────────
export function ReportDocument({
  reportType,
  date,
  sections,
}: {
  reportType: "morning" | "eod";
  date: string;
  sections: ReportSection[];
}) {
  const title = reportType === "morning" ? "Morning Briefing" : "End-of-Day Recap";

  return (
    <Document
      title={`Kumo ${title} — ${date}`}
      author="Kumo Catalyst"
      creator="KumoRFM"
    >
      {/* ── Cover ── */}
      <Page size="A4" style={s.coverPage}>
        <GradientBar height={8} />

        <View style={s.coverBody}>
          {/* Logo */}
          <View style={s.coverLogoRow}>
            <KumoLogo size={32} />
            <Text style={s.coverLogoText}>KUMO CATALYST</Text>
          </View>

          {/* Title */}
          <Text style={s.coverTitle}>{title}</Text>
          <Text style={s.coverDate}>{date}</Text>

          {/* Badge */}
          <View style={s.coverBadge}>
            <Text style={s.coverBadgeText}>POWERED BY KUMO RFM</Text>
          </View>
        </View>

        <View style={s.coverBottomBar} />
      </Page>

      {/* ── Sections ── */}
      {sections.map((sec, i) => (
        <SectionPage key={i} section={sec} index={i} total={sections.length} />
      ))}

      {/* ── Summary ── */}
      <SummaryPage sections={sections} pageStart={sections.length + 2} />
    </Document>
  );
}
