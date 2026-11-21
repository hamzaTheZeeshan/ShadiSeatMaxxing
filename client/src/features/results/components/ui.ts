import type { CSSProperties } from "react";

/* Same palette as the Home / Constraints / Results pages. */
export const INK = "#111111";
export const CREAM = "#fff4dc";
export const MINT = "#a8d5b5";
export const PINK = "#f6b8f6";
export const WHITE = "#ffffff";
export const MUTED = "#4b4b4b";
export const BORDER = INK;
export const ACCENT = "#ff9a6b";

export const FONT = "'IBM Plex Mono', 'JetBrains Mono', 'Courier New', ui-monospace, monospace";

export type Tone = "good" | "bad" | "warn" | "info" | "neutral";

const TONE_BG: Record<Tone, string> = {
  good: MINT,
  bad: "#ff9a9a",
  warn: "#ffd0a8",
  info: "#a8d0ff",
  neutral: WHITE,
};

export function badgeStyle(tone: Tone): CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 8px",
    border: `2px solid ${INK}`,
    background: TONE_BG[tone],
    color: INK,
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.4,
  };
}

const control: CSSProperties = {
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 700,
  border: `2px solid ${INK}`,
  borderRadius: 0,
  color: INK,
};

export function tabStyle(active: boolean): CSSProperties {
  return {
    ...control,
    padding: "7px 12px",
    cursor: "pointer",
    background: active ? INK : WHITE,
    color: active ? WHITE : INK,
  };
}

export const ui = {
  card: {
    padding: 20,
    background: WHITE,
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
    marginBottom: 20,
  } satisfies CSSProperties,
  h2: { margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: INK } satisfies CSSProperties,
  h3: { margin: "18px 0 8px", fontSize: 13, fontWeight: 700, color: INK } satisfies CSSProperties,
  muted: { fontSize: 12, lineHeight: 1.55, color: MUTED } satisfies CSSProperties,
  chip: {
    ...control,
    padding: "2px 8px",
    fontSize: 11,
    background: CREAM,
    cursor: "pointer",
  } satisfies CSSProperties,
  button: {
    ...control,
    padding: "8px 14px",
    background: WHITE,
    cursor: "pointer",
  } satisfies CSSProperties,
  input: {
    ...control,
    padding: "7px 10px",
    fontWeight: 600,
    background: WHITE,
  } satisfies CSSProperties,
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  } satisfies CSSProperties,
  tableWrap: {
    overflow: "auto",
    maxHeight: 560,
    border: `2px solid ${INK}`,
    background: WHITE,
  } satisfies CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 } satisfies CSSProperties,
  th: {
    position: "sticky",
    top: 0,
    padding: "8px 10px",
    textAlign: "left",
    whiteSpace: "nowrap",
    fontWeight: 700,
    background: MINT,
    borderBottom: `2px solid ${INK}`,
  } satisfies CSSProperties,
  td: {
    padding: "8px 10px",
    verticalAlign: "top",
    borderBottom: `1px solid ${INK}`,
  } satisfies CSSProperties,
};
