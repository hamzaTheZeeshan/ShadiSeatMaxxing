import { useState } from "react";
import type { CSSProperties } from "react";
import { useConstraintStore } from "../store/constraintStore";
import type { Settings } from "../types/constraintSchema";

/* ---------- theme (same as constraints page) ---------- */
const INK = "#111111";
const CREAM = "#fff4dc";
const MINT = "#a8d5b5";
const WHITE = "#ffffff";
const MUTED = "#4b4b4b";
const DANGER = "#b91c1c";

interface ToggleRow {
  id: string;
  label: string;
  help: string;
  read: (s: Settings) => boolean;
  patch: (value: boolean) => Partial<Settings>;
}

interface DistanceRow {
  id: string;
  label: string;
  help: string;
  read: (s: Settings) => number;
  patch: (value: number) => Partial<Settings>;
}

interface WeightRow {
  id: string;
  label: string;
  help: string;
  read: (w: Settings["weights"]) => number;
  patch: (w: Settings["weights"], value: number) => Partial<Settings>;
}

const TOGGLES: ToggleRow[] = [
  {
    id: "households_together",
    label: "Keep households together",
    help: "Guests who share a household are seated at the same table.",
    read: (s) => s.households_together,
    patch: (v) => ({ households_together: v }),
  },
  {
    id: "enforce_gender_zones",
    label: "Enforce gender zones",
    help: "Men sit at men, family or mixed tables; women at women, family or mixed tables.",
    read: (s) => s.enforce_gender_zones,
    patch: (v) => ({ enforce_gender_zones: v }),
  },
  {
    id: "children_with_guardian",
    label: "Children sit with a guardian",
    help: "An infant or child shares a table with an adult or senior from the same household.",
    read: (s) => s.children_with_guardian,
    patch: (v) => ({ children_with_guardian: v }),
  },
  {
    id: "accessible_near_entrance",
    label: "Accessible guests near an entrance",
    help: "Guests with mobility needs sit close to an entrance or exit.",
    read: (s) => s.accessible_near_entrance,
    patch: (v) => ({ accessible_near_entrance: v }),
  },
  {
    id: "vip_near_stage",
    label: "VIPs near the stage",
    help: "VIP and chief guests sit close to the stage.",
    read: (s) => s.vip_near_stage,
    patch: (v) => ({ vip_near_stage: v }),
  },
  {
    id: "kids_table",
    label: "Prefer a kids table",
    help: "Try to seat children aged 5-12 together at one table.",
    read: (s) => s.kids_table,
    patch: (v) => ({ kids_table: v }),
  },
  {
    id: "sofas_for_seniors_only",
    label: "Sofas for seniors only",
    help: "Only senior guests may be seated on sofas. Gender zones still apply to sofas.",
    read: (s) => s.sofas_for_seniors_only,
    patch: (v) => ({ sofas_for_seniors_only: v }),
  },
];

const DISTANCES: DistanceRow[] = [
  {
    id: "accessible_max_distance_m",
    label: "Accessible guests: max distance to an entrance (m)",
    help: "How far from an entrance or exit guests with mobility needs may sit.",
    read: (s) => s.accessible_max_distance_m,
    patch: (v) => ({ accessible_max_distance_m: v }),
  },
  {
    id: "vip_max_distance_m",
    label: "VIPs: max distance to the stage (m)",
    help: "How far from the stage VIP and chief guests may sit.",
    read: (s) => s.vip_max_distance_m,
    patch: (v) => ({ vip_max_distance_m: v }),
  },
];

const WEIGHTS: WeightRow[] = [
  {
    id: "elders_near_exits",
    label: "Elders near exits",
    help: "Higher means senior guests are placed closer to entrances and exits.",
    read: (w) => w.elders_near_exits,
    patch: (w, v) => ({ weights: { ...w, elders_near_exits: v } }),
  },
  {
    id: "balance_sides",
    label: "Balance bride and groom sides",
    help: "Higher means each table mixes both families more evenly.",
    read: (w) => w.balance_sides,
    patch: (w, v) => ({ weights: { ...w, balance_sides: v } }),
  },
  {
    id: "similar_ages",
    label: "Similar ages at a table",
    help: "Higher means guests of similar age are seated together.",
    read: (w) => w.similar_ages,
    patch: (w, v) => ({ weights: { ...w, similar_ages: v } }),
  },
];

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
  subheading: {
    display: "inline-block",
    margin: "18px 0 10px",
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 700,
    background: MINT,
    border: `2px solid ${INK}`,
    color: INK,
  } satisfies CSSProperties,
  row: { display: "flex", flexDirection: "column", gap: 3, marginBottom: 14 } satisfies CSSProperties,
  label: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: INK, cursor: "pointer" } satisfies CSSProperties,
  help: { margin: 0, fontSize: 12, lineHeight: 1.5, color: MUTED } satisfies CSSProperties,
  checkbox: { width: 16, height: 16, margin: 0, accentColor: INK, cursor: "pointer", flexShrink: 0 } satisfies CSSProperties,
  range: { width: "100%", maxWidth: 320, accentColor: INK, cursor: "pointer" } satisfies CSSProperties,
  input: {
    width: 100,
    padding: "6px 8px",
    fontFamily: "inherit",
    fontSize: 12,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: CREAM,
    color: INK,
    boxSizing: "border-box",
  } satisfies CSSProperties,
  error: { margin: 0, fontSize: 12, fontWeight: 600, color: DANGER } satisfies CSSProperties,
};

interface NumberFieldProps {
  id: string;
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  onValid: (value: number) => void;
}

function NumberField({ id, label, help, value, min, max, onValid }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(text: string) {
    setDraft(text);
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n) || n < min || n > max) {
      setError(`Enter a number from ${min} to ${max}.`);
      return;
    }
    setError(null);
    onValid(n);
  }

  return (
    <div style={styles.row}>
      <label htmlFor={id} style={styles.label}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className="cp-focus"
        min={min}
        max={max}
        step={0.5}
        value={draft ?? String(value)}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => {
          setDraft(null);
          setError(null);
        }}
        aria-invalid={error !== null}
        style={{ ...styles.input, ...(error !== null ? { background: "#ff9a9a" } : null) }}
      />
      <p style={styles.help}>{help}</p>
      {error ? (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function ConstraintSettingsPanel() {
  const settings = useConstraintStore((s) => s.settings);
  const setSettings = useConstraintStore((s) => s.setSettings);

  return (
    <section style={styles.section} aria-labelledby="constraint-settings-heading">
      <h2 id="constraint-settings-heading" style={styles.heading}>
        Settings
      </h2>
      {TOGGLES.map((row) => (
        <div key={row.id} style={styles.row}>
          <label htmlFor={`setting-${row.id}`} style={styles.label}>
            <input
              id={`setting-${row.id}`}
              type="checkbox"
              className="cp-focus"
              style={styles.checkbox}
              checked={row.read(settings)}
              onChange={(e) => setSettings(row.patch(e.target.checked))}
            />
            {row.label}
          </label>
          <p style={styles.help}>{row.help}</p>
        </div>
      ))}

      <h3 style={styles.subheading}>Distances</h3>
      {DISTANCES.map((row) => (
        <NumberField
          key={row.id}
          id={`setting-${row.id}`}
          label={row.label}
          help={row.help}
          value={row.read(settings)}
          min={1}
          max={50}
          onValid={(n) => setSettings(row.patch(n))}
        />
      ))}

      <h3 style={styles.subheading}>Preferences (0 = ignore, 10 = very important)</h3>
      {WEIGHTS.map((row) => (
        <div key={row.id} style={styles.row}>
          <label htmlFor={`setting-${row.id}`} style={styles.label}>
            {row.label}: {row.read(settings.weights)}
          </label>
          <input
            id={`setting-${row.id}`}
            type="range"
            className="cp-focus"
            style={styles.range}
            min={0}
            max={10}
            step={1}
            value={row.read(settings.weights)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setSettings(row.patch(settings.weights, n));
            }}
          />
          <p style={styles.help}>{row.help}</p>
        </div>
      ))}
    </section>
  );
}