import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useGuestStore } from "../../guests/store/guestStore";
import { useEditorStore } from "../../hall-designer/store/editorStore";
import { useConstraintStore } from "../store/constraintStore";
import { summarizeLayout } from "../utils/layoutSummary";
import { validateConstraints } from "../utils/constraintValidation";
import type { ConstraintIssue } from "../utils/constraintValidation";

/* ---------- theme (same as constraints page) ---------- */
const INK = "#111111";
const MINT = "#a8d5b5";
const WHITE = "#ffffff";
const MUTED = "#4b4b4b";
const ERROR_BG = "#ff9a9a";
const WARNING_BG = "#ffd98a";

const styles = {
  section: {
    margin: "0 0 24px",
    padding: 16,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: WHITE,
    boxShadow: `4px 4px 0 ${INK}`,
    color: INK,
  } satisfies CSSProperties,
  heading: {
    margin: "0 0 14px",
    padding: "0 0 8px",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    borderBottom: `2px solid ${INK}`,
    color: INK,
  } satisfies CSSProperties,
  ok: {
    margin: 0,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 700,
    background: MINT,
    border: `2px solid ${INK}`,
    color: INK,
  } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  info: { margin: "12px 0 0", fontSize: 12, color: MUTED } satisfies CSSProperties,
};

function itemStyle(severity: ConstraintIssue["severity"]): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 10px",
    fontSize: 12,
    lineHeight: 1.5,
    color: INK,
    background: severity === "error" ? ERROR_BG : WARNING_BG,
    border: `2px solid ${INK}`,
  };
}

function dotStyle(severity: ConstraintIssue["severity"]): CSSProperties {
  return {
    flexShrink: 0,
    width: 10,
    height: 10,
    marginTop: 4,
    background: severity === "error" ? INK : WHITE,
    border: `2px solid ${INK}`,
    // Square for errors, diamond for warnings, so severity isn't conveyed by colour alone.
    transform: severity === "error" ? "none" : "rotate(45deg)",
  };
}

export default function ConstraintIssues() {
  const settings = useConstraintStore((s) => s.settings);
  const zones = useConstraintStore((s) => s.zones);
  const rules = useConstraintStore((s) => s.rules);
  const guests = useGuestStore((s) => s.guests);
  const objects = useEditorStore((s) => s.objects);

  const issues = useMemo(
    () => validateConstraints({ version: 1, settings, zones, rules }, guests, summarizeLayout(objects)),
    [settings, zones, rules, guests, objects],
  );

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <section style={styles.section} aria-labelledby="constraint-check-heading">
      <h2 id="constraint-check-heading" style={styles.heading}>
        Constraint check
      </h2>
      {issues.length === 0 ? (
        <p style={styles.ok}>No problems found.</p>
      ) : (
        <>
          <ul role="list" style={styles.list}>
            {[...errors, ...warnings].map((issue) => (
              <li key={issue.id} style={itemStyle(issue.severity)}>
                <span aria-hidden="true" style={dotStyle(issue.severity)} />
                <span>
                  <strong>{issue.severity === "error" ? "Error: " : "Warning: "}</strong>
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
          <p style={styles.info}>
            {errors.length} {errors.length === 1 ? "error" : "errors"}, {warnings.length}{" "}
            {warnings.length === 1 ? "warning" : "warnings"}. This check is informational only.
          </p>
        </>
      )}
    </section>
  );
}