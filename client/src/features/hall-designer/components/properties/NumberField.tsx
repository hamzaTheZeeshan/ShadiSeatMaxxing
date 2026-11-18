import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  integer?: boolean;
  step?: number;
}

// At most 3 decimals for display; never returns "-0".
function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 1000) / 1000 + 0);
}

const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

type Validation = { ok: true; value: number } | { ok: false; error: string };

function validate(text: string, min: number | undefined, max: number | undefined, integer: boolean): Validation {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, error: "Enter a number." };
  if (!NUMBER_PATTERN.test(trimmed)) return { ok: false, error: "Enter a valid number." };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, error: "Enter a valid number." };
  if (integer && !Number.isInteger(n)) return { ok: false, error: "Must be a whole number." };
  if (min !== undefined && n < min) return { ok: false, error: `Must be at least ${formatValue(min)}.` };
  if (max !== undefined && n > max) return { ok: false, error: `Must be at most ${formatValue(max)}.` };
  return { ok: true, value: n + 0 };
}

const styles = {
  field: { display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 } satisfies CSSProperties,
  label: { fontSize: 12, color: "#374151", fontWeight: 600 } satisfies CSSProperties,
  input: {
    padding: "5px 7px",
    fontSize: 13,
    border: "1px solid #9ca3af",
    borderRadius: 4,
    background: "#ffffff",
    color: "#111827",
    width: "100%",
    boxSizing: "border-box",
  } satisfies CSSProperties,
  inputError: { border: "1px solid #dc2626", background: "#fef2f2" } satisfies CSSProperties,
  error: { fontSize: 11, color: "#b91c1c" } satisfies CSSProperties,
};

export default function NumberField({ label, value, onCommit, min, max, integer, step }: NumberFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState(() => formatValue(value));
  const [error, setError] = useState<string | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const editingRef = useRef(false);

  // Re-sync from outside changes (undo/redo, canvas drag) unless the user is typing.
  useEffect(() => {
    if (editingRef.current) return;
    setDraft(formatValue(value));
    setError(null);
  }, [value, syncTick]);

  // Returns true when there is no error (committed or unchanged).
  const attempt = (): boolean => {
    const text = draft.trim();
    if (text === formatValue(value)) {
      setError(null);
      return true; // text untouched: keep stored precision
    }
    const result = validate(text, min, max, integer === true);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    if (result.value !== value) onCommit(result.value);
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation(); // keep canvas shortcuts from firing while typing
    if (e.key === "Enter") {
      e.preventDefault();
      attempt();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(formatValue(value));
      setError(null);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && step !== undefined) {
      e.preventDefault();
      const current = Number(draft.trim());
      const base = draft.trim() !== "" && Number.isFinite(current) ? current : value;
      setDraft(formatValue(base + (e.key === "ArrowUp" ? step : -step)));
      setError(null);
    }
  };

  const handleBlur = () => {
    editingRef.current = false;
    if (attempt()) setSyncTick((t) => t + 1);
  };

  return (
    <div style={styles.field}>
      <label htmlFor={id} style={styles.label}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          editingRef.current = true;
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => e.stopPropagation()}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
        style={error !== null ? { ...styles.input, ...styles.inputError } : styles.input}
      />
      {error !== null && (
        <div id={errorId} role="alert" style={styles.error}>
          {error}
        </div>
      )}
    </div>
  );
}