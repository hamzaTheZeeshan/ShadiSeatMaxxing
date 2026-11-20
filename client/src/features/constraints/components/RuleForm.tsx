import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { parseOption } from "../../guests/types/guestSchema";
import type { Guest } from "../../guests/types/guestSchema";
import { useGuestStore } from "../../guests/store/guestStore";
import { useConstraintStore } from "../store/constraintStore";
import {
  DEFAULT_RULE_WEIGHT,
  MAX_RULES,
  NOTE_MAX_LENGTH,
  RULE_KINDS,
  RULE_STRENGTHS,
  newRuleSchema,
} from "../types/constraintSchema";
import type { RuleKind, RuleStrength } from "../types/constraintSchema";

const MAX_MATCHES = 20;

const styles = {
  section: { margin: "0 0 24px", padding: 16, border: "1px solid #d1d5db", borderRadius: 10, background: "#ffffff" } satisfies CSSProperties,
  heading: { margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12, fontSize: 14 } satisfies CSSProperties,
  field: { display: "flex", flexDirection: "column", gap: 2, fontSize: 13, color: "#374151" } satisfies CSSProperties,
  note: { width: "100%", maxWidth: 480, padding: "4px 8px", fontSize: 14, boxSizing: "border-box" } satisfies CSSProperties,
  chips: { display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" } satisfies CSSProperties,
  chip: { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: "#e5e7eb", fontSize: 13 } satisfies CSSProperties,
  chipButton: { border: "none", background: "transparent", cursor: "pointer", fontSize: 14, lineHeight: 1 } satisfies CSSProperties,
  matches: { listStyle: "none", margin: "4px 0 8px", padding: 0, maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 6 } satisfies CSSProperties,
  matchButton: { display: "block", width: "100%", textAlign: "left", padding: "6px 10px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14 } satisfies CSSProperties,
  muted: { fontSize: 13, color: "#6b7280" } satisfies CSSProperties,
  errors: { margin: "0 0 12px", paddingLeft: 18, fontSize: 13, color: "#b91c1c" } satisfies CSSProperties,
};

export default function RuleForm() {
  const guests = useGuestStore((s) => s.guests);
  const addRule = useConstraintStore((s) => s.addRule);

  const [kind, setKind] = useState<RuleKind>("together");
  const [strength, setStrength] = useState<RuleStrength>("must");
  const [weightText, setWeightText] = useState(String(DEFAULT_RULE_WEIGHT));
  const [note, setNote] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [household, setHousehold] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of guests) map.set(g.id, g.name);
    return map;
  }, [guests]);

  const households = useMemo(() => {
    const set = new Set<string>();
    for (const g of guests) if (g.household !== "") set.add(g.household);
    return [...set].sort();
  }, [guests]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const chosen = new Set(ids);
    const out: Guest[] = [];
    for (const g of guests) {
      if (chosen.has(g.id)) continue;
      if (q === "" || g.name.toLowerCase().includes(q) || g.household.toLowerCase().includes(q)) {
        out.push(g);
        if (out.length >= MAX_MATCHES) break;
      }
    }
    return out;
  }, [guests, ids, search]);

  function addHousehold() {
    if (household === "") return;
    const members = guests.filter((g) => g.household === household).map((g) => g.id);
    setIds((prev) => [...new Set([...prev, ...members])]);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const candidate = {
      kind,
      strength,
      weight: strength === "must" ? DEFAULT_RULE_WEIGHT : Number(weightText),
      guest_ids: ids,
      note,
    };
    const parsed = newRuleSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((issue) => {
          const path = issue.path.map(String).join(".");
          return path === "" ? issue.message : `${path}: ${issue.message}`;
        }),
      );
      return;
    }
    if (!addRule(parsed.data)) {
      setErrors([`Could not add the rule (limit of ${MAX_RULES} rules reached).`]);
      return;
    }
    setErrors([]);
    setIds([]);
    setSearch("");
    setNote("");
  }

  return (
    <section style={styles.section} aria-labelledby="rule-form-heading">
      <h2 id="rule-form-heading" style={styles.heading}>
        Add a rule
      </h2>
      <form onSubmit={handleSubmit}>
        <div style={styles.row}>
          <label style={styles.field}>
            Kind
            <select
              value={kind}
              onChange={(e) => {
                const next = parseOption(RULE_KINDS, e.target.value);
                if (next) setKind(next);
              }}
            >
              {RULE_KINDS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            Strength
            <select
              value={strength}
              onChange={(e) => {
                const next = parseOption(RULE_STRENGTHS, e.target.value);
                if (next) setStrength(next);
              }}
            >
              {RULE_STRENGTHS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            Weight (1-10)
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={weightText}
              disabled={strength !== "prefer"}
              onChange={(e) => setWeightText(e.target.value)}
              style={{ width: 80 }}
            />
          </label>
        </div>

        <label style={{ ...styles.field, marginBottom: 12 }}>
          Note (optional)
          <input
            type="text"
            value={note}
            maxLength={NOTE_MAX_LENGTH + 50}
            onChange={(e) => setNote(e.target.value)}
            style={styles.note}
          />
        </label>

        <div>
          <label style={styles.field}>
            Find guests by name or household
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.note}
            />
          </label>
          {guests.length === 0 ? (
            <p style={styles.muted}>No guests yet. Add guests on the Guests page first.</p>
          ) : matches.length === 0 ? (
            <p style={styles.muted}>No matching guests.</p>
          ) : (
            <ul style={styles.matches}>
              {matches.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    style={styles.matchButton}
                    onClick={() => setIds((prev) => (prev.includes(g.id) ? prev : [...prev, g.id]))}
                  >
                    {g.name}
                    {g.household !== "" ? <span style={styles.muted}> · {g.household}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={styles.row}>
          <label style={styles.field}>
            Household
            <select value={household} onChange={(e) => setHousehold(e.target.value)}>
              <option value="">Choose household…</option>
              {households.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={addHousehold} disabled={household === ""}>
            Add whole household
          </button>
        </div>

        <div style={styles.chips} aria-label="Selected guests">
          {ids.length === 0 ? <span style={styles.muted}>No guests selected.</span> : null}
          {ids.map((id) => (
            <span key={id} style={styles.chip}>
              {nameById.get(id) ?? id}
              <button
                type="button"
                aria-label={`Remove ${nameById.get(id) ?? id}`}
                style={styles.chipButton}
                onClick={() => setIds((prev) => prev.filter((x) => x !== id))}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {errors.length > 0 ? (
          <ul role="alert" style={styles.errors}>
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        ) : null}

        <button type="submit">Add rule</button>
      </form>
    </section>
  );
}