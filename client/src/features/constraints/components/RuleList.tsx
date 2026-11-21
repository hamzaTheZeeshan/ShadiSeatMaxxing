import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { optionLabel, parseOption } from "../../guests/types/guestSchema";
import { useGuestStore } from "../../guests/store/guestStore";
import { useConstraintStore } from "../store/constraintStore";
import { RULE_KINDS, RULE_STRENGTHS } from "../types/constraintSchema";
import type { RuleKind } from "../types/constraintSchema";

const PAGE_SIZE = 50;

type KindFilter = "all" | RuleKind;

/* ---------- theme (same as constraints page) ---------- */
const INK = "#111111";
const CREAM = "#fff4dc";
const WHITE = "#ffffff";
const MUTED = "#4b4b4b";
const DANGER = "#b91c1c";

const buttonBase = {
  padding: "6px 12px",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
  border: `2px solid ${INK}`,
  borderRadius: 0,
  color: INK,
} satisfies CSSProperties;

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
  toolbar: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14, fontSize: 12, fontWeight: 700 } satisfies CSSProperties,
  select: {
    padding: "6px 8px",
    fontFamily: "inherit",
    fontSize: 12,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: WHITE,
    color: INK,
    cursor: "pointer",
  } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: 10,
    background: CREAM,
    border: `2px solid ${INK}`,
    fontSize: 12,
  } satisfies CSSProperties,
  meta: { fontWeight: 700, color: INK } satisfies CSSProperties,
  guests: { margin: "4px 0", color: INK, lineHeight: 1.5 } satisfies CSSProperties,
  unknown: { color: DANGER, fontWeight: 600 } satisfies CSSProperties,
  note: { margin: 0, fontSize: 12, fontStyle: "italic", color: MUTED } satisfies CSSProperties,
  empty: { margin: 0, fontSize: 12, color: MUTED } satisfies CSSProperties,
  pager: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 14, fontSize: 12, fontWeight: 600 } satisfies CSSProperties,
  removeButton: { ...buttonBase, background: "#ff9a9a", cursor: "pointer" } satisfies CSSProperties,
  pagerButton: { ...buttonBase, background: WHITE, cursor: "pointer" } satisfies CSSProperties,
  pagerDisabled: { ...buttonBase, background: WHITE, opacity: 0.5, cursor: "not-allowed" } satisfies CSSProperties,
};

export default function RuleList() {
  const rules = useConstraintStore((s) => s.rules);
  const removeRule = useConstraintStore((s) => s.removeRule);
  const guests = useGuestStore((s) => s.guests);

  const [filter, setFilter] = useState<KindFilter>("all");
  const [page, setPage] = useState(0);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of guests) map.set(g.id, g.name);
    return map;
  }, [guests]);

  const filtered = useMemo(
    () => (filter === "all" ? rules : rules.filter((r) => r.kind === filter)),
    [rules, filter],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const prevDisabled = currentPage === 0;
  const nextDisabled = currentPage >= pageCount - 1;

  return (
    <section style={styles.section} aria-labelledby="rule-list-heading">
      <h2 id="rule-list-heading" style={styles.heading}>
        Rules ({rules.length})
      </h2>
      <div style={styles.toolbar}>
        <label htmlFor="rule-filter">Show</label>
        <select
          id="rule-filter"
          className="cp-focus"
          style={styles.select}
          value={filter}
          onChange={(e) => {
            const next = e.target.value === "all" ? "all" : parseOption(RULE_KINDS, e.target.value);
            if (next) {
              setFilter(next);
              setPage(0);
            }
          }}
        >
          <option value="all">All rules</option>
          {RULE_KINDS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p style={styles.empty}>No rules to show.</p>
      ) : (
        <ul style={styles.list}>
          {visible.map((rule) => (
            <li key={rule.id} style={styles.item}>
              <div>
                <div style={styles.meta}>
                  {optionLabel(RULE_KINDS, rule.kind)} · {optionLabel(RULE_STRENGTHS, rule.strength)}
                  {rule.strength === "prefer" ? ` · weight ${rule.weight}` : ""}
                </div>
                <div style={styles.guests}>
                  {rule.guest_ids.map((id, index) => {
                    const name = nameById.get(id);
                    return (
                      <span key={id}>
                        {index > 0 ? ", " : ""}
                        {name !== undefined ? name : <span style={styles.unknown}>Unknown guest ({id})</span>}
                      </span>
                    );
                  })}
                </div>
                {rule.note !== "" ? <p style={styles.note}>{rule.note}</p> : null}
              </div>
              <div>
                <button
                  type="button"
                  className="cp-hover cp-focus"
                  style={styles.removeButton}
                  onClick={() => removeRule(rule.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <div style={styles.pager}>
          <button
            type="button"
            className={prevDisabled ? "cp-focus" : "cp-hover cp-focus"}
            style={prevDisabled ? styles.pagerDisabled : styles.pagerButton}
            disabled={prevDisabled}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            type="button"
            className={nextDisabled ? "cp-focus" : "cp-hover cp-focus"}
            style={nextDisabled ? styles.pagerDisabled : styles.pagerButton}
            disabled={nextDisabled}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}