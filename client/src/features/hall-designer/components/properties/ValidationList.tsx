import type { CSSProperties } from "react";
import { useEditorStore } from "../../store/editorStore";
import type { ValidationIssue } from "../../utils/validation";

const styles = {
  root: { marginTop: 16, paddingTop: 12, borderTop: "1px solid #e5e7eb" } satisfies CSSProperties,
  heading: { fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px" } satisfies CSSProperties,
  ok: { fontSize: 13, color: "#15803d" } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
    boxSizing: "border-box",
    padding: "5px 6px",
    fontSize: 12,
    textAlign: "left",
    color: "#111827",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    cursor: "pointer",
  } satisfies CSSProperties,
  dot: { flexShrink: 0, width: 8, height: 8, marginTop: 4, borderRadius: "50%" } satisfies CSSProperties,
};

const ERROR_COLOR = "#dc2626";
const WARNING_COLOR = "#d97706";

interface ValidationListProps {
  issues: ValidationIssue[];
}

export default function ValidationList({ issues }: ValidationListProps) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const grouped = [...errors, ...warnings];

  const handleClick = (issue: ValidationIssue) => {
    const id = issue.objectIds[0];
    if (id !== undefined) useEditorStore.getState().select(id);
  };

  return (
    <section style={styles.root} aria-label="Layout check">
      <h3 style={styles.heading}>Layout check</h3>
      {grouped.length === 0 ? (
        <div style={styles.ok}>No problems found.</div>
      ) : (
        <ul role="list" style={styles.list}>
          {grouped.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                style={styles.item}
                title={issue.severity === "error" ? "Error" : "Warning"}
                onClick={() => handleClick(issue)}
              >
                <span
                  aria-hidden="true"
                  style={{ ...styles.dot, background: issue.severity === "error" ? ERROR_COLOR : WARNING_COLOR }}
                />
                <span>{issue.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}