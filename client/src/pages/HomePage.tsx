import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useConstraintStore } from "../features/constraints/store/constraintStore";
import { useGuestStore } from "../features/guests/store/guestStore";
import { useSeatingStore } from "../features/seating/store/seatingStore";

/* ---------- config ---------- */
// Set to false if your app shell already renders its own sidebar.
const SHOW_SIDEBAR = true;
const APP_NAME = "SEATPLAN";

/* ---------- theme (neo-brutalist) ---------- */
const INK = "#111111";
const CREAM = "#fff4dc";
const MINT = "#a8d5b5";
const YELLOW = "#f8c335";
const PINK = "#f6b8f6";
const WHITE = "#ffffff";
const MUTED = "#4b4b4b";

// File lives in client/public, so it is served from the site root. Spaces get URL-encoded.
const HERO_IMAGE = encodeURI("/Joyful South Asian Wedding Couple.png");

const FONT = "'IBM Plex Mono', 'JetBrains Mono', 'Courier New', ui-monospace, monospace";

/* ---------- global CSS (hard shadows, hover, responsive grids) ---------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

.sp-card { border: 2px solid ${INK}; background: ${WHITE}; box-shadow: 4px 4px 0 ${INK}; }
.sp-hover { transition: transform .12s ease, box-shadow .12s ease; }
.sp-hover:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 ${INK}; }
.sp-hover:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 ${INK}; }
.sp-navlink:hover { background: rgba(17,17,17,0.1); }
.sp-focus:focus-visible { outline: 3px solid ${INK}; outline-offset: 2px; }

.sp-window { display: grid; grid-template-columns: 200px minmax(0, 1fr); }
.sp-window.sp-noside { grid-template-columns: minmax(0, 1fr); }
.sp-top { display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr); gap: 28px; align-items: start; }
.sp-profile { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 16px; }
.sp-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }

@media (max-width: 1000px) {
  .sp-top { grid-template-columns: minmax(0, 1fr); }
  .sp-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .sp-window { grid-template-columns: minmax(0, 1fr); }
  .sp-side { display: none; }
  .sp-profile { grid-template-columns: minmax(0, 1fr); }
  .sp-cards { grid-template-columns: minmax(0, 1fr); }
  .sp-main { margin: 10px !important; }
}
@media (prefers-reduced-motion: reduce) {
  .sp-hover { transition: none; }
}
`;

/* ---------- icons (inline, no extra dependency) ---------- */
type IconName = "hall" | "guests" | "rules" | "results" | "layout" | "heart" | "check" | "arrow";

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
  check: <polyline points="20 6 9 17 4 12" />,
  arrow: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
};

function Icon({ name, size = 18, color = INK }: { name: IconName; size?: number; color?: string }) {
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

/* ---------- data ---------- */
interface NavItem {
  label: string;
  icon: IconName;
  to: string;
  active?: boolean;
}

const NAV: NavItem[] = [
  { label: "Home", icon: "hall", to: "/", active: true },
  { label: "Design hall", icon: "layout", to: "/designer" },
  { label: "Guests", icon: "guests", to: "/guests" },
  { label: "Rules", icon: "rules", to: "/constraints" },
  { label: "Results", icon: "results", to: "/results" },
];

interface HowStep {
  icon: IconName;
  title: string;
  text: string;
  step: string;
}

const HOW_STEPS: HowStep[] = [
  { icon: "layout", title: "Design your hall", text: "Place tables and set up the room layout.", step: "Step 1" },
  { icon: "guests", title: "Add guests", text: "Build your guest list and group people.", step: "Step 2" },
  { icon: "rules", title: "Set rules", text: "Choose who sits together, and who doesn't.", step: "Step 3" },
  { icon: "check", title: "Get your seating", text: "Review the arrangement and finalize it.", step: "Step 4" },
];

interface QuickCard {
  label: string;
  icon: IconName;
  to: string;
  sub: string;
  body: string;
}

/* ---------- styles ---------- */
const styles = {
  page: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overflowX: "hidden",
    padding: 16,
    boxSizing: "border-box",
    background: `linear-gradient(115deg, #5bb8ff 0 18%, #ffd0a8 18% 40%, #ff9a6b 40% 62%, #ffb3d1 62% 100%)`,
    fontFamily: FONT,
    color: INK,
  } satisfies CSSProperties,
  window: {
    flex: 1,
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

  /* main panel */
  main: {
    margin: "12px 12px 12px 0",
    padding: "28px 32px 32px",
    background: CREAM,
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
    minWidth: 0,
  } satisfies CSSProperties,

  h1: { margin: "0 0 18px", fontSize: 38, lineHeight: 1.1, fontWeight: 700 } satisfies CSSProperties,
  h2: { margin: 0, fontSize: 38, lineHeight: 1.1, fontWeight: 700 } satisfies CSSProperties,
  h3Small: { margin: "0 0 14px", fontSize: 20, fontWeight: 700 } satisfies CSSProperties,

  /* profile (hero) card */
  profile: { background: YELLOW, padding: 14 } satisfies CSSProperties,
  photoWrap: {
    position: "relative",
    border: `2px solid ${INK}`,
    background: YELLOW,
    overflow: "hidden",
    minHeight: 190,
  } satisfies CSSProperties,
  blob: {
    position: "absolute",
    left: -24,
    bottom: -24,
    width: 100,
    height: 100,
    borderRadius: "50%",
    background: "#fbd96b",
  } satisfies CSSProperties,
  photo: {
    position: "absolute",
    inset: 0,
    backgroundImage: `url("${HERO_IMAGE}"), linear-gradient(135deg, #ffd6de 0%, #ffb3c2 50%, #ff8aa3 100%)`,
    backgroundSize: "cover",
    backgroundPosition: "center top",
  } satisfies CSSProperties,
  nameRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } satisfies CSSProperties,
  name: { margin: 0, fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  tagline: { margin: "2px 0 10px", fontSize: 11, color: MUTED } satisfies CSSProperties,
  miniIcons: { display: "flex", gap: 6 } satisfies CSSProperties,
  miniIcon: {
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: `2px solid ${INK}`,
    background: WHITE,
    textDecoration: "none",
  } satisfies CSSProperties,
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
    gap: 6,
    marginBottom: 12,
  } satisfies CSSProperties,
  stat: {
    padding: "6px 4px",
    border: `2px solid ${INK}`,
    background: "#fbd24f",
    textAlign: "center",
  } satisfies CSSProperties,
  statValue: { display: "block", fontSize: 16, fontWeight: 700 } satisfies CSSProperties,
  statLabel: { display: "block", fontSize: 9, color: MUTED } satisfies CSSProperties,
  bio: { margin: "0 0 14px", fontSize: 11, lineHeight: 1.55 } satisfies CSSProperties,
  btnRow: { display: "flex", flexWrap: "wrap", gap: 10 } satisfies CSSProperties,
  btnDark: {
    flex: "1 1 120px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "9px 12px",
    border: `2px solid ${INK}`,
    background: INK,
    color: WHITE,
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    textDecoration: "none",
  } satisfies CSSProperties,
  btnLight: {
    flex: "1 1 120px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 12px",
    border: `2px solid ${INK}`,
    background: CREAM,
    color: INK,
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    textDecoration: "none",
  } satisfies CSSProperties,

  /* how it works (right column) */
  howList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  howItem: { display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px" } satisfies CSSProperties,
  howIcon: {
    width: 30,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: INK,
    flexShrink: 0,
  } satisfies CSSProperties,
  howTitle: { margin: 0, fontSize: 12, fontWeight: 700 } satisfies CSSProperties,
  howText: { margin: "2px 0 6px", fontSize: 11, color: MUTED, lineHeight: 1.4 } satisfies CSSProperties,
  howStep: { fontSize: 10, color: MUTED } satisfies CSSProperties,

  /* quick access */
  sectionHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    margin: "36px 0 16px",
    flexWrap: "wrap",
  } satisfies CSSProperties,
  viewAll: {
    padding: "5px 12px",
    border: `2px solid ${INK}`,
    background: WHITE,
    color: INK,
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 600,
    textDecoration: "none",
  } satisfies CSSProperties,
  pinkCard: { background: PINK, display: "flex", flexDirection: "column" } satisfies CSSProperties,
  pinkTop: { padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 } satisfies CSSProperties,
  pinkStatus: { display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  pinkBtn: {
    alignSelf: "flex-start",
    padding: "4px 10px",
    border: `2px solid ${INK}`,
    background: WHITE,
    color: INK,
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 600,
    textDecoration: "none",
  } satisfies CSSProperties,
  pinkBottom: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    padding: "10px 14px",
    borderTop: `2px solid ${INK}`,
    background: PINK,
  } satisfies CSSProperties,
  bigNumber: { display: "block", fontSize: 28, fontWeight: 700, lineHeight: 1 } satisfies CSSProperties,
  bigLabel: { display: "block", fontSize: 10, color: MUTED, marginTop: 4 } satisfies CSSProperties,
  quickCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 14,
    color: INK,
    textDecoration: "none",
    height: "100%",
    boxSizing: "border-box",
  } satisfies CSSProperties,
  quickHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 700 } satisfies CSSProperties,
  quickSub: { fontSize: 10, color: MUTED } satisfies CSSProperties,
  quickBody: { margin: "6px 0 0", fontSize: 11, lineHeight: 1.5 } satisfies CSSProperties,
  quickOpen: { marginTop: "auto", paddingTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 } satisfies CSSProperties,
};

/* ---------- page ---------- */
export default function HomePage() {
  const guestCount = useGuestStore((s) => s.guests.length);
  const ruleCount = useConstraintStore((s) => s.rules.length);
  const seatingStatus = useSeatingStore((s) => s.status);

  const planLabel =
    seatingStatus === "solving"
      ? "Solving…"
      : seatingStatus === "success"
        ? "Plan ready"
        : seatingStatus === "error"
          ? "Last run failed"
          : "Not started";

  const planStat =
    seatingStatus === "solving"
      ? "Solving"
      : seatingStatus === "success"
        ? "Ready"
        : seatingStatus === "error"
          ? "Failed"
          : "Not yet";

  const cards: QuickCard[] = [
    {
      label: "Design hall",
      icon: "layout",
      to: "/designer",
      sub: "Layout",
      body: "Place tables and set up the room exactly how your venue looks.",
    },
    {
      label: "Manage guests",
      icon: "guests",
      to: "/guests",
      sub: guestCount > 0 ? `${guestCount} ${guestCount === 1 ? "guest" : "guests"}` : "No guests yet",
      body: "Build your guest list and group family and friends together.",
    },
    {
      label: "Set rules",
      icon: "rules",
      to: "/constraints",
      sub: ruleCount > 0 ? `${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}` : "No rules yet",
      body: "Choose who sits together, and who definitely doesn't.",
    },
  ];

  return (
    <div style={styles.page}>
      <style>{CSS}</style>

      <div className={`sp-window${SHOW_SIDEBAR ? "" : " sp-noside"}`} style={styles.window}>
        {/* Sidebar */}
        {SHOW_SIDEBAR ? (
          <aside className="sp-side" style={styles.side}>
            <div style={styles.logo}>
              <span aria-hidden="true">{"</>"}</span>
              {APP_NAME}
            </div>
            <nav aria-label="Main" style={styles.nav}>
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="sp-navlink sp-focus"
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

        {/* Main panel */}
        <div className="sp-main" style={SHOW_SIDEBAR ? styles.main : { ...styles.main, margin: 12 }}>
          {/* Title + profile / how it works */}
          <div className="sp-top">
            <div>
              <h1 style={styles.h1}>Your wedding</h1>
              <section className="sp-card" style={styles.profile} aria-label="Wedding overview">
                <div className="sp-profile">
                  <div style={styles.photoWrap} role="img" aria-label="Joyful South Asian wedding couple">
                    <div style={styles.blob} />
                    <div style={styles.photo} />
                  </div>
                  <div>
                    <div style={styles.nameRow}>
                      <h2 style={styles.name}>Your dream wedding</h2>
                      <div style={styles.miniIcons}>
                        <Link to="/designer" className="sp-focus" style={styles.miniIcon} aria-label="Design hall">
                          <Icon name="layout" size={12} />
                        </Link>
                        <Link to="/guests" className="sp-focus" style={styles.miniIcon} aria-label="Guests">
                          <Icon name="guests" size={12} />
                        </Link>
                        <Link to="/constraints" className="sp-focus" style={styles.miniIcon} aria-label="Rules">
                          <Icon name="rules" size={12} />
                        </Link>
                      </div>
                    </div>
                    <p style={styles.tagline}>Plan. Visualize. Celebrate.</p>

                    <div style={styles.stats}>
                      <div style={styles.stat}>
                        <span style={styles.statValue}>{guestCount}</span>
                        <span style={styles.statLabel}>guests</span>
                      </div>
                      <div style={styles.stat}>
                        <span style={styles.statValue}>{ruleCount}</span>
                        <span style={styles.statLabel}>rules</span>
                      </div>
                      <div style={styles.stat}>
                        <span style={styles.statValue}>{planStat}</span>
                        <span style={styles.statLabel}>seating plan</span>
                      </div>
                      <div style={styles.stat}>
                        <span style={styles.statValue}>4</span>
                        <span style={styles.statLabel}>steps</span>
                      </div>
                    </div>

                    <p style={styles.bio}>
                      Design your hall layout, add your guests, and set seating rules, all in one place. Start with the
                      room and everything else builds on it.
                    </p>

                    <div style={styles.btnRow}>
                      <Link to="/designer" className="sp-hover sp-focus" style={styles.btnDark}>
                        <Icon name="arrow" size={14} color={WHITE} />
                        Start planning
                      </Link>
                      <Link to="/guests" className="sp-hover sp-focus" style={styles.btnLight}>
                        Manage guests
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section aria-label="How it works">
              <h2 style={styles.h3Small}>How it works</h2>
              <ol style={styles.howList}>
                {HOW_STEPS.map((step) => (
                  <li key={step.title} className="sp-card" style={styles.howItem}>
                    <span style={styles.howIcon}>
                      <Icon name={step.icon} size={14} color={WHITE} />
                    </span>
                    <div>
                      <h3 style={styles.howTitle}>{step.title}</h3>
                      <p style={styles.howText}>{step.text}</p>
                      <span style={styles.howStep}>{step.step}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Quick access */}
          <div style={styles.sectionHead}>
            <h2 style={styles.h2}>Quick access</h2>
            <Link to="/designer" className="sp-hover sp-focus" style={styles.viewAll}>
              Start over
            </Link>
          </div>

          <div className="sp-cards">
            <div className="sp-card" style={styles.pinkCard}>
              <div style={styles.pinkTop}>
                <div style={styles.pinkStatus}>
                  <Icon name="heart" size={20} />
                  {planLabel}
                </div>
                <Link to="/results" className="sp-hover sp-focus" style={styles.pinkBtn}>
                  See results
                </Link>
              </div>
              <div style={styles.pinkBottom}>
                <div>
                  <span style={styles.bigNumber}>{guestCount}</span>
                  <span style={styles.bigLabel}>guests to seat</span>
                </div>
                <svg width="96" height="44" viewBox="0 0 160 60" fill="none" aria-hidden="true">
                  <path
                    d="M2 50 C 20 8, 32 62, 52 38 S 84 4, 104 30 S 134 54, 158 12"
                    stroke={INK}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {cards.map((card) => (
              <Link key={card.label} to={card.to} className="sp-card sp-hover sp-focus" style={styles.quickCard}>
                <div style={styles.quickHead}>
                  <span>{card.label}</span>
                  <Icon name={card.icon} size={16} />
                </div>
                <span style={styles.quickSub}>{card.sub}</span>
                <p style={styles.quickBody}>{card.body}</p>
                <span style={styles.quickOpen}>
                  Open <Icon name="arrow" size={12} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}