import type { CSSProperties } from "react";
import { useEditorStore } from "../../store/editorStore";
import type { ValidationIssue } from "../../utils/validation";

// Neo-brutalist theme, same palette as the home page.
const INK = "#111111";
const MINT = "#a8d5b5";
const CREAM = "#fff4dc";

const styles = {
  root: { marginTop: 16, paddingTop: 12, borderTop: `2px solid ${INK}` } satisfies CSSProperties,
  heading: { fontSize: 14, fontWeight: 700, color: INK, margin: "0 0 8px" } satisfies CSSProperties,
  ok: {
    display: "inline-block",
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 700,
    color: INK,
    background: MINT,
    border: `2px solid ${INK}`,
  } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
    boxSizing: "border-box",
    padding: "6px 8px",
    fontFamily: "inherit",
    fontSize: 11,
    textAlign: "left",
    color: INK,
    background: CREAM,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    cursor: "pointer",
  } satisfies CSSProperties,
  dot: {
    flexShrink: 0,
    width: 10,
    height: 10,
    marginTop: 2,
    border: `2px solid ${INK}`,
    boxSizing: "border-box",
  } satisfies CSSProperties,
};

const ERROR_COLOR = "#ff6b6b";
const WARNING_COLOR = "#f8c335";

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