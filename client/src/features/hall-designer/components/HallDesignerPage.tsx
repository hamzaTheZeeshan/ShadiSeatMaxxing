import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useValidation } from "../hooks/useValidation";
import { useEditorStore } from "../store/editorStore";
import { loadLayoutFromStorage, parseLayout, saveLayoutToStorage, serializeLayout } from "../utils/persistence";
import { fitViewport } from "../utils/fitViewport";
import type { HallPreset } from "../utils/presetLayouts";
import HallCanvas from "./canvas/HallCanvas";
import PresetModal from "./presets/PresetModal";
import PropertiesPanel from "./properties/PropertiesPanel";
import Toolbar from "./tools/Toolbar";

interface Status {
  kind: "success" | "error";
  text: string;
}

const STATUS_TIMEOUT_MS = 4000;

const styles = {
  root: {
    flex: 1,
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#f3f4f6",
    fontFamily: "system-ui, sans-serif",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    padding: "6px 16px",
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
  } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  button: {
    padding: "6px 12px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
  } satisfies CSSProperties,
  status: { fontSize: 13, minWidth: 140, textAlign: "right" } satisfies CSSProperties,
  badge: {
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 999,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  body: { flex: 1, minHeight: 0, display: "flex" } satisfies CSSProperties,
  canvasColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  } satisfies CSSProperties,
  hidden: { display: "none" } satisfies CSSProperties,
};

const BADGE_ERROR: CSSProperties = { background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" };
const BADGE_WARNING: CSSProperties = { background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" };
const BADGE_OK: CSSProperties = { background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" };

export default function HallDesignerPage() {
  useKeyboardShortcuts();

  const { issues } = useValidation();
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.length - errorCount;
  const badgeText =
    errorCount === 0 && warningCount === 0
      ? "Layout OK"
      : `${errorCount} ${errorCount === 1 ? "error" : "errors"}, ${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`;
  const badgeColors = errorCount > 0 ? BADGE_ERROR : warningCount > 0 ? BADGE_WARNING : BADGE_OK;

  const [status, setStatus] = useState<Status | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasColumnRef = useRef<HTMLDivElement>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const hasObjects = useEditorStore((s) => s.objects.length > 0);

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

  const handleSave = () => {
    const state = useEditorStore.getState();
    const result = saveLayoutToStorage(state.getLayout());
    if (result.ok) {
      state.bumpLayoutVersion();
      showStatus("success", "Layout saved.");
    } else {
      showStatus("error", result.error);
    }
  };

  const handleLoad = () => {
    const result = loadLayoutFromStorage();
    if (result.ok) {
      useEditorStore.getState().loadLayout(result.value);
      showStatus("success", "Layout loaded.");
    } else {
      showStatus("error", result.error); // current layout stays untouched
    }
  };

  const handleExport = () => {
    try {
      const json = serializeLayout(useEditorStore.getState().getLayout());
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "shadi-maxing-layout.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showStatus("success", "Layout exported.");
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Could not export layout.");
    }
  };

  const handleImportChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget; // capture before awaiting
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const layout = parseLayout(text);
      useEditorStore.getState().loadLayout(layout);
      showStatus("success", "Layout imported.");
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Could not import file.");
    } finally {
      input.value = ""; // allow choosing the same file again
    }
  };

  const handleApplyPreset = (preset: HallPreset) => {
    const store = useEditorStore.getState();
    store.loadLayout(structuredClone(preset.layout)); // clears history + selection
    const el = canvasColumnRef.current;
    if (el && el.clientWidth > 0 && el.clientHeight > 0) {
      store.setViewport(fitViewport(preset.layout.hall, el.clientWidth, el.clientHeight));
    }
    setPresetsOpen(false);
    showStatus("success", `Preset "${preset.name}" loaded.`);
  };

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={{ ...styles.badge, ...badgeColors }}>{badgeText}</span>
        <div style={styles.actions}>
          <span
            role="status"
            style={{ ...styles.status, color: status?.kind === "error" ? "#b91c1c" : "#15803d" }}
          >
            {status?.text ?? ""}
          </span>
          <button type="button" style={styles.button} onClick={() => setPresetsOpen(true)}>
            Presets
          </button>
          <button type="button" style={styles.button} onClick={handleSave}>
            Save
          </button>
          <button type="button" style={styles.button} onClick={handleLoad}>
            Load
          </button>
          <button type="button" style={styles.button} onClick={handleExport}>
            Export JSON
          </button>
          <button type="button" style={styles.button} onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={styles.hidden}
            tabIndex={-1}
            aria-label="Import layout JSON file"
            onChange={(e) => {
              void handleImportChange(e);
            }}
          />
        </div>
      </div>
      <div style={styles.body}>
        <Toolbar />
        <div ref={canvasColumnRef} style={styles.canvasColumn}>
          <HallCanvas />
        </div>
        <PropertiesPanel />
      </div>

      <PresetModal
        open={presetsOpen}
        hasObjects={hasObjects}
        onClose={() => setPresetsOpen(false)}
        onApply={handleApplyPreset}
      />
    </div>
  );
}