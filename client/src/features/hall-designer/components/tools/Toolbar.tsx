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
    background: "transparent", // the white card around the toolbar comes from the page
    overflowY: "auto",
  } satisfies CSSProperties,
  heading: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#111111",
    margin: "10px 0 2px",
    paddingBottom: 4,
    borderBottom: "2px solid #111111",
  } satisfies CSSProperties,
  button: {
    padding: "7px 10px",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 600,
    textAlign: "left",
    border: "2px solid #111111",
    borderRadius: 0,
    background: "#fff4dc",
    color: "#111111",
    cursor: "pointer",
  } satisfies CSSProperties,
  buttonActive: {
    background: "#111111",
    color: "#ffffff",
    fontWeight: 700,
  } satisfies CSSProperties,
  buttonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
    background: "#ffffff",
  } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "#111111",
  } satisfies CSSProperties,
  checkbox: { width: 16, height: 16, accentColor: "#111111", cursor: "pointer" } satisfies CSSProperties,
  select: {
    padding: "6px 8px",
    fontFamily: "inherit",
    fontSize: 12,
    border: "2px solid #111111",
    borderRadius: 0,
    background: "#fffdf6",
    color: "#111111",
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
        <input type="checkbox" checked={snapEnabled} onChange={toggleSnap} style={styles.checkbox} />
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