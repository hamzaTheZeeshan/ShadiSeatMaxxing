import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useConstraintStore } from "../features/constraints/store/constraintStore";
import { useGuestStore } from "../features/guests/store/guestStore";

/* ---------- theme ---------- */
const ACCENT = "#ff2e5b";
const ACCENT_DARK = "#e11d48";
const ACCENT_SOFT = "#fff1f3";
const INK = "#1f2937";
const MUTED = "#6b7280";
const BORDER = "#fde2e7";

// File lives in client/public, so it is served from the site root. Spaces get URL-encoded.
const HERO_IMAGE = encodeURI("/Joyful South Asian Wedding Couple.png");

/* ---------- icons (inline, no extra dependency) ---------- */
type IconName = "hall" | "guests" | "rules" | "results" | "search" | "layout" | "heart" | "check";

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
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
};

function Icon({ name, size = 26 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ACCENT}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* ---------- data shapes ---------- */
interface Tile {
  label: string;
  icon: IconName;
  to?: string;
  subtitle?: string;
}

interface HowStep {
  icon: IconName;
  title: string;
  text: string;
}

const HOW_STEPS: HowStep[] = [
  { icon: "layout", title: "1. Design your hall", text: "Place tables and set up the room layout." },
  { icon: "guests", title: "2. Add guests", text: "Build your guest list and group people." },
  { icon: "rules", title: "3. Set rules", text: "Choose who sits together, and who doesn't." },
  { icon: "check", title: "4. Get your seating", text: "Review the arrangement and finalize it." },
];

/* ---------- styles ---------- */
const styles = {
  page: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "32px 16px 48px",
    background: `linear-gradient(180deg, ${ACCENT_SOFT} 0%, #ffffff 60%)`,
    fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: INK,
  } satisfies CSSProperties,
  inner: { maxWidth: 1040, margin: "0 auto" } satisfies CSSProperties,

  /* hero */
  hero: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 32,
    alignItems: "center",
    padding: "24px 0 40px",
  } satisfies CSSProperties,
  eyebrow: {
    margin: "0 0 12px",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.18em",
    color: ACCENT,
  } satisfies CSSProperties,
  h1: { margin: 0, fontSize: 44, lineHeight: 1.1, fontWeight: 700, color: INK } satisfies CSSProperties,
  h1Accent: { display: "block", color: ACCENT } satisfies CSSProperties,
  lead: {
    margin: "16px 0 24px",
    fontSize: 16,
    lineHeight: 1.6,
    color: MUTED,
    maxWidth: 420,
  } satisfies CSSProperties,
  buttonRow: { display: "flex", flexWrap: "wrap", gap: 12 } satisfies CSSProperties,
  btnPrimary: {
    display: "inline-block",
    padding: "12px 24px",
    borderRadius: 10,
    background: ACCENT,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 600,
    textDecoration: "none",
    boxShadow: "0 6px 16px rgba(255, 46, 91, 0.3)",
  } satisfies CSSProperties,
  btnSecondary: {
    display: "inline-block",
    padding: "12px 24px",
    borderRadius: 10,
    background: "#ffffff",
    color: INK,
    fontSize: 15,
    fontWeight: 600,
    textDecoration: "none",
    border: `1px solid ${BORDER}`,
  } satisfies CSSProperties,
  heroImage: {
    width: "100%",
    aspectRatio: "4 / 3",
    borderRadius: 20,
    boxShadow: "0 20px 40px rgba(255, 46, 91, 0.18)",
    backgroundImage: `url("${HERO_IMAGE}"), linear-gradient(135deg, #ffd6de 0%, #ffb3c2 50%, #ff8aa3 100%)`,
    backgroundSize: "cover",
    backgroundPosition: "center top",
  } satisfies CSSProperties,

  /* quick-access tiles */
  tiles: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 16,
  } satisfies CSSProperties,
  tile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: "100%",
    minHeight: 120,
    padding: 16,
    borderRadius: 14,
    background: "#ffffff",
    border: `1px solid ${BORDER}`,
    boxShadow: "0 4px 14px rgba(255, 46, 91, 0.06)",
    textAlign: "center",
    textDecoration: "none",
    color: INK,
  } satisfies CSSProperties,
  tileDisabled: { opacity: 0.55, cursor: "not-allowed" } satisfies CSSProperties,
  tileLabel: { fontSize: 15, fontWeight: 600 } satisfies CSSProperties,
  tileSub: { fontSize: 12, color: MUTED } satisfies CSSProperties,

  /* how it works */
  section: { padding: "56px 0 8px", textAlign: "center" } satisfies CSSProperties,
  h2: { margin: 0, fontSize: 30, fontWeight: 700 } satisfies CSSProperties,
  h2Accent: { color: ACCENT } satisfies CSSProperties,
  sectionSub: { margin: "8px 0 32px", fontSize: 15, color: MUTED } satisfies CSSProperties,
  how: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 24,
  } satisfies CSSProperties,
  howIcon: {
    width: 64,
    height: 64,
    margin: "0 auto 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    background: "#ffffff",
    border: `1px solid ${BORDER}`,
    boxShadow: "0 4px 14px rgba(255, 46, 91, 0.08)",
  } satisfies CSSProperties,
  howTitle: { margin: "0 0 4px", fontSize: 16, fontWeight: 600 } satisfies CSSProperties,
  howText: { margin: 0, fontSize: 14, lineHeight: 1.5, color: MUTED } satisfies CSSProperties,

  /* closing CTA */
  cta: {
    marginTop: 56,
    padding: "32px 28px",
    borderRadius: 20,
    background: `linear-gradient(120deg, ${ACCENT_SOFT} 0%, #ffd6de 100%)`,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  } satisfies CSSProperties,
  ctaTitle: { margin: "0 0 6px", fontSize: 26, fontWeight: 700 } satisfies CSSProperties,
  ctaText: { margin: "0 0 18px", fontSize: 15, color: MUTED } satisfies CSSProperties,
};

/* ---------- page ---------- */
export default function HomePage() {
  const guestCount = useGuestStore((s) => s.guests.length);
  const ruleCount = useConstraintStore((s) => s.rules.length);

  const tiles: Tile[] = [
    { label: "Design hall", icon: "hall", to: "/designer" },
    {
      label: "Manage guests",
      icon: "guests",
      to: "/guests",
      subtitle: guestCount > 0 ? `${guestCount} ${guestCount === 1 ? "guest" : "guests"}` : "",
    },
    {
      label: "Set rules",
      icon: "rules",
      to: "/constraints",
      subtitle: ruleCount > 0 ? `${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}` : "",
    },
    { label: "Results", icon: "results", subtitle: "Coming soon" },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        {/* Hero */}
        <section style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>PLAN · VISUALIZE · CELEBRATE</p>
            <h1 style={styles.h1}>
              Your dream wedding,
              <span style={styles.h1Accent}>made simple</span>
            </h1>
            <p style={styles.lead}>
              Design your hall layout, add your guests, and set seating rules, all in one place.
            </p>
            <div style={styles.buttonRow}>
              <Link to="/designer" style={styles.btnPrimary}>
                Start planning
              </Link>
              <Link to="/guests" style={styles.btnSecondary}>
                Manage guests
              </Link>
            </div>
          </div>
          <div style={styles.heroImage} role="img" aria-label="Joyful South Asian wedding couple" />
        </section>

        {/* Quick access */}
        <ul style={styles.tiles}>
          {tiles.map((tile) => (
            <li key={tile.label}>
              {tile.to ? (
                <Link to={tile.to} style={styles.tile}>
                  <Icon name={tile.icon} />
                  <span style={styles.tileLabel}>{tile.label}</span>
                  {tile.subtitle ? <span style={styles.tileSub}>{tile.subtitle}</span> : null}
                </Link>
              ) : (
                <div aria-disabled="true" style={{ ...styles.tile, ...styles.tileDisabled }}>
                  <Icon name={tile.icon} />
                  <span style={styles.tileLabel}>{tile.label}</span>
                  {tile.subtitle ? <span style={styles.tileSub}>{tile.subtitle}</span> : null}
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* How it works */}
        <section style={styles.section}>
          <h2 style={styles.h2}>
            How it <span style={styles.h2Accent}>works</span>
          </h2>
          <p style={styles.sectionSub}>Plan your seating in four steps.</p>
          <ol style={styles.how}>
            {HOW_STEPS.map((step) => (
              <li key={step.title}>
                <div style={styles.howIcon}>
                  <Icon name={step.icon} />
                </div>
                <h3 style={styles.howTitle}>{step.title}</h3>
                <p style={styles.howText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing CTA */}
        <section style={styles.cta}>
          <div>
            <h2 style={styles.ctaTitle}>
              Ready to plan your <span style={styles.h2Accent}>perfect wedding?</span>
            </h2>
            <p style={styles.ctaText}>Start with your hall layout. Everything else builds on it.</p>
            <Link to="/designer" style={styles.btnPrimary}>
              Get started
            </Link>
          </div>
          <Icon name="heart" size={72} />
        </section>
      </div>
    </div>
  );
}