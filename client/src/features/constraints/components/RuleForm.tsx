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

/* ---------- theme (same as constraints page) ---------- */
const INK = "#111111";
const CREAM = "#fff4dc";
const MINT = "#a8d5b5";
const PINK = "#f6b8f6";
const WHITE = "#ffffff";
const MUTED = "#4b4b4b";
const DANGER = "#b91c1c";

const control = {
  padding: "6px 8px",
  fontFamily: "inherit",
  fontSize: 12,
  border: `2px solid ${INK}`,
  borderRadius: 0,
  background: WHITE,
  color: INK,
  boxSizing: "border-box",
} satisfies CSSProperties;

const buttonBase = {
  padding: "8px 14px",
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
  row: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 14, fontSize: 12 } satisfies CSSProperties,
  field: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: INK } satisfies CSSProperties,
  control,
  note: { ...control, width: "100%", maxWidth: 480, background: CREAM } satisfies CSSProperties,
  weight: { ...control, width: 80, background: CREAM } satisfies CSSProperties,
  chips: { display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 14px" } satisfies CSSProperties,
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 8px",
    background: PINK,
    border: `2px solid ${INK}`,
    fontSize: 12,
    fontWeight: 600,
  } satisfies CSSProperties,
  chipButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
    padding: 0,
    color: INK,
  } satisfies CSSProperties,
  matches: {
    listStyle: "none",
    margin: "8px 0 14px",
    padding: 0,
    maxHeight: 200,
    overflowY: "auto",
    border: `2px solid ${INK}`,
    background: CREAM,
  } satisfies CSSProperties,
  matchButton: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "7px 10px",
    border: "none",
    borderBottom: `1px solid ${INK}`,
    background: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
    color: INK,
  } satisfies CSSProperties,
  muted: { fontSize: 12, color: MUTED } satisfies CSSProperties,
  errors: {
    margin: "0 0 14px",
    padding: "8px 10px 8px 26px",
    fontSize: 12,
    fontWeight: 600,
    color: DANGER,
    background: "#ffe3e3",
    border: `2px solid ${INK}`,
  } satisfies CSSProperties,
  addButton: { ...buttonBase, background: INK, color: WHITE, cursor: "pointer" } satisfies CSSProperties,
  secondaryButton: { ...buttonBase, background: MINT, cursor: "pointer" } satisfies CSSProperties,
  secondaryDisabled: { ...buttonBase, background: WHITE, opacity: 0.5, cursor: "not-allowed" } satisfies CSSProperties,
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

  const weightDisabled = strength !== "prefer";

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
              className="cp-focus"
              style={styles.control}
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
              className="cp-focus"
              style={styles.control}
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
              className="cp-focus"
              min={1}
              max={10}
              step={1}
              value={weightText}
              disabled={weightDisabled}
              onChange={(e) => setWeightText(e.target.value)}
              style={{ ...styles.weight, ...(weightDisabled ? { opacity: 0.5, cursor: "not-allowed" } : null) }}
            />
          </label>
        </div>

        <label style={{ ...styles.field, marginBottom: 14 }}>
          Note (optional)
          <input
            type="text"
            className="cp-focus"
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
              className="cp-focus"
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
                    className="cp-navlink cp-focus"
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
            <select
              className="cp-focus"
              style={styles.control}
              value={household}
              onChange={(e) => setHousehold(e.target.value)}
            >
              <option value="">Choose household…</option>
              {households.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={household === "" ? "cp-focus" : "cp-hover cp-focus"}
            style={household === "" ? styles.secondaryDisabled : styles.secondaryButton}
            onClick={addHousehold}
            disabled={household === ""}
          >
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
                className="cp-focus"
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

        <button type="submit" className="cp-hover cp-focus" style={styles.addButton}>
          Add rule
        </button>
      </form>
    </section>
  );
}