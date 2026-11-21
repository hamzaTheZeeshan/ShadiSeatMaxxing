import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { HallObject } from "../../types/layout";
import { useEditorStore } from "../../store/editorStore";
import type { ObjectPatch } from "../../store/editorStore";
import { useValidation } from "../../hooks/useValidation";
import { MAX_CAPACITY, MIN_CAPACITY, MIN_SIZE } from "../../utils/defaults";
import NumberField from "./NumberField";
import ValidationList from "./ValidationList";

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

const HALL_MIN = 5;
const HALL_MAX = 200;

const styles = {
  root: {
    width: 260,
    flexShrink: 0,
    boxSizing: "border-box",
    padding: 14,
    background: "transparent", // the white card around the panel comes from the page
    overflowY: "auto",
  } satisfies CSSProperties,
  heading: { fontSize: 15, fontWeight: 700, color: "#111111", margin: "0 0 12px" } satisfies CSSProperties,
  label: { fontSize: 11, color: "#111111", fontWeight: 700 } satisfies CSSProperties,
  input: {
    padding: "6px 8px",
    fontFamily: "inherit",
    fontSize: 12,
    border: "2px solid #111111",
    borderRadius: 0,
    background: "#fffdf6",
    color: "#111111",
    width: "100%",
    boxSizing: "border-box",
  } satisfies CSSProperties,
  inputError: { border: "2px solid #dc2626", background: "#ffd6d6" } satisfies CSSProperties,
  error: { fontSize: 11, fontWeight: 600, color: "#b91c1c" } satisfies CSSProperties,
  field: { display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 } satisfies CSSProperties,
  deleteButton: {
    marginTop: 8,
    padding: "8px 10px",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 700,
    width: "100%",
    border: "2px solid #111111",
    borderRadius: 0,
    background: "#ff9a9a",
    color: "#111111",
    boxShadow: "3px 3px 0 #111111",
    cursor: "pointer",
  } satisfies CSSProperties,
};

function HallNameField({ name }: { name: string }) {
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) return;
    setDraft(name);
    setError(null);
  }, [name, syncTick]);

  const attempt = (): boolean => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setError("Name cannot be empty.");
      return false;
    }
    setError(null);
    if (trimmed !== name) useEditorStore.getState().commitHallUpdate({ name: trimmed });
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation(); // keep canvas shortcuts from firing while typing
    if (e.key === "Enter") {
      e.preventDefault();
      attempt();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(name);
      setError(null);
    }
  };

  return (
    <div style={styles.field}>
      <label htmlFor="hall-name" style={styles.label}>
        Hall name
      </label>
      <input
        id="hall-name"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          editingRef.current = true;
        }}
        onBlur={() => {
          editingRef.current = false;
          if (attempt()) setSyncTick((t) => t + 1);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => e.stopPropagation()}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? "hall-name-error" : undefined}
        style={error !== null ? { ...styles.input, ...styles.inputError } : styles.input}
      />
      {error !== null && (
        <div id="hall-name-error" role="alert" style={styles.error}>
          {error}
        </div>
      )}
    </div>
  );
}

function HallPanel() {
  const hall = useEditorStore((s) => s.hall);
  const commitHallUpdate = useEditorStore((s) => s.commitHallUpdate);
  return (
    <>
      <h2 style={styles.heading}>Hall</h2>
      <HallNameField name={hall.name} />
      <NumberField
        label="Width (m)"
        value={hall.width}
        min={HALL_MIN}
        max={HALL_MAX}
        onCommit={(v) => commitHallUpdate({ width: v })}
      />
      <NumberField
        label="Height (m)"
        value={hall.height}
        min={HALL_MIN}
        max={HALL_MAX}
        onCommit={(v) => commitHallUpdate({ height: v })}
      />
    </>
  );
}

function typeName(object: HallObject): string {
  switch (object.type) {
    case "table":
      switch (object.shape) {
        case "round":
          return "Round table";
        case "rectangular":
          return "Rectangular table";
        case "square":
          return "Square table";
        default:
          return assertNever(object);
      }
    case "sofa":
      return "Sofa";
    case "stage":
      return "Stage";
    case "dance_floor":
      return "Dance floor";
    case "restricted_area":
      return "Restricted area";
    case "service_area":
      return "Service area";
    case "entrance":
      return "Entrance";
    case "exit":
      return "Exit";
    default:
      return assertNever(object);
  }
}

interface TypeFieldsProps {
  object: HallObject;
  commit: (patch: ObjectPatch) => void;
}

function TypeFields({ object, commit }: TypeFieldsProps) {
  switch (object.type) {
    case "table":
      switch (object.shape) {
        case "round":
          return (
            <>
              <NumberField label="Radius (m)" value={object.radius} min={MIN_SIZE} onCommit={(v) => commit({ radius: v })} />
              <NumberField
                label="Capacity (seats)"
                value={object.capacity}
                min={MIN_CAPACITY}
                max={MAX_CAPACITY}
                integer
                onCommit={(v) => commit({ capacity: v })}
              />
            </>
          );
        case "rectangular":
        case "square":
          return (
            <>
              <NumberField label="Width (m)" value={object.width} min={MIN_SIZE} onCommit={(v) => commit({ width: v })} />
              <NumberField label="Height (m)" value={object.height} min={MIN_SIZE} onCommit={(v) => commit({ height: v })} />
              <NumberField
                label="Capacity (seats)"
                value={object.capacity}
                min={MIN_CAPACITY}
                max={MAX_CAPACITY}
                integer
                onCommit={(v) => commit({ capacity: v })}
              />
            </>
          );
        default:
          return assertNever(object);
      }
    case "sofa":
      return (
        <>
          <NumberField label="Width (m)" value={object.width} min={MIN_SIZE} onCommit={(v) => commit({ width: v })} />
          <NumberField label="Height (m)" value={object.height} min={MIN_SIZE} onCommit={(v) => commit({ height: v })} />
          <NumberField
            label="Capacity (seats)"
            value={object.capacity}
            min={MIN_CAPACITY}
            max={MAX_CAPACITY}
            integer
            onCommit={(v) => commit({ capacity: v })}
          />
        </>
      );
    case "stage":
    case "dance_floor":
    case "restricted_area":
    case "service_area":
      return (
        <>
          <NumberField label="Width (m)" value={object.width} min={MIN_SIZE} onCommit={(v) => commit({ width: v })} />
          <NumberField label="Height (m)" value={object.height} min={MIN_SIZE} onCommit={(v) => commit({ height: v })} />
        </>
      );
        case "entrance":
    case "exit":
      return <NumberField label="Width (m)" value={object.width} min={MIN_SIZE} onCommit={(v) => commit({ width: v })} />;
    default:
      return assertNever(object);
  }
}

function ObjectPanel({ object }: { object: HallObject }) {
  const id = object.id;
  const type = object.type;
  // Number = position among objects of the same type (order in objects[]) + 1. Only tables and sofas use it.
  const seatNumber = useEditorStore((s) => {
    if (type !== "table" && type !== "sofa") return null;
    let n = 0;
    for (const o of s.objects) {
      if (o.type === type) {
        n += 1;
        if (o.id === id) return n;
      }
    }
    return null;
  });

  const commit = (patch: ObjectPatch) => useEditorStore.getState().commitObjectUpdate(id, patch);
  const prefix = type === "table" ? "T" : "S";
  const heading =
    seatNumber !== null && (type === "table" || type === "sofa")
      ? `${prefix}${seatNumber} · ${typeName(object)}`
      : typeName(object);

  return (
    <>
      <h2 style={styles.heading}>{heading}</h2>
      <NumberField label="X (m)" value={object.x} onCommit={(v) => commit({ x: v })} />
      <NumberField label="Y (m)" value={object.y} onCommit={(v) => commit({ y: v })} />
      <NumberField label="Rotation (°)" value={object.rotation} min={0} max={360} onCommit={(v) => commit({ rotation: v })} />
      <TypeFields object={object} commit={commit} />
      <button type="button" style={styles.deleteButton} onClick={() => useEditorStore.getState().removeObject(id)}>
        Delete
      </button>
    </>
  );
}

export default function PropertiesPanel() {
  const selectedObject = useEditorStore((s) => s.objects.find((o) => o.id === s.selectedId));
  const { issues } = useValidation();
  return (
    <aside style={styles.root} aria-label="Properties">
      {selectedObject === undefined ? <HallPanel /> : <ObjectPanel key={selectedObject.id} object={selectedObject} />}
      <ValidationList issues={issues} />
    </aside>
  );
}