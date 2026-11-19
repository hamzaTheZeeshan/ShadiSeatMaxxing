import { useId, useRef, useState } from "react";
import type { CSSProperties, FormEvent, RefObject } from "react";
import {
  AGE_BANDS,
  DEFAULT_GUEST_FIELDS,
  DIETARY_OPTIONS,
  GENDERS,
  HOUSEHOLD_MAX_LENGTH,
  MAX_GUESTS,
  MOBILITY_LEVELS,
  NAME_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  ROLES,
  SIDES,
  VIP_LEVELS,
  newGuestSchema,
  parseOption,
} from "../types/guestSchema";
import type { EnumOption, NewGuest } from "../types/guestSchema";

interface GuestFormProps {
  onAdd: (g: NewGuest) => boolean;
}

type FieldErrors = Partial<Record<keyof NewGuest, string>>;

const FIELD_NAMES: ReadonlyArray<keyof NewGuest> = [
  "name",
  "household",
  "side",
  "gender",
  "age_band",
  "role",
  "vip",
  "mobility",
  "dietary",
  "notes",
];

function isFieldName(key: PropertyKey): key is keyof NewGuest {
  return FIELD_NAMES.some((name) => name === key);
}

const EMPTY_DRAFT: NewGuest = { name: "", ...DEFAULT_GUEST_FIELDS };

const styles = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
  } satisfies CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
  } satisfies CSSProperties,
  field: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 } satisfies CSSProperties,
  label: { fontSize: 13, fontWeight: 600, color: "#111827" } satisfies CSSProperties,
  input: {
    padding: "7px 9px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  } satisfies CSSProperties,
  inputError: { borderColor: "#b91c1c" } satisfies CSSProperties,
  error: { margin: 0, fontSize: 12, color: "#b91c1c" } satisfies CSSProperties,
  heading: { margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  primary: {
    alignSelf: "flex-start",
    padding: "8px 16px",
    fontSize: 14,
    border: "1px solid #111827",
    borderRadius: 6,
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
  } satisfies CSSProperties,
};

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  error: string | undefined;
  errorId: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

function TextField({ id, label, value, maxLength, error, errorId, onChange, inputRef }: TextFieldProps) {
  return (
    <div style={styles.field}>
      <label htmlFor={id} style={styles.label}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        maxLength={maxLength + 50}
        style={error ? { ...styles.input, ...styles.inputError } : styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p id={errorId} role="alert" style={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: ReadonlyArray<EnumOption<T>>;
  error: string | undefined;
  errorId: string;
  onChange: (value: T) => void;
}

function SelectField<T extends string>({ id, label, value, options, error, errorId, onChange }: SelectFieldProps<T>) {
  return (
    <div style={styles.field}>
      <label htmlFor={id} style={styles.label}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        style={error ? { ...styles.input, ...styles.inputError } : styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          const next = parseOption(options, e.target.value);
          if (next !== undefined) onChange(next);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} role="alert" style={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function GuestForm({ onAdd }: GuestFormProps) {
  const baseId = useId();
  const [draft, setDraft] = useState<NewGuest>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<NewGuest>) => setDraft((d) => ({ ...d, ...patch }));
  const idOf = (field: keyof NewGuest) => `${baseId}-${field}`;
  const errIdOf = (field: keyof NewGuest) => `${baseId}-${field}-error`;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = newGuestSchema.safeParse(draft);
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key !== undefined && isFieldName(key) && next[key] === undefined) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    if (!onAdd(result.data)) {
      setErrors({ name: `Could not add the guest (the list is limited to ${MAX_GUESTS}).` });
      return;
    }
    setErrors({});
    // Keep household, side and role for fast family entry.
    setDraft((d) => ({ ...d, name: "", notes: "" }));
    nameRef.current?.focus();
  };

  return (
    <form style={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 style={styles.heading}>Add a guest</h2>
      <div style={styles.grid}>
        <TextField
          id={idOf("name")}
          label="Name"
          value={draft.name}
          maxLength={NAME_MAX_LENGTH}
          error={errors.name}
          errorId={errIdOf("name")}
          onChange={(v) => update({ name: v })}
          inputRef={nameRef}
        />
        <TextField
          id={idOf("household")}
          label="Household"
          value={draft.household}
          maxLength={HOUSEHOLD_MAX_LENGTH}
          error={errors.household}
          errorId={errIdOf("household")}
          onChange={(v) => update({ household: v })}
        />
        <SelectField
          id={idOf("side")}
          label="Side"
          value={draft.side}
          options={SIDES}
          error={errors.side}
          errorId={errIdOf("side")}
          onChange={(v) => update({ side: v })}
        />
        <SelectField
          id={idOf("gender")}
          label="Gender"
          value={draft.gender}
          options={GENDERS}
          error={errors.gender}
          errorId={errIdOf("gender")}
          onChange={(v) => update({ gender: v })}
        />
        <SelectField
          id={idOf("age_band")}
          label="Age band"
          value={draft.age_band}
          options={AGE_BANDS}
          error={errors.age_band}
          errorId={errIdOf("age_band")}
          onChange={(v) => update({ age_band: v })}
        />
        <SelectField
          id={idOf("role")}
          label="Role"
          value={draft.role}
          options={ROLES}
          error={errors.role}
          errorId={errIdOf("role")}
          onChange={(v) => update({ role: v })}
        />
        <SelectField
          id={idOf("vip")}
          label="VIP"
          value={draft.vip}
          options={VIP_LEVELS}
          error={errors.vip}
          errorId={errIdOf("vip")}
          onChange={(v) => update({ vip: v })}
        />
        <SelectField
          id={idOf("mobility")}
          label="Mobility"
          value={draft.mobility}
          options={MOBILITY_LEVELS}
          error={errors.mobility}
          errorId={errIdOf("mobility")}
          onChange={(v) => update({ mobility: v })}
        />
        <SelectField
          id={idOf("dietary")}
          label="Dietary"
          value={draft.dietary}
          options={DIETARY_OPTIONS}
          error={errors.dietary}
          errorId={errIdOf("dietary")}
          onChange={(v) => update({ dietary: v })}
        />
        <TextField
          id={idOf("notes")}
          label="Notes"
          value={draft.notes}
          maxLength={NOTES_MAX_LENGTH}
          error={errors.notes}
          errorId={errIdOf("notes")}
          onChange={(v) => update({ notes: v })}
        />
      </div>
      <button type="submit" style={styles.primary}>
        Add guest
      </button>
    </form>
  );
}