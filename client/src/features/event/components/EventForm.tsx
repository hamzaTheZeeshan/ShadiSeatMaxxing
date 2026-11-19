import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import { useEventStore } from "../store/eventStore";
import {
  DEFAULT_EVENT,
  EVENT_NAME_MAX_LENGTH,
  EVENT_TYPES,
  GUESTS_MAX,
  GUESTS_MIN,
  NOTES_MAX_LENGTH,
  eventSchema,
} from "../types/eventSchema";
import type { EventInfo, EventType } from "../types/eventSchema";

interface Draft {
  name: string;
  type: EventType;
  date: string;
  guests: string;
  notes: string;
}

type FieldErrors = Partial<Record<keyof EventInfo, string>>;

interface Status {
  kind: "success" | "error";
  text: string;
}

const STATUS_TIMEOUT_MS = 4000;

const FIELD_NAMES: ReadonlyArray<keyof EventInfo> = [
  "event_name",
  "event_type",
  "event_date",
  "expected_guests",
  "notes",
];

function isFieldName(key: PropertyKey): key is keyof EventInfo {
  return FIELD_NAMES.some((name) => name === key);
}

function toDraft(event: EventInfo): Draft {
  return {
    name: event.event_name,
    type: event.event_type,
    date: event.event_date,
    guests: String(event.expected_guests),
    notes: event.notes,
  };
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 20,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
  } satisfies CSSProperties,
  field: { display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  label: { fontSize: 14, fontWeight: 600, color: "#111827" } satisfies CSSProperties,
  input: {
    padding: "8px 10px",
    fontSize: 15,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  } satisfies CSSProperties,
  inputError: { borderColor: "#b91c1c" } satisfies CSSProperties,
  textarea: { resize: "vertical", minHeight: 90 } satisfies CSSProperties,
  counter: { fontSize: 12, color: "#6b7280", textAlign: "right" } satisfies CSSProperties,
  error: { margin: 0, fontSize: 13, color: "#b91c1c" } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  primary: {
    padding: "8px 16px",
    fontSize: 14,
    border: "1px solid #111827",
    borderRadius: 6,
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
  } satisfies CSSProperties,
  secondary: {
    padding: "8px 16px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
  } satisfies CSSProperties,
  status: { fontSize: 13, minHeight: 18 } satisfies CSSProperties,
};

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" style={styles.error}>
      {message}
    </p>
  );
}

export default function EventForm() {
  const baseId = useId();
  const ids = {
    name: `${baseId}-name`,
    type: `${baseId}-type`,
    date: `${baseId}-date`,
    guests: `${baseId}-guests`,
    notes: `${baseId}-notes`,
  };

  const setEvent = useEventStore((s) => s.setEvent);
  const [draft, setDraft] = useState<Draft>(() => toDraft(useEventStore.getState().event));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const showStatus = (kind: Status["kind"], text: string) => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setStatus({ kind, text });
    timeoutRef.current = setTimeout(() => {
      setStatus(null);
      timeoutRef.current = null;
    }, STATUS_TIMEOUT_MS);
  };

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const handleTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const match = EVENT_TYPES.find((t) => t.value === e.target.value);
    if (match) update({ type: match.value });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = eventSchema.safeParse({
      event_name: draft.name,
      event_type: draft.type,
      event_date: draft.date,
      expected_guests: draft.guests.trim() === "" ? Number.NaN : Number(draft.guests),
      notes: draft.notes,
    });
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key !== undefined && isFieldName(key) && next[key] === undefined) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setEvent(result.data);
    setDraft(toDraft(result.data));
    showStatus("success", "Event saved.");
  };

  const handleReset = () => {
    setDraft(toDraft(DEFAULT_EVENT)); // draft only; store changes on next Save
    setErrors({});
  };

  const errId = (field: keyof EventInfo) => `${baseId}-${field}-error`;
  const describedBy = (field: keyof EventInfo) => (errors[field] ? errId(field) : undefined);
  const inputStyle = (field: keyof EventInfo): CSSProperties =>
    errors[field] ? { ...styles.input, ...styles.inputError } : styles.input;

  return (
    <form style={styles.form} onSubmit={handleSubmit} noValidate>
      <div style={styles.field}>
        <label htmlFor={ids.name} style={styles.label}>
          Event name
        </label>
        <input
          id={ids.name}
          type="text"
          value={draft.name}
          maxLength={EVENT_NAME_MAX_LENGTH + 50}
          style={inputStyle("event_name")}
          aria-invalid={errors.event_name ? true : undefined}
          aria-describedby={describedBy("event_name")}
          onChange={(e) => update({ name: e.target.value })}
        />
        <FieldError id={errId("event_name")} message={errors.event_name} />
      </div>

      <div style={styles.field}>
        <label htmlFor={ids.type} style={styles.label}>
          Event type
        </label>
        <select
          id={ids.type}
          value={draft.type}
          style={inputStyle("event_type")}
          aria-invalid={errors.event_type ? true : undefined}
          aria-describedby={describedBy("event_type")}
          onChange={handleTypeChange}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <FieldError id={errId("event_type")} message={errors.event_type} />
      </div>

      <div style={styles.field}>
        <label htmlFor={ids.date} style={styles.label}>
          Event date (optional)
        </label>
        <input
          id={ids.date}
          type="date"
          value={draft.date}
          style={inputStyle("event_date")}
          aria-invalid={errors.event_date ? true : undefined}
          aria-describedby={describedBy("event_date")}
          onChange={(e) => update({ date: e.target.value })}
        />
        <FieldError id={errId("event_date")} message={errors.event_date} />
      </div>

      <div style={styles.field}>
        <label htmlFor={ids.guests} style={styles.label}>
          Expected guests
        </label>
        <input
          id={ids.guests}
          type="number"
          inputMode="numeric"
          min={GUESTS_MIN}
          max={GUESTS_MAX}
          step={1}
          value={draft.guests}
          style={inputStyle("expected_guests")}
          aria-invalid={errors.expected_guests ? true : undefined}
          aria-describedby={describedBy("expected_guests")}
          onChange={(e) => update({ guests: e.target.value })}
        />
        <FieldError id={errId("expected_guests")} message={errors.expected_guests} />
      </div>

      <div style={styles.field}>
        <label htmlFor={ids.notes} style={styles.label}>
          Notes
        </label>
        <textarea
          id={ids.notes}
          value={draft.notes}
          style={{ ...inputStyle("notes"), ...styles.textarea }}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={describedBy("notes")}
          onChange={(e) => update({ notes: e.target.value })}
        />
        <span style={styles.counter}>
          {draft.notes.length}/{NOTES_MAX_LENGTH}
        </span>
        <FieldError id={errId("notes")} message={errors.notes} />
      </div>

      <div style={styles.actions}>
        <button type="submit" style={styles.primary}>
          Save
        </button>
        <button type="button" style={styles.secondary} onClick={handleReset}>
          Reset
        </button>
        <span role="status" style={{ ...styles.status, color: "#15803d" }}>
          {status?.text ?? ""}
        </span>
      </div>
    </form>
  );
}