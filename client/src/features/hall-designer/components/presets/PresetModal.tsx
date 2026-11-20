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

const s = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(17,24,39,0.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  } satisfies CSSProperties,
  dialog: {
    background: "#fff", borderRadius: 10, width: "min(920px, 100%)", maxHeight: "90vh",
    display: "flex", flexDirection: "column", overflow: "hidden",
    boxShadow: "0 20px 50px rgba(0,0,0,0.3)", fontFamily: "system-ui, sans-serif",
  } satisfies CSSProperties,
  header: {
    padding: "14px 20px", borderBottom: "1px solid #e5e7eb",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  } satisfies CSSProperties,
  title: { margin: 0, fontSize: 18, color: "#111827" } satisfies CSSProperties,
  grid: {
    padding: 20, overflowY: "auto", display: "grid", gap: 14,
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  } satisfies CSSProperties,
  card: {
    textAlign: "left", padding: 10, borderRadius: 8, background: "#fff",
    border: "2px solid #e5e7eb", cursor: "pointer", font: "inherit", color: "#111827",
  } satisfies CSSProperties,
  cardSelected: { borderColor: "#2563eb", background: "#eff6ff" } satisfies CSSProperties,
  cardName: { fontSize: 14, fontWeight: 600, margin: "8px 0 2px" } satisfies CSSProperties,
  meta: { fontSize: 12, color: "#4b5563", margin: "0 0 4px" } satisfies CSSProperties,
  desc: { fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.4 } satisfies CSSProperties,
  footer: {
    padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex",
    alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap",
  } satisfies CSSProperties,
  warning: {
    flex: 1, minWidth: 220, fontSize: 13, color: "#b45309", background: "#fffbeb",
    border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px",
  } satisfies CSSProperties,
  button: {
    padding: "6px 14px", fontSize: 13, border: "1px solid #d1d5db",
    borderRadius: 6, background: "#fff", color: "#111827", cursor: "pointer",
  } satisfies CSSProperties,
  primary: { background: "#2563eb", borderColor: "#2563eb", color: "#fff" } satisfies CSSProperties,
  danger: { background: "#dc2626", borderColor: "#dc2626", color: "#fff" } satisfies CSSProperties,
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
              <p style={s.meta}>
                {p.layout.hall.width} × {p.layout.hall.height} m · {p.tableCount} tables · {p.guestCount} guests
              </p>
              <p style={s.desc}>{p.description}</p>
            </button>
          ))}
        </div>

        <div style={s.footer}>
          {confirming && (
            <div style={s.warning} role="alert">
              This replaces your current layout and clears undo history. Export or Save first if you want to keep it.
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