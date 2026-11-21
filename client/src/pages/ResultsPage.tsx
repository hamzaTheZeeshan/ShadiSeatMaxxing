import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConstraintStore } from "../features/constraints/store/constraintStore";
import { useGuestStore } from "../features/guests/store/guestStore";
import { useEditorStore } from "../features/hall-designer/store/editorStore";
import ResultsView from "../features/results/components/ResultsView";
import { useSeatingStore } from "../features/seating/store/seatingStore";

/* ---------- config ---------- */
// Match the setting on the home page.
const SHOW_SIDEBAR = true;
const APP_NAME = "SEATPLAN";

/* ---------- theme (same as home / constraints page) ---------- */
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
.cp-hover:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 ${INK}; }
.cp-hover:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 0 0 0 ${INK}; }
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
type IconName = "hall" | "guests" | "rules" | "results" | "layout" | "heart" | "bell" | "back";

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
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
  { label: "Rules", icon: "rules", to: "/constraints" },
  { label: "Results", icon: "results", to: "/results", active: true },
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
  intro: { margin: "0 0 24px", fontSize: 12, lineHeight: 1.55, color: MUTED } satisfies CSSProperties,
  card: {
    padding: 20,
    background: WHITE,
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
    marginBottom: 20,
  } satisfies CSSProperties,
  summary: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    margin: "0 0 16px",
    fontSize: 12,
    fontWeight: 600,
  } satisfies CSSProperties,
  chip: {
    padding: "4px 10px",
    border: `2px solid ${INK}`,
    background: CREAM,
    color: INK,
  } satisfies CSSProperties,
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 } satisfies CSSProperties,
  label: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 600,
    color: INK,
  } satisfies CSSProperties,
  input: {
    width: 80,
    padding: "7px 10px",
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 600,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: WHITE,
    color: INK,
  } satisfies CSSProperties,
  btnPrimary: {
    padding: "8px 14px",
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: PINK,
    color: INK,
    cursor: "pointer",
  } satisfies CSSProperties,
  btnSecondary: {
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
  btnDisabled: { opacity: 0.55, cursor: "not-allowed" } satisfies CSSProperties,
  warn: { margin: "16px 0 0", fontSize: 12, lineHeight: 1.55, color: MUTED } satisfies CSSProperties,
  link: { color: INK, fontWeight: 700 } satisfies CSSProperties,
  error: {
    padding: 14,
    border: `2px solid ${INK}`,
    background: "#ff9a9a",
    color: INK,
    fontSize: 12,
    marginBottom: 20,
  } satisfies CSSProperties,
  errorList: { margin: "8px 0 0", paddingLeft: 20 } satisfies CSSProperties,
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

export default function ResultsPage() {
  const navigate = useNavigate();
  const guestCount = useGuestStore((s) => s.guests.length);
  const ruleCount = useConstraintStore((s) => s.rules.length);
  const objectCount = useEditorStore((s) => s.objects.length);
  const tableCount = useEditorStore((s) => s.objects.filter((o) => o.type === "table").length);

  const { status, result, error, errorDetails, solve, cancel, reset } = useSeatingStore();
  const [seconds, setSeconds] = useState(30);

  const solving = status === "solving";
  const missing: string[] = [];
  if (guestCount === 0) missing.push("add some guests");
  if (tableCount === 0) missing.push("place at least one table in the hall designer");
  const canSolve = missing.length === 0 && !solving;

  const onSolve = () => {
    const clamped = Math.min(300, Math.max(1, Number.isFinite(seconds) ? seconds : 30));
    void solve({ time_limit_seconds: clamped });
  };

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
            <Link to="/results" className="cp-focus" style={{ ...styles.squareBtn, ...styles.topSpacer }} aria-label="Results">
              <Icon name="bell" />
            </Link>
            <span style={styles.avatar} aria-hidden="true">
              <Icon name="heart" />
            </span>
          </div>

          <div>
            <h1 style={styles.heading}>Seating results</h1>
            <p style={styles.intro}>Generate a seating plan from your hall, guests and rules.</p>

            <section style={styles.card}>
              <div style={styles.summary}>
                <span style={styles.chip}>{guestCount} guests</span>
                <span style={styles.chip}>{tableCount} tables</span>
                <span style={styles.chip}>{objectCount} hall objects</span>
                <span style={styles.chip}>{ruleCount} rules</span>
              </div>

              <div style={styles.row}>
                <label style={styles.label}>
                  Time limit (s)
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={seconds}
                    disabled={solving}
                    onChange={(e) => setSeconds(Number(e.target.value))}
                    className="cp-focus"
                    style={styles.input}
                  />
                </label>

                <button
                  type="button"
                  disabled={!canSolve}
                  onClick={onSolve}
                  className="cp-hover cp-focus"
                  style={{ ...styles.btnPrimary, ...(canSolve ? {} : styles.btnDisabled) }}
                >
                  {solving ? "Solving…" : "Generate seating"}
                </button>

                {solving ? (
                  <button type="button" onClick={cancel} className="cp-hover cp-focus" style={styles.btnSecondary}>
                    Cancel
                  </button>
                ) : null}
                {status === "success" || status === "error" ? (
                  <button type="button" onClick={reset} className="cp-hover cp-focus" style={styles.btnSecondary}>
                    Clear
                  </button>
                ) : null}
              </div>

              {missing.length > 0 ? (
                <p style={styles.warn}>
                  To get started, {missing.join(" and ")}.{" "}
                  <Link to="/designer" className="cp-focus" style={styles.link}>
                    Hall designer
                  </Link>{" "}
                  ·{" "}
                  <Link to="/guests" className="cp-focus" style={styles.link}>
                    Guests
                  </Link>
                </p>
              ) : null}
            </section>

            {status === "error" && error ? (
              <div style={styles.error} role="alert">
                <strong>{error}</strong>
                {errorDetails.length > 0 ? (
                  <ul style={styles.errorList}>
                    {errorDetails.slice(0, 10).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                    {errorDetails.length > 10 ? <li>…and {errorDetails.length - 10} more</li> : null}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {status === "success" && result ? <ResultsView result={result} /> : null}

            <div style={styles.links}>
              <Link to="/constraints" className="cp-hover cp-focus" style={styles.back}>
                Back: Rules
              </Link>
              <Link to="/guests" className="cp-hover cp-focus" style={styles.back}>
                Back: Guests
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}