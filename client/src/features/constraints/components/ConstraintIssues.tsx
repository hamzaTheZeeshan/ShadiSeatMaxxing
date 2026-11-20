import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useGuestStore } from "../../guests/store/guestStore";
import { useEditorStore } from "../../hall-designer/store/editorStore";
import { useConstraintStore } from "../store/constraintStore";
import { summarizeLayout } from "../utils/layoutSummary";
import { validateConstraints } from "../utils/constraintValidation";
import type { ConstraintIssue } from "../utils/constraintValidation";

const styles = {
  section: { margin: "0 0 24px", padding: 16, border: "1px solid #d1d5db", borderRadius: 10, background: "#ffffff" } satisfies CSSProperties,
  heading: { margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  ok: { margin: 0, fontSize: 14, color: "#15803d" } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  item: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#111827" } satisfies CSSProperties,
  info: { margin: "12px 0 0", fontSize: 12, color: "#6b7280" } satisfies CSSProperties,
};

function dotStyle(severity: ConstraintIssue["severity"]): CSSProperties {
  return {
    flexShrink: 0,
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: "50%",
    background: severity === "error" ? "#dc2626" : "#f59e0b",
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
              <li key={issue.id} style={styles.item}>
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