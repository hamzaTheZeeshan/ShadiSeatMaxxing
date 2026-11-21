import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { HALL_PRESETS } from "../../utils/presetLayouts";
import type { HallPreset } from "../../utils/presetLayouts";
import PresetPreview from "./PresetPreview";

interface Props {
  open: boolean;
  /** true when the canvas already contains objects */
  hasObjects: boolean;
  onClose: () => void;
  onApply: (preset: HallPreset) => void;
}

// Neo-brutalist theme, same palette as the home page.
const INK = "#111111";
const CREAM = "#fff4dc";
const MINT = "#a8d5b5";
const YELLOW = "#f8c335";
const FONT = "'IBM Plex Mono', 'JetBrains Mono', 'Courier New', ui-monospace, monospace";

const s = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(17,17,17,0.55)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  } satisfies CSSProperties,
  dialog: {
    background: CREAM, borderRadius: 0, width: "min(920px, 100%)", maxHeight: "90vh",
    display: "flex", flexDirection: "column", overflow: "hidden",
    border: `2px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, fontFamily: FONT, color: INK,
  } satisfies CSSProperties,
  header: {
    padding: "14px 20px", borderBottom: `2px solid ${INK}`, background: MINT,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  } satisfies CSSProperties,
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: INK } satisfies CSSProperties,
  grid: {
    padding: 20, overflowY: "auto", display: "grid", gap: 20,
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  } satisfies CSSProperties,
  card: {
    textAlign: "left", padding: 10, borderRadius: 0, background: "#fff",
    border: `2px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`,
    cursor: "pointer", font: "inherit", color: INK,
    display: "flex", flexDirection: "column", gap: 8,
  } satisfies CSSProperties,
  cardSelected: { background: YELLOW } satisfies CSSProperties,
  cardName: { fontSize: 14, fontWeight: 700, margin: "2px 0 0" } satisfies CSSProperties,
  stats: { display: "flex", gap: 6, flexWrap: "wrap" } satisfies CSSProperties,
  chip: {
    fontSize: 11, fontWeight: 700, padding: "2px 8px",
    border: `2px solid ${INK}`, background: CREAM, whiteSpace: "nowrap",
  } satisfies CSSProperties,
  desc: {
    fontSize: 11, color: "#4b4b4b", margin: 0, lineHeight: 1.5,
    display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden",
  } satisfies CSSProperties,
  footer: {
    padding: "12px 20px", borderTop: `2px solid ${INK}`, background: MINT, display: "flex",
    alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap",
  } satisfies CSSProperties,
  warning: {
    flex: 1, minWidth: 220, fontSize: 12, fontWeight: 600, color: INK, background: YELLOW,
    border: `2px solid ${INK}`, borderRadius: 0, padding: "6px 10px",
  } satisfies CSSProperties,
  button: {
    padding: "7px 14px", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
    border: `2px solid ${INK}`, borderRadius: 0, background: "#fff", color: INK, cursor: "pointer",
  } satisfies CSSProperties,
  primary: { background: INK, color: "#fff", boxShadow: "3px 3px 0 rgba(17,17,17,0.35)" } satisfies CSSProperties,
  danger: { background: "#ff6b6b", color: INK, boxShadow: `3px 3px 0 ${INK}` } satisfies CSSProperties,
};

export default function PresetModal({ open, hasObjects, onClose, onApply }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setConfirming(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selected = HALL_PRESETS.find((p) => p.id === selectedId) ?? null;

  const handleUse = () => {
    if (!selected) return;
    if (hasObjects && !confirming) {
      setConfirming(true);
      return;
    }
    onApply(selected);
  };

  return (
    <div style={s.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.dialog} role="dialog" aria-modal="true" aria-labelledby="preset-title">
        <div style={s.header}>
          <h2 id="preset-title" style={s.title}>Hall presets</h2>
          <button type="button" style={s.button} onClick={onClose} aria-label="Close presets">✕</button>
        </div>

        <div style={s.grid}>
          {HALL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === selectedId}
              style={{ ...s.card, ...(p.id === selectedId ? s.cardSelected : null) }}
              onClick={() => { setSelectedId(p.id); setConfirming(false); }}
              onDoubleClick={() => { setSelectedId(p.id); if (!hasObjects) onApply(p); }}
            >
              <PresetPreview preset={p} />
              <p style={s.cardName}>{p.name}</p>
              <div style={s.stats}>
                <span style={s.chip}>{p.layout.hall.width} × {p.layout.hall.height} m</span>
                <span style={s.chip}>{p.guestCount} seats</span>
              </div>
              <p style={s.desc}>{p.description}</p>
            </button>
          ))}
        </div>

        <div style={s.footer}>
          {confirming && (
            <div style={s.warning} role="alert">
              This replaces your current layout. Save or export first to keep it.
            </div>
          )}
          <button type="button" style={s.button} onClick={confirming ? () => setConfirming(false) : onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            style={{
              ...s.button,
              ...(confirming ? s.danger : s.primary),
              opacity: selected ? 1 : 0.5,
              cursor: selected ? "pointer" : "not-allowed",
            }}
            onClick={handleUse}
          >
            {confirming ? "Replace layout" : "Use this preset"}
          </button>
        </div>
      </div>
    </div>
  );
}