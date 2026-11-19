import { useState } from "react";
import type { CSSProperties } from "react";
import {
  AGE_BANDS,
  DIETARY_OPTIONS,
  GENDERS,
  HOUSEHOLD_MAX_LENGTH,
  MOBILITY_LEVELS,
  ROLES,
  SIDES,
  VIP_LEVELS,
  parseOption,
} from "../types/guestSchema";
import type {
  AgeBand,
  DietaryOption,
  EnumOption,
  Gender,
  MobilityLevel,
  NewGuest,
  Role,
  Side,
  VipLevel,
} from "../types/guestSchema";

interface GuestBulkBarProps {
  selectedCount: number;
  onApply: (patch: Partial<NewGuest>) => void;
  onRemove: () => void;
  onClear: () => void;
}

type Choice<T extends string> = T | "";

const styles = {
  bar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: 12,
    background: "#fffbeb",
    border: "1px solid #fcd34d",
    borderRadius: 10,
  } satisfies CSSProperties,
  input: {
    padding: "6px 8px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    fontFamily: "inherit",
  } satisfies CSSProperties,
  button: {
    padding: "6px 12px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
  } satisfies CSSProperties,
  primary: {
    padding: "6px 12px",
    fontSize: 13,
    border: "1px solid #111827",
    borderRadius: 6,
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
  } satisfies CSSProperties,
  danger: {
    padding: "6px 12px",
    fontSize: 13,
    border: "1px solid #b91c1c",
    borderRadius: 6,
    background: "#ffffff",
    color: "#b91c1c",
    cursor: "pointer",
  } satisfies CSSProperties,
  count: { fontSize: 13, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
};

interface ChoiceSelectProps<T extends string> {
  label: string;
  value: Choice<T>;
  options: ReadonlyArray<EnumOption<T>>;
  onChange: (value: Choice<T>) => void;
}

function ChoiceSelect<T extends string>({ label, value, options, onChange }: ChoiceSelectProps<T>) {
  return (
    <select
      aria-label={label}
      value={value}
      style={styles.input}
      onChange={(e) => onChange(parseOption(options, e.target.value) ?? "")}
    >
      <option value="">{`${label}: No change`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function GuestBulkBar({ selectedCount, onApply, onRemove, onClear }: GuestBulkBarProps) {
  const [side, setSide] = useState<Choice<Side>>("");
  const [gender, setGender] = useState<Choice<Gender>>("");
  const [ageBand, setAgeBand] = useState<Choice<AgeBand>>("");
  const [role, setRole] = useState<Choice<Role>>("");
  const [vip, setVip] = useState<Choice<VipLevel>>("");
  const [mobility, setMobility] = useState<Choice<MobilityLevel>>("");
  const [dietary, setDietary] = useState<Choice<DietaryOption>>("");
  const [household, setHousehold] = useState("");
  const [setHouseholdChecked, setSetHouseholdChecked] = useState(false);

  if (selectedCount <= 0) return null;

  const buildPatch = (): Partial<NewGuest> => {
    const patch: Partial<NewGuest> = {};
    if (side !== "") patch.side = side;
    if (gender !== "") patch.gender = gender;
    if (ageBand !== "") patch.age_band = ageBand;
    if (role !== "") patch.role = role;
    if (vip !== "") patch.vip = vip;
    if (mobility !== "") patch.mobility = mobility;
    if (dietary !== "") patch.dietary = dietary;
    if (setHouseholdChecked) patch.household = household;
    return patch;
  };

  const hasChange = Object.keys(buildPatch()).length > 0;

  const resetFields = () => {
    setSide("");
    setGender("");
    setAgeBand("");
    setRole("");
    setVip("");
    setMobility("");
    setDietary("");
    setHousehold("");
    setSetHouseholdChecked(false);
  };

  const handleApply = () => {
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) return;
    onApply(patch);
    resetFields();
  };

  const handleRemove = () => {
    if (window.confirm(`Remove ${selectedCount} selected guest${selectedCount === 1 ? "" : "s"}?`)) onRemove();
  };

  return (
    <div style={styles.bar} role="group" aria-label="Bulk edit selected guests">
      <span style={styles.count}>{selectedCount} selected</span>
      <ChoiceSelect label="Side" value={side} options={SIDES} onChange={setSide} />
      <ChoiceSelect label="Gender" value={gender} options={GENDERS} onChange={setGender} />
      <ChoiceSelect label="Age band" value={ageBand} options={AGE_BANDS} onChange={setAgeBand} />
      <ChoiceSelect label="Role" value={role} options={ROLES} onChange={setRole} />
      <ChoiceSelect label="VIP" value={vip} options={VIP_LEVELS} onChange={setVip} />
      <ChoiceSelect label="Mobility" value={mobility} options={MOBILITY_LEVELS} onChange={setMobility} />
      <ChoiceSelect label="Dietary" value={dietary} options={DIETARY_OPTIONS} onChange={setDietary} />
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="checkbox"
          checked={setHouseholdChecked}
          onChange={(e) => setSetHouseholdChecked(e.target.checked)}
        />
        Set household
      </label>
      <input
        type="text"
        aria-label="Household"
        placeholder="Household (empty clears it)"
        value={household}
        maxLength={HOUSEHOLD_MAX_LENGTH}
        disabled={!setHouseholdChecked}
        style={styles.input}
        onChange={(e) => setHousehold(e.target.value)}
      />
      <button type="button" style={styles.primary} disabled={!hasChange} onClick={handleApply}>
        Apply
      </button>
      <button type="button" style={styles.danger} onClick={handleRemove}>
        Remove selected
      </button>
      <button type="button" style={styles.button} onClick={onClear}>
        Clear selection
      </button>
    </div>
  );
}