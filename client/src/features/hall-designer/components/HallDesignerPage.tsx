import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
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

/* ---------- config ---------- */
// Match the setting on the home page.
const SHOW_SIDEBAR = true;
const APP_NAME = "SEATPLAN";
const STATUS_TIMEOUT_MS = 4000;

/* ---------- theme (same as home page) ---------- */
const INK = "#111111";
const CREAM = "#fff4dc";
const MINT = "#a8d5b5";
const YELLOW = "#f8c335";
const PINK = "#f6b8f6";
const WHITE = "#ffffff";

const FONT = "'IBM Plex Mono', 'JetBrains Mono', 'Courier New', ui-monospace, monospace";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

.hd-hover { transition: transform .12s ease, box-shadow .12s ease; }
.hd-hover:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 ${INK}; }
.hd-hover:active { transform: translate(2px, 2px); box-shadow: 0 0 0 ${INK}; }
.hd-navlink:hover { background: rgba(17,17,17,0.1); }
.hd-focus:focus-visible { outline: 3px solid ${INK}; outline-offset: 2px; }

.hd-window { display: grid; grid-template-columns: 200px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.hd-window.hd-noside { grid-template-columns: minmax(0, 1fr); }

@media (max-width: 720px) {
  .hd-window { grid-template-columns: minmax(0, 1fr); }
  .hd-side { display: none; }
  .hd-main { margin: 10px !important; }
}
@media (prefers-reduced-motion: reduce) {
  .hd-hover { transition: none; }
}
`;

/* ---------- icons ---------- */
type IconName = "hall" | "guests" | "rules" | "results" | "layout" | "back";

const ICON_PATHS: Record<IconName, ReactNode> = {
  hall: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  guests: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  rules: (
    <>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
  results: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  back: (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
  ),
};

function Icon({ name, size = 14, color = INK }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* ---------- nav ---------- */
interface NavItem {
  label: string;
  icon: IconName;
  to: string;
  active?: boolean;
}

const NAV: NavItem[] = [
  { label: "Home", icon: "hall", to: "/" },
  { label: "Design hall", icon: "layout", to: "/designer", active: true },
  { label: "Guests", icon: "guests", to: "/guests" },
  { label: "Rules", icon: "rules", to: "/constraints" },
  { label: "Results", icon: "results", to: "/results" },
];

interface Status {
  kind: "success" | "error";
  text: string;
}

/* ---------- styles ---------- */
const styles = {
  page: {
    flex: 1,
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: 16,
    boxSizing: "border-box",
    background: `linear-gradient(115deg, #5bb8ff 0 18%, #ffd0a8 18% 40%, #ff9a6b 40% 62%, #ffb3d1 62% 100%)`,
    fontFamily: FONT,
    color: INK,
  } satisfies CSSProperties,
  window: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    background: MINT,
    border: `2px solid ${INK}`,
    boxShadow: `6px 6px 0 ${INK}`,
  } satisfies CSSProperties,

  /* sidebar */
  side: { padding: "20px 14px", display: "flex", flexDirection: "column", gap: 28 } satisfies CSSProperties,
  logo: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    padding: "4px 8px",
    border: `2px solid ${INK}`,
    background: CREAM,
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.04em",
  } satisfies CSSProperties,
  nav: { display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px",
    fontSize: 12,
    fontWeight: 600,
    color: INK,
    textDecoration: "none",
  } satisfies CSSProperties,
  navLinkActive: { background: INK, color: WHITE } satisfies CSSProperties,

  /* main cream panel: top bar + editor row */
  main: {
    margin: "12px 12px 12px 0",
    padding: 12,
    background: CREAM,
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflow: "hidden",
  } satisfies CSSProperties,

  /* top bar */
  topbar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    flexShrink: 0,
  } satisfies CSSProperties,
  squareBtn: {
    width: 32,
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: `2px solid ${INK}`,
    background: WHITE,
    cursor: "pointer",
    padding: 0,
    color: INK,
    textDecoration: "none",
    flexShrink: 0,
  } satisfies CSSProperties,
  badge: {
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 700,
    border: `2px solid ${INK}`,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  actions: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  } satisfies CSSProperties,
  status: { fontSize: 11, fontWeight: 600, minWidth: 120, textAlign: "right" } satisfies CSSProperties,
  button: {
    padding: "6px 12px",
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 700,
    border: `2px solid ${INK}`,
    background: WHITE,
    color: INK,
    cursor: "pointer",
  } satisfies CSSProperties,
  buttonPrimary: { background: YELLOW } satisfies CSSProperties,
  avatar: {
    width: 32,
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: `2px solid ${INK}`,
    background: PINK,
    flexShrink: 0,
  } satisfies CSSProperties,
  hidden: { display: "none" } satisfies CSSProperties,

  /* editor row */
  body: { flex: 1, minHeight: 0, display: "flex", gap: 12 } satisfies CSSProperties,
  sideCard: {
    flexShrink: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
    background: WHITE,
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
  } satisfies CSSProperties,
  canvasCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: WHITE,
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
  } satisfies CSSProperties,
};

const BADGE_ERROR: CSSProperties = { background: "#ff9a9a" };
const BADGE_WARNING: CSSProperties = { background: YELLOW };
const BADGE_OK: CSSProperties = { background: MINT };

export default function HallDesignerPage() {
  useKeyboardShortcuts();
  const navigate = useNavigate();

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
    <div style={styles.page}>
      <style>{CSS}</style>

      <div className={`hd-window${SHOW_SIDEBAR ? "" : " hd-noside"}`} style={styles.window}>
        {SHOW_SIDEBAR ? (
          <aside className="hd-side" style={styles.side}>
            <div style={styles.logo}>
              <span aria-hidden="true">{"</>"}</span>
              {APP_NAME}
            </div>
            <nav aria-label="Main" style={styles.nav}>
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="hd-navlink hd-focus"
                  aria-current={item.active ? "page" : undefined}
                  style={{ ...styles.navLink, ...(item.active ? styles.navLinkActive : null) }}
                >
                  <Icon name={item.icon} size={14} color={item.active ? WHITE : INK} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        ) : null}

        <div className="hd-main" style={SHOW_SIDEBAR ? styles.main : { ...styles.main, margin: 12 }}>
          {/* Top bar */}
          <div style={styles.topbar}>
            <button
              type="button"
              className="hd-focus"
              style={styles.squareBtn}
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <Icon name="back" />
            </button>
            <span style={{ ...styles.badge, ...badgeColors }}>{badgeText}</span>

            <div style={styles.actions}>
              <span
                role="status"
                style={{ ...styles.status, color: status?.kind === "error" ? "#b91c1c" : "#15803d" }}
              >
                {status?.text ?? ""}
              </span>
              <button
                type="button"
                className="hd-hover hd-focus"
                style={{ ...styles.button, ...styles.buttonPrimary }}
                onClick={() => setPresetsOpen(true)}
              >
                Presets
              </button>
              <button type="button" className="hd-hover hd-focus" style={styles.button} onClick={handleSave}>
                Save
              </button>
              <button type="button" className="hd-hover hd-focus" style={styles.button} onClick={handleLoad}>
                Load
              </button>
              <button type="button" className="hd-hover hd-focus" style={styles.button} onClick={handleExport}>
                Export JSON
              </button>
              <button
                type="button"
                className="hd-hover hd-focus"
                style={styles.button}
                onClick={() => fileInputRef.current?.click()}
              >
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

          {/* Editor */}
          <div style={styles.body}>
            <div style={styles.sideCard}>
              <Toolbar />
            </div>
            <div ref={canvasColumnRef} style={styles.canvasCard}>
              <HallCanvas />
            </div>
            <div style={styles.sideCard}>
              <PropertiesPanel />
            </div>
          </div>
        </div>
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