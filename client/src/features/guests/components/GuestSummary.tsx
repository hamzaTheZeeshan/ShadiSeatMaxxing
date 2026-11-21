import type { CSSProperties } from "react";
import { AGE_BANDS, GENDERS, SIDES } from "../types/guestSchema";
import type { EnumOption } from "../types/guestSchema";
import type { GuestStats } from "../utils/guestStats";

interface GuestSummaryProps {
  stats: GuestStats;
}

// Neo-brutalist theme, same palette as the home page.
const INK = "#111111";
const CREAM = "#fff4dc";
const MINT = "#a8d5b5";
const YELLOW = "#f8c335";
const MUTED = "#4b4b4b";

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    background: "#ffffff",
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
  } satisfies CSSProperties,
  headline: { display: "flex", alignItems: "baseline", gap: 8 } satisfies CSSProperties,
  total: { fontSize: 32, fontWeight: 700, color: INK } satisfies CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
  } satisfies CSSProperties,
  card: { padding: 10, background: CREAM, border: `2px solid ${INK}`, fontSize: 12, color: INK } satisfies CSSProperties,
  cardTitle: {
    margin: "0 0 8px",
    paddingBottom: 4,
    borderBottom: `2px solid ${INK}`,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: INK,
    textTransform: "uppercase",
  } satisfies CSSProperties,
  line: { display: "flex", justifyContent: "space-between", gap: 8, padding: "1px 0" } satisfies CSSProperties,
  seat: {
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 700,
    color: INK,
    border: `2px solid ${INK}`,
  } satisfies CSSProperties,
};

function CountCard<T extends string>({
  title,
  options,
  counts,
}: {
  title: string;
  options: ReadonlyArray<EnumOption<T>>;
  counts: Record<T, number>;
}) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{title}</h3>
      {options.map((o) => (
        <div key={o.value} style={styles.line}>
          <span>{o.label}</span>
          <strong>{counts[o.value]}</strong>
        </div>
      ))}
    </div>
  );
}

function seatBanner(stats: GuestStats): { text: string; style: CSSProperties } {
  if (stats.status === "no_tables") {
    return {
      text: "No tables placed yet. Add tables in the Hall Designer.",
      style: { ...styles.seat, background: YELLOW },
    };
  }
  if (stats.status === "over_capacity") {
    const over = Math.abs(stats.seatDelta);
    return {
      text: `${over} ${over === 1 ? "guest" : "guests"} over capacity`,
      style: { ...styles.seat, background: "#ff9a9a" },
    };
  }
  return {
    text: `${stats.seatDelta} ${stats.seatDelta === 1 ? "seat" : "seats"} free`,
    style: { ...styles.seat, background: MINT },
  };
}

export default function GuestSummary({ stats }: GuestSummaryProps) {
  const banner = seatBanner(stats);
  return (
    <section style={styles.wrap} aria-label="Guest summary">
      <div style={styles.headline}>
        <span style={styles.total}>{stats.total}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>
          {stats.total === 1 ? "guest" : "guests"} · {stats.totalSeats} table seats
        </span>
      </div>
      <div role="status" style={banner.style}>
        {banner.text}
      </div>
      <div style={styles.grid}>
        <CountCard title="By side" options={SIDES} counts={stats.bySide} />
        <CountCard title="By gender" options={GENDERS} counts={stats.byGender} />
        <CountCard title="By age band" options={AGE_BANDS} counts={stats.byAgeBand} />
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Needs attention</h3>
          <div style={styles.line}>
            <span>VIP / chief guest</span>
            <strong>{stats.vipCount}</strong>
          </div>
          <div style={styles.line}>
            <span>Mobility</span>
            <strong>{stats.mobilityCount}</strong>
          </div>
          <div style={styles.line}>
            <span>Dietary</span>
            <strong>{stats.dietaryCount}</strong>
          </div>
        </div>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top households</h3>
          {stats.byHousehold.length === 0 ? (
            <span>None yet</span>
          ) : (
            stats.byHousehold.map((h) => (
              <div key={h.household} style={styles.line}>
                <span>{h.household}</span>
                <strong>{h.count}</strong>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}