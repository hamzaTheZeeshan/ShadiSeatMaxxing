import type { CSSProperties } from "react";
import { useEditorStore } from "../../store/editorStore";
import type { GridSize, Tool } from "../../store/editorStore";

const TOOLS = [
  { tool: "select", label: "Select" },
  { tool: "table_round", label: "Round Table" },
  { tool: "table_rect", label: "Rectangular Table" },
  { tool: "table_square", label: "Square Table" },
  { tool: "sofa", label: "Sofa" },
  { tool: "stage", label: "Stage" },
  { tool: "dance_floor", label: "Dance Floor" },
  { tool: "restricted_area", label: "Restricted Area" },
  { tool: "service_area", label: "Service Area" },
  { tool: "entrance", label: "Entrance" },
  { tool: "exit", label: "Exit" },
] as const satisfies ReadonlyArray<{ tool: Tool; label: string }>;

// Compile-time check: this fails to type-check if any Tool is missing from TOOLS.
type ListedTool = (typeof TOOLS)[number]["tool"];
const ALL_TOOLS_COVERED: [Exclude<Tool, ListedTool>] extends [never] ? true : never = true;
void ALL_TOOLS_COVERED;

const GRID_SIZES: ReadonlyArray<GridSize> = [0.25, 0.5, 1];

function parseGridSize(value: string): GridSize | null {
  switch (value) {
    case "0.25":
      return 0.25;
    case "0.5":
      return 0.5;
    case "1":
      return 1;
    default:
      return null;
  }
}

const styles = {
  root: {
    width: 180,
    flexShrink: 0,
    boxSizing: "border-box",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    overflowY: "auto",
  } satisfies CSSProperties,
  heading: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#6b7280",
    margin: "8px 0 2px",
  } satisfies CSSProperties,
  button: {
    padding: "7px 10px",
    fontSize: 13,
    textAlign: "left",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
  } satisfies CSSProperties,
  buttonActive: {
    background: "#2563eb",
    borderColor: "#1d4ed8",
    color: "#ffffff",
    fontWeight: 600,
  } satisfies CSSProperties,
  buttonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
    background: "#f3f4f6",
  } satisfies CSSProperties,
  row: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#111827" } satisfies CSSProperties,
  select: {
    padding: "5px 7px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
  } satisfies CSSProperties,
};

export default function Toolbar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const gridSize = useEditorStore((s) => s.gridSize);
  const setGridSize = useEditorStore((s) => s.setGridSize);

  return (
    <aside style={styles.root} aria-label="Tools">
      <div style={styles.heading}>Tools</div>
      {TOOLS.map((entry) => {
        const active = tool === entry.tool;
        return (
          <button
            key={entry.tool}
            type="button"
            aria-pressed={active}
            onClick={() => setTool(entry.tool)}
            style={active ? { ...styles.button, ...styles.buttonActive } : styles.button}
          >
            {entry.label}
          </button>
        );
      })}

      <div style={styles.heading}>History</div>
      <button
        type="button"
        disabled={!canUndo}
        onClick={undo}
        style={canUndo ? styles.button : { ...styles.button, ...styles.buttonDisabled }}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!canRedo}
        onClick={redo}
        style={canRedo ? styles.button : { ...styles.button, ...styles.buttonDisabled }}
      >
        Redo
      </button>

      <div style={styles.heading}>Grid</div>
      <label style={styles.row}>
        <input type="checkbox" checked={snapEnabled} onChange={toggleSnap} />
        Snap to grid
      </label>
      <label style={{ ...styles.row, flexDirection: "column", alignItems: "stretch", gap: 2 }}>
        Grid size (m)
        <select
          value={String(gridSize)}
          onChange={(e) => {
            const parsed = parseGridSize(e.target.value);
            if (parsed !== null) setGridSize(parsed);
          }}
          style={styles.select}
        >
          {GRID_SIZES.map((size) => (
            <option key={size} value={String(size)}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}