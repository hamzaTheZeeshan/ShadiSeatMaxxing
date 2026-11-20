import { useState } from "react";
import type { CSSProperties } from "react";
import { useConstraintStore } from "../store/constraintStore";
import type { Settings } from "../types/constraintSchema";

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
    id: "elders_away_from_speakers",
    label: "Elders away from speakers",
    help: "Higher means older guests are kept further from loudspeakers.",
    read: (w) => w.elders_away_from_speakers,
    patch: (w, v) => ({ weights: { ...w, elders_away_from_speakers: v } }),
  },
  {
    id: "seniors_near_stage",
    label: "Seniors near the stage",
    help: "Higher means senior guests are placed closer to the stage.",
    read: (w) => w.seniors_near_stage,
    patch: (w, v) => ({ weights: { ...w, seniors_near_stage: v } }),
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
  section: { margin: "0 0 24px", padding: 16, border: "1px solid #d1d5db", borderRadius: 10, background: "#ffffff" } satisfies CSSProperties,
  heading: { margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  subheading: { margin: "16px 0 8px", fontSize: 14, fontWeight: 600, color: "#374151" } satisfies CSSProperties,
  row: { display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 } satisfies CSSProperties,
  label: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#111827" } satisfies CSSProperties,
  help: { margin: 0, fontSize: 13, color: "#4b5563" } satisfies CSSProperties,
  input: { width: 100, padding: "4px 8px", fontSize: 14 } satisfies CSSProperties,
  error: { margin: 0, fontSize: 13, color: "#b91c1c" } satisfies CSSProperties,
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
        style={styles.input}
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