import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import ConstraintImport from "../features/constraints/components/ConstraintImport";
import ConstraintIssues from "../features/constraints/components/ConstraintIssues";
import ConstraintSettingsPanel from "../features/constraints/components/ConstraintSettingsPanel";
import RuleForm from "../features/constraints/components/RuleForm";
import RuleList from "../features/constraints/components/RuleList";
import TableZonesPanel from "../features/constraints/components/TableZonesPanel";
import { useConstraintStore } from "../features/constraints/store/constraintStore";
import {
  loadConstraintsFromStorage,
  saveConstraintsToStorage,
} from "../features/constraints/utils/constraintPersistence";
import { useGuestStore } from "../features/guests/store/guestStore";

const STATUS_MS = 4000;

interface PageStatus {
  text: string;
  ok: boolean;
}

/* ---------- config ---------- */
// Match the setting on the home page.
const SHOW_SIDEBAR = true;
const APP_NAME = "SEATPLAN";

/* ---------- theme (same as home page) ---------- */
const INK = "#111111";
const CREAM = "#fff4dc";
const MINT = "#a8d5b5";
const PINK = "#f6b8f6";
const WHITE = "#ffffff";
const MUTED = "#4b4b4b";

const FONT = "'IBM Plex Mono', 'JetBrains Mono', 'Courier New', ui-monospace, monospace";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

.cp-hover { transition: transform .12s ease, box-shadow .12s ease; }
.cp-hover:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 ${INK}; }
.cp-hover:active { transform: translate(2px, 2px); box-shadow: 0 0 0 ${INK}; }
.cp-navlink:hover { background: rgba(17,17,17,0.1); }
.cp-focus:focus-visible { outline: 3px solid ${INK}; outline-offset: 2px; }

.cp-window { display: grid; grid-template-columns: 200px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.cp-window.cp-noside { grid-template-columns: minmax(0, 1fr); }

@media (max-width: 720px) {
  .cp-window { grid-template-columns: minmax(0, 1fr); }
  .cp-side { display: none; }
  .cp-main { margin: 10px !important; }
}
@media (prefers-reduced-motion: reduce) {
  .cp-hover { transition: none; }
}
`;

/* ---------- icons ---------- */
type IconName = "hall" | "guests" | "rules" | "results" | "layout"| "back";

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
  { label: "Design hall", icon: "layout", to: "/designer" },
  { label: "Guests", icon: "guests", to: "/guests" },
  { label: "Rules", icon: "rules", to: "/constraints", active: true },
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
  heading: { margin: "0 0 8px", fontSize: 38, lineHeight: 1.1, fontWeight: 700, color: INK } satisfies CSSProperties,
  intro: { margin: "0 0 8px", fontSize: 12, lineHeight: 1.55, color: MUTED } satisfies CSSProperties,
  households: { margin: "0 0 24px", fontSize: 12, fontWeight: 600, color: INK } satisfies CSSProperties,
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, margin: "0 0 12px" } satisfies CSSProperties,
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
  status: { minHeight: 20, fontSize: 12, fontWeight: 600 } satisfies CSSProperties,
  links: { display: "flex", flexWrap: "wrap", gap: 12, margin: "16px 0 0" } satisfies CSSProperties,
  back: {
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

export default function ConstraintsPage() {
  const navigate = useNavigate();
  const guests = useGuestStore((s) => s.guests);
  const householdsTogether = useConstraintStore((s) => s.settings.households_together);
  const [status, setStatus] = useState<PageStatus | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const householdCount = useMemo(() => {
    const sizes = new Map<string, number>();
    for (const g of guests) {
      if (g.household === "") continue;
      sizes.set(g.household, (sizes.get(g.household) ?? 0) + 1);
    }
    let count = 0;
    for (const size of sizes.values()) if (size > 1) count += 1;
    return count;
  }, [guests]);

  function show(text: string, ok: boolean) {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setStatus({ text, ok });
    timeoutRef.current = window.setTimeout(() => {
      setStatus(null);
      timeoutRef.current = null;
    }, STATUS_MS);
  }

  function handleSave() {
    const { settings, zones, rules } = useConstraintStore.getState();
    const result = saveConstraintsToStorage({ version: 1, settings, zones, rules });
    if (result.ok) show("Saved to this browser.", true);
    else show(result.error, false);
  }

  function handleLoad() {
    const result = loadConstraintsFromStorage();
    if (!result.ok) {
      show(result.error, false);
      return;
    }
    if (useConstraintStore.getState().replaceAll(result.value)) show("Loaded from this browser.", true);
    else show("Saved constraints could not be applied.", false);
  }

  function handleClear() {
    if (!window.confirm("Remove all rules? Settings and table zones are kept.")) return;
    useConstraintStore.getState().clearRules();
    show("All rules removed.", true);
  }

  return (
    <div style={styles.page}>
      <style>{CSS}</style>

      <div className={`cp-window${SHOW_SIDEBAR ? "" : " cp-noside"}`} style={styles.window}>
        {SHOW_SIDEBAR ? (
          <aside className="cp-side" style={styles.side}>
            <div style={styles.logo}>
              <span aria-hidden="true">{"</>"}</span>
              {APP_NAME}
            </div>
            <nav aria-label="Main" style={styles.nav}>
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="cp-navlink cp-focus"
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

        <div className="cp-main" style={SHOW_SIDEBAR ? styles.main : { ...styles.main, margin: 12 }}>
          {/* Top bar */}
          <div style={styles.topbar}>
            <button
              type="button"
              className="cp-focus"
              style={styles.squareBtn}
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <Icon name="back" />
            </button>
          </div>

      <div>
        <h1 style={styles.heading}>Constraints</h1>
        <p style={styles.intro}>Set seating rules and table zones. The solver will use them in a later step.</p>
        <p style={styles.households}>
          {householdsTogether
            ? `${householdCount} ${householdCount === 1 ? "household" : "households"} will be seated together automatically`
            : "Households are not kept together (turn this on in Settings)."}
        </p>

        <ConstraintSettingsPanel />
        <TableZonesPanel />
        <RuleForm />
        <RuleList />
        <ConstraintIssues />
        <ConstraintImport />

        <div style={styles.actions}>
          <button type="button" className="cp-hover cp-focus" style={styles.button} onClick={handleSave}>
            Save to browser
          </button>
          <button type="button" className="cp-hover cp-focus" style={styles.button} onClick={handleLoad}>
            Load from browser
          </button>
          <button type="button" className="cp-hover cp-focus" style={styles.danger} onClick={handleClear}>
            Clear all rules
          </button>
        </div>
        <div role="status" style={{ ...styles.status, color: status?.ok ? "#15803d" : "#b91c1c" }}>
          {status?.text ?? ""}
        </div>

        <div style={styles.links}>
          <Link to="/guests" className="cp-hover cp-focus" style={styles.back}>
            Back: Guests
          </Link>
          <Link to="/designer" className="cp-hover cp-focus" style={styles.back}>
            Back: Hall
          </Link>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}