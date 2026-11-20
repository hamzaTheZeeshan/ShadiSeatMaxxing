import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useConstraintStore } from "../features/constraints/store/constraintStore";
import { useGuestStore } from "../features/guests/store/guestStore";
import { useEditorStore } from "../features/hall-designer/store/editorStore";
import { useSeatingStore } from "../features/seating/store/seatingStore";

const ACCENT = "#ff2e5b";
const ACCENT_SOFT = "#fff1f3";
const INK = "#1f2937";
const MUTED = "#6b7280";
const BORDER = "#fde2e7";

const styles = {
  page: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "32px 16px 48px",
    background: `linear-gradient(180deg, ${ACCENT_SOFT} 0%, #ffffff 60%)`,
    fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: INK,
  } satisfies CSSProperties,
  inner: { maxWidth: 900, margin: "0 auto" } satisfies CSSProperties,
  h1: { margin: "0 0 8px", fontSize: 34, fontWeight: 700 } satisfies CSSProperties,
  sub: { margin: "0 0 24px", fontSize: 15, color: MUTED } satisfies CSSProperties,
  card: {
    padding: 24,
    borderRadius: 16,
    background: "#ffffff",
    border: `1px solid ${BORDER}`,
    boxShadow: "0 4px 14px rgba(255, 46, 91, 0.06)",
    marginBottom: 20,
  } satisfies CSSProperties,
  summary: { display: "flex", flexWrap: "wrap", gap: 24, margin: "0 0 20px", fontSize: 14, color: MUTED } satisfies CSSProperties,
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 } satisfies CSSProperties,
  label: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: MUTED } satisfies CSSProperties,
  input: {
    width: 80,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    fontSize: 14,
  } satisfies CSSProperties,
  btnPrimary: {
    padding: "12px 24px",
    borderRadius: 10,
    border: "none",
    background: ACCENT,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(255, 46, 91, 0.3)",
  } satisfies CSSProperties,
  btnSecondary: {
    padding: "12px 24px",
    borderRadius: 10,
    border: `1px solid ${BORDER}`,
    background: "#ffffff",
    color: INK,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  } satisfies CSSProperties,
  btnDisabled: { opacity: 0.55, cursor: "not-allowed" } satisfies CSSProperties,
  warn: { margin: "16px 0 0", fontSize: 14, color: MUTED } satisfies CSSProperties,
  link: { color: ACCENT, fontWeight: 600 } satisfies CSSProperties,
  error: {
    padding: 16,
    borderRadius: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: 14,
    marginBottom: 20,
  } satisfies CSSProperties,
  errorList: { margin: "8px 0 0", paddingLeft: 20 } satisfies CSSProperties,
  pre: {
    margin: 0,
    padding: 16,
    borderRadius: 12,
    background: "#111827",
    color: "#e5e7eb",
    fontSize: 12,
    lineHeight: 1.5,
    overflow: "auto",
    maxHeight: 480,
  } satisfies CSSProperties,
};

export default function ResultsPage() {
  const guestCount = useGuestStore((s) => s.guests.length);
  const ruleCount = useConstraintStore((s) => s.rules.length);
  const objectCount = useEditorStore((s) => s.objects.length);
  const tableCount = useEditorStore((s) => s.objects.filter((o) => o.type === "table").length);

  const { status, result, error, errorDetails, solve, cancel, reset } = useSeatingStore();
  const [seconds, setSeconds] = useState(30);

  const solving = status === "solving";
  const missing: string[] = [];
  if (guestCount === 0) missing.push("add some guests");
  if (tableCount === 0) missing.push("place at least one table in the hall designer");
  const canSolve = missing.length === 0 && !solving;

  const onSolve = () => {
    const clamped = Math.min(300, Math.max(1, Number.isFinite(seconds) ? seconds : 30));
    void solve({ time_limit_seconds: clamped });
  };

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.h1}>Seating results</h1>
        <p style={styles.sub}>Generate a seating plan from your hall, guests and rules.</p>

        <section style={styles.card}>
          <div style={styles.summary}>
            <span>{guestCount} guests</span>
            <span>{tableCount} tables</span>
            <span>{objectCount} hall objects</span>
            <span>{ruleCount} rules</span>
          </div>

          <div style={styles.row}>
            <label style={styles.label}>
              Time limit (s)
              <input
                type="number"
                min={1}
                max={300}
                value={seconds}
                disabled={solving}
                onChange={(e) => setSeconds(Number(e.target.value))}
                style={styles.input}
              />
            </label>

            <button
              type="button"
              disabled={!canSolve}
              onClick={onSolve}
              style={{ ...styles.btnPrimary, ...(canSolve ? {} : styles.btnDisabled) }}
            >
              {solving ? "Solving…" : "Generate seating"}
            </button>

            {solving ? (
              <button type="button" onClick={cancel} style={styles.btnSecondary}>
                Cancel
              </button>
            ) : null}
            {status === "success" || status === "error" ? (
              <button type="button" onClick={reset} style={styles.btnSecondary}>
                Clear
              </button>
            ) : null}
          </div>

          {missing.length > 0 ? (
            <p style={styles.warn}>
              To get started, {missing.join(" and ")}.{" "}
              <Link to="/designer" style={styles.link}>
                Hall designer
              </Link>{" "}
              ·{" "}
              <Link to="/guests" style={styles.link}>
                Guests
              </Link>
            </p>
          ) : null}
        </section>

        {status === "error" && error ? (
          <div style={styles.error} role="alert">
            <strong>{error}</strong>
            {errorDetails.length > 0 ? (
              <ul style={styles.errorList}>
                {errorDetails.slice(0, 10).map((d) => (
                  <li key={d}>{d}</li>
                ))}
                {errorDetails.length > 10 ? <li>…and {errorDetails.length - 10} more</li> : null}
              </ul>
            ) : null}
          </div>
        ) : null}

        {status === "success" && result ? (
          <section style={styles.card}>
            <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>Solver output</h2>
            {/* TODO: replace with a real seating view once the response shape is typed. */}
            <pre style={styles.pre}>{JSON.stringify(result, null, 2)}</pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}