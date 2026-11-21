import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import GuestBulkBar from "../features/guests/components/GuestBulkBar";
import GuestForm from "../features/guests/components/GuestForm";
import GuestImport from "../features/guests/components/GuestImport";
import GuestList from "../features/guests/components/GuestList";
import GuestSummary from "../features/guests/components/GuestSummary";
import { useGuestStore } from "../features/guests/store/guestStore";
import type { ImportedGuest, NewGuest } from "../features/guests/types/guestSchema";
import { exportGuestsCsv } from "../features/guests/utils/guestCsv";
import { serializeGuests } from "../features/guests/utils/guestJson";
import { loadGuestsFromStorage, saveGuestsToStorage } from "../features/guests/utils/guestPersistence";
import { computeGuestStats, totalTableSeats } from "../features/guests/utils/guestStats";
import { useEditorStore } from "../features/hall-designer/store/editorStore";

interface Status {
  kind: "success" | "error";
  text: string;
}

const STATUS_TIMEOUT_MS = 4000;

/* ---------- config ---------- */
// Match the setting on the home page.
const SHOW_SIDEBAR = true;
const APP_NAME = "SEATPLAN";

/* ---------- theme (same as home page) ---------- */
const INK = "#111111";
const CREAM = "#fff4dc";
const MINT = "#a8d5b5";
const YELLOW = "#f8c335";
const PINK = "#f6b8f6";
const WHITE = "#ffffff";
const MUTED = "#4b4b4b";

const FONT = "'IBM Plex Mono', 'JetBrains Mono', 'Courier New', ui-monospace, monospace";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

.gp-hover { transition: transform .12s ease, box-shadow .12s ease; }
.gp-hover:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 ${INK}; }
.gp-hover:active { transform: translate(2px, 2px); box-shadow: 0 0 0 ${INK}; }
.gp-navlink:hover { background: rgba(17,17,17,0.1); }
.gp-focus:focus-visible { outline: 3px solid ${INK}; outline-offset: 2px; }

.gp-window { display: grid; grid-template-columns: 200px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.gp-window.gp-noside { grid-template-columns: minmax(0, 1fr); }

@media (max-width: 720px) {
  .gp-window { grid-template-columns: minmax(0, 1fr); }
  .gp-side { display: none; }
  .gp-main { margin: 10px !important; }
}
@media (prefers-reduced-motion: reduce) {
  .gp-hover { transition: none; }
}
`;

/* ---------- icons ---------- */
type IconName = "hall" | "guests" | "rules" | "results" | "layout" | "back" | "next";

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
  next: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
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
  { label: "Design hall", icon: "layout", to: "/designer" },
  { label: "Guests", icon: "guests", to: "/guests", active: true },
  { label: "Rules", icon: "rules", to: "/constraints" },
  { label: "Results", icon: "results", to: "/results" },
];

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

  /* main cream panel (scrolls) */
  main: {
    margin: "12px 12px 12px 0",
    padding: "20px 24px 28px",
    background: CREAM,
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
  } satisfies CSSProperties,

  /* top bar */
  topbar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 } satisfies CSSProperties,
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
  topSpacer: { marginLeft: "auto" } satisfies CSSProperties,

  /* page content */
  inner: { display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  heading: { margin: 0, fontSize: 38, lineHeight: 1.1, fontWeight: 700, color: INK } satisfies CSSProperties,
  intro: { margin: 0, fontSize: 12, lineHeight: 1.55, color: MUTED } satisfies CSSProperties,
  importRow: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 } satisfies CSSProperties,
  importMain: { flex: "2 1 520px", minWidth: 0 } satisfies CSSProperties,
  tip: {
    flex: "1 1 260px",
    minWidth: 0,
    boxSizing: "border-box",
    padding: 16,
    fontSize: 12,
    lineHeight: 1.55,
    color: INK,
    background: YELLOW,
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
  } satisfies CSSProperties,
  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 } satisfies CSSProperties,
  button: {
    padding: "8px 14px",
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: WHITE,
    color: INK,
    cursor: "pointer",
  } satisfies CSSProperties,
  danger: {
    padding: "8px 14px",
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: "#ff9a9a",
    color: INK,
    cursor: "pointer",
  } satisfies CSSProperties,
  status: { fontSize: 12, fontWeight: 600, minHeight: 18, whiteSpace: "pre-line" } satisfies CSSProperties,
  back: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    padding: "9px 16px",
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    border: `2px solid ${INK}`,
    background: INK,
    color: WHITE,
    textDecoration: "none",
  } satisfies CSSProperties,
};

function downloadTextFile(content: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function plural(n: number): string {
  return n === 1 ? "guest" : "guests";
}

export default function GuestsPage() {
  const navigate = useNavigate();
  const guests = useGuestStore((s) => s.guests);
  const objects = useEditorStore((s) => s.objects);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
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

  const stats = useMemo(() => computeGuestStats(guests, totalTableSeats(objects)), [guests, objects]);

  // Selection never contains ids that no longer exist.
  const selected = useMemo(() => {
    const present = new Set(guests.map((g) => g.id));
    return new Set([...selectedIds].filter((id) => present.has(id)));
  }, [guests, selectedIds]);

  const handleAdd = (g: NewGuest): boolean => useGuestStore.getState().addGuest(g);

  const handleUpdate = (id: string, patch: Partial<NewGuest>): boolean => useGuestStore.getState().updateGuest(id, patch);

  const handleRemove = (id: string) => {
    useGuestStore.getState().removeGuest(id);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleBulkApply = (patch: Partial<NewGuest>) => {
    const changed = useGuestStore.getState().updateGuests([...selected], patch);
    if (changed > 0) showStatus("success", `Updated ${changed} ${plural(changed)}.`);
    else showStatus("error", "Could not apply the changes.");
  };

  const handleBulkRemove = () => {
    const removed = useGuestStore.getState().removeGuests([...selected]);
    setSelectedIds(new Set());
    showStatus("success", `Removed ${removed} ${plural(removed)}.`);
  };

  const handleImport = (items: ImportedGuest[], mode: "append" | "replace") => {
    const outcome = useGuestStore.getState().importGuests(items, mode);
    if (outcome !== null && mode === "replace") setSelectedIds(new Set());
    return outcome;
  };

  const handleExportJson = () => {
    if (guests.length === 0) {
      showStatus("error", "No guests to export.");
      return;
    }
    try {
      downloadTextFile(serializeGuests(guests), "shadi-maxing-guests.json", "application/json");
      showStatus("success", `Exported ${guests.length} ${plural(guests.length)}.`);
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Could not export guests.");
    }
  };

  const handleExportCsv = () => {
    if (guests.length === 0) {
      showStatus("error", "No guests to export.");
      return;
    }
    try {
      // BOM so Excel reads non-ASCII (e.g. Urdu) names as UTF-8; the CSV parser strips it again.
      downloadTextFile(`\uFEFF${exportGuestsCsv(guests)}`, "shadi-maxing-guests.csv", "text/csv;charset=utf-8");
      showStatus("success", `Exported ${guests.length} ${plural(guests.length)}.`);
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Could not export guests.");
    }
  };

  const handleSave = () => {
    const result = saveGuestsToStorage(useGuestStore.getState().guests);
    if (result.ok) showStatus("success", "Guests saved to browser.");
    else showStatus("error", result.error);
  };

  const handleLoad = () => {
    const result = loadGuestsFromStorage();
    if (!result.ok) {
      showStatus("error", result.error); // nothing changes
      return;
    }
    if (useGuestStore.getState().replaceGuests(result.value)) {
      setSelectedIds(new Set());
      showStatus("success", `Loaded ${result.value.length} ${plural(result.value.length)} from browser.`);
    } else {
      showStatus("error", "The saved guest list is not valid.");
    }
  };

  const handleClear = () => {
    if (guests.length === 0) return;
    if (!window.confirm(`Remove all ${guests.length} guests?`)) return;
    useGuestStore.getState().clearGuests();
    setSelectedIds(new Set());
    showStatus("success", "All guests removed.");
  };

  return (
    <div style={styles.page}>
      <style>{CSS}</style>

      <div className={`gp-window${SHOW_SIDEBAR ? "" : " gp-noside"}`} style={styles.window}>
        {SHOW_SIDEBAR ? (
          <aside className="gp-side" style={styles.side}>
            <div style={styles.logo}>
              <span aria-hidden="true">{"</>"}</span>
              {APP_NAME}
            </div>
            <nav aria-label="Main" style={styles.nav}>
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="gp-navlink gp-focus"
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

        <div className="gp-main" style={SHOW_SIDEBAR ? styles.main : { ...styles.main, margin: 12 }}>
          {/* Top bar */}
          <div style={styles.topbar}>
            <button
              type="button"
              className="gp-hover gp-focus"
              style={styles.squareBtn}
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <Icon name="back" />
            </button>

            <Link
              to="/constraints"
              className="gp-hover gp-focus"
              style={{ ...styles.squareBtn, ...styles.topSpacer }}
              aria-label="Next: Rules"
            >
              <Icon name="next" />
            </Link>
          </div>

          <div style={styles.inner}>
            <h1 style={styles.heading}>Guests</h1>
            <p style={styles.intro}>Add guests one by one, or import a whole list from JSON or CSV.</p>

            <GuestSummary stats={stats} />
            <GuestForm onAdd={handleAdd} />

            <div style={styles.importRow}>
              <div style={styles.importMain}>
                <GuestImport onImport={handleImport} hasGuests={guests.length > 0} />
              </div>
              <aside style={styles.tip} aria-label="Import tip">
                💡 <strong>Tip:</strong> Take a photo of your handwritten guest notes, download our sample JSON format,
                and give both to an AI (ChatGPT/Claude) to instantly format your entire list!
              </aside>
            </div>

            <div style={styles.toolbar}>
              <button type="button" className="gp-hover gp-focus" style={styles.button} onClick={handleExportJson}>
                Export JSON
              </button>
              <button type="button" className="gp-hover gp-focus" style={styles.button} onClick={handleExportCsv}>
                Export CSV
              </button>
              <button type="button" className="gp-hover gp-focus" style={styles.button} onClick={handleSave}>
                Save to browser
              </button>
              <button type="button" className="gp-hover gp-focus" style={styles.button} onClick={handleLoad}>
                Load from browser
              </button>
              <button type="button" className="gp-hover gp-focus" style={styles.danger} onClick={handleClear}>
                Clear all
              </button>
              <span
                role="status"
                style={{ ...styles.status, color: status?.kind === "error" ? "#b91c1c" : "#15803d" }}
              >
                {status?.text ?? ""}
              </span>
            </div>

            <GuestBulkBar
              selectedCount={selected.size}
              onApply={handleBulkApply}
              onRemove={handleBulkRemove}
              onClear={() => setSelectedIds(new Set())}
            />
            <GuestList
              guests={guests}
              selectedIds={selected}
              onSelectedChange={setSelectedIds}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />

            <Link to="/designer" className="gp-hover gp-focus" style={styles.back}>
              Back: Hall
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}