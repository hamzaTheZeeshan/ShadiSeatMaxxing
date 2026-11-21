import type { CSSProperties } from "react";

export const ACCENT = "#ff2e5b";
export const ACCENT_SOFT = "#fff1f3";
export const INK = "#1f2937";
export const MUTED = "#6b7280";
export const BORDER = "#fde2e7";

export type Tone = "good" | "bad" | "warn" | "neutral" | "info";

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  good: { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
  bad: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
  warn: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
  neutral: { bg: "#f3f4f6", fg: "#4b5563", border: "#e5e7eb" },
  info: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
};

export function badgeStyle(tone: Tone): CSSProperties {
  const t = TONES[tone];
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.border}`,
    whiteSpace: "nowrap",
  };
}

export function tabStyle(active: boolean): CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? ACCENT : BORDER}`,
    background: active ? ACCENT : "#ffffff",
    color: active ? "#ffffff" : INK,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
}

export const ui = {
  card: {
    padding: 24,
    borderRadius: 16,
    background: "#ffffff",
    border: `1px solid ${BORDER}`,
    boxShadow: "0 4px 14px rgba(255, 46, 91, 0.06)",
    marginBottom: 20,
  } satisfies CSSProperties,
  h2: { margin: "0 0 12px", fontSize: 20, fontWeight: 700 } satisfies CSSProperties,
  h3: { margin: "16px 0 8px", fontSize: 15, fontWeight: 700 } satisfies CSSProperties,
  muted: { fontSize: 13, color: MUTED } satisfies CSSProperties,
  toolbar: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 } satisfies CSSProperties,
  input: {
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    fontSize: 14,
    minWidth: 220,
  } satisfies CSSProperties,
  button: {
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    background: "#ffffff",
    color: INK,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } satisfies CSSProperties,
  tableWrap: { overflow: "auto", maxHeight: 520, border: `1px solid ${BORDER}`, borderRadius: 12 } satisfies CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 } satisfies CSSProperties,
  th: {
    position: "sticky",
    top: 0,
    textAlign: "left",
    padding: "8px 10px",
    background: ACCENT_SOFT,
    borderBottom: `1px solid ${BORDER}`,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  td: { padding: "8px 10px", borderBottom: `1px solid ${BORDER}`, verticalAlign: "top" } satisfies CSSProperties,
  chip: {
    padding: "2px 8px",
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    background: "#ffffff",
    fontSize: 12,
    cursor: "pointer",
    color: INK,
  } satisfies CSSProperties,
};