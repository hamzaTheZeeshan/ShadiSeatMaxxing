import type { CSSProperties } from "react";
import { AGE_BANDS, GENDERS, SIDES } from "../types/guestSchema";
import type { EnumOption } from "../types/guestSchema";
import type { GuestStats } from "../utils/guestStats";

interface GuestSummaryProps {
  stats: GuestStats;
}

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
  } satisfies CSSProperties,
  headline: { display: "flex", alignItems: "baseline", gap: 8 } satisfies CSSProperties,
  total: { fontSize: 32, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
  } satisfies CSSProperties,
  card: { padding: 10, background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#374151" } satisfies CSSProperties,
  cardTitle: { margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" } satisfies CSSProperties,
  line: { display: "flex", justifyContent: "space-between", gap: 8 } satisfies CSSProperties,
  seat: { padding: "8px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600 } satisfies CSSProperties,
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
      style: { ...styles.seat, background: "#fffbeb", color: "#b45309" },
    };
  }
  if (stats.status === "over_capacity") {
    const over = Math.abs(stats.seatDelta);
    return {
      text: `${over} ${over === 1 ? "guest" : "guests"} over capacity`,
      style: { ...styles.seat, background: "#fef2f2", color: "#b91c1c" },
    };
  }
  return {
    text: `${stats.seatDelta} ${stats.seatDelta === 1 ? "seat" : "seats"} free`,
    style: { ...styles.seat, background: "#f0fdf4", color: "#15803d" },
  };
}

export default function GuestSummary({ stats }: GuestSummaryProps) {
  const banner = seatBanner(stats);
  return (
    <section style={styles.wrap} aria-label="Guest summary">
      <div style={styles.headline}>
        <span style={styles.total}>{stats.total}</span>
        <span style={{ fontSize: 14, color: "#4b5563" }}>
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