import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { optionLabel, parseOption } from "../../guests/types/guestSchema";
import { useGuestStore } from "../../guests/store/guestStore";
import { useConstraintStore } from "../store/constraintStore";
import { RULE_KINDS, RULE_STRENGTHS } from "../types/constraintSchema";
import type { RuleKind } from "../types/constraintSchema";

const PAGE_SIZE = 50;

type KindFilter = "all" | RuleKind;

const styles = {
  section: { margin: "0 0 24px", padding: 16, border: "1px solid #d1d5db", borderRadius: 10, background: "#ffffff" } satisfies CSSProperties,
  heading: { margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  toolbar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12, fontSize: 14 } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  item: { display: "flex", justifyContent: "space-between", gap: 12, padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14 } satisfies CSSProperties,
  meta: { fontWeight: 600, color: "#111827" } satisfies CSSProperties,
  guests: { margin: "2px 0", color: "#374151" } satisfies CSSProperties,
  unknown: { color: "#b91c1c" } satisfies CSSProperties,
  note: { margin: 0, fontSize: 13, color: "#6b7280" } satisfies CSSProperties,
  empty: { margin: 0, fontSize: 14, color: "#4b5563" } satisfies CSSProperties,
  pager: { display: "flex", alignItems: "center", gap: 12, marginTop: 12, fontSize: 14 } satisfies CSSProperties,
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

  return (
    <section style={styles.section} aria-labelledby="rule-list-heading">
      <h2 id="rule-list-heading" style={styles.heading}>
        Rules ({rules.length})
      </h2>
      <div style={styles.toolbar}>
        <label htmlFor="rule-filter">Show</label>
        <select
          id="rule-filter"
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
                <button type="button" onClick={() => removeRule(rule.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <div style={styles.pager}>
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {pageCount}
          </span>
          <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}