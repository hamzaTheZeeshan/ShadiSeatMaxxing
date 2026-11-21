import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { parseOption } from "../../guests/types/guestSchema";
import { useEditorStore } from "../../hall-designer/store/editorStore";
import { useConstraintStore } from "../store/constraintStore";
import { DEFAULT_ZONE, ZONES, zoneForTable } from "../types/constraintSchema";
import { summarizeLayout } from "../utils/layoutSummary";

/* ---------- theme (same as constraints page) ---------- */
const INK = "#111111";
const CREAM = "#fff4dc";
const MINT = "#a8d5b5";
const WHITE = "#ffffff";
const MUTED = "#4b4b4b";

const styles = {
  section: {
    margin: "0 0 24px",
    padding: 16,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: WHITE,
    boxShadow: `4px 4px 0 ${INK}`,
    color: INK,
  } satisfies CSSProperties,
  heading: {
    margin: "0 0 8px",
    padding: "0 0 8px",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    borderBottom: `2px solid ${INK}`,
    color: INK,
  } satisfies CSSProperties,
  help: { margin: "0 0 14px", fontSize: 12, lineHeight: 1.5, color: MUTED } satisfies CSSProperties,
  bulk: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    padding: 10,
    background: MINT,
    border: `2px solid ${INK}`,
    fontSize: 12,
    fontWeight: 700,
  } satisfies CSSProperties,
  select: {
    padding: "6px 8px",
    fontFamily: "inherit",
    fontSize: 12,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: WHITE,
    color: INK,
    cursor: "pointer",
  } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  item: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    padding: "8px 10px",
    background: CREAM,
    border: `2px solid ${INK}`,
    fontSize: 12,
    color: INK,
  } satisfies CSSProperties,
  tableName: { minWidth: 64, fontWeight: 700 } satisfies CSSProperties,
  capacity: { minWidth: 80, color: MUTED } satisfies CSSProperties,
  empty: { margin: 0, fontSize: 12, color: MUTED } satisfies CSSProperties,
  link: { color: INK, fontWeight: 700, textDecoration: "underline" } satisfies CSSProperties,
};

export default function TableZonesPanel() {
  const objects = useEditorStore((s) => s.objects);
  const zones = useConstraintStore((s) => s.zones);
  const setZone = useConstraintStore((s) => s.setZone);
  const setZones = useConstraintStore((s) => s.setZones);
  const pruneZones = useConstraintStore((s) => s.pruneZones);

  const summary = useMemo(() => summarizeLayout(objects), [objects]);

  // Tables and sofas share one zone map and one list of seating objects.
  const seating = useMemo(() => [...summary.tables, ...summary.sofas], [summary]);

  // pruneZones is a no-op when nothing is stale, so this cannot loop.
  useEffect(() => {
    pruneZones(seating.map((t) => t.id));
  }, [seating, pruneZones]);

  return (
    <section style={styles.section} aria-labelledby="table-zones-heading">
      <h2 id="table-zones-heading" style={styles.heading}>
        Table and sofa zones
      </h2>
      <p style={styles.help}>Tables and sofas without a zone are Mixed.</p>
      {seating.length === 0 ? (
        <p style={styles.empty}>
          No tables or sofas yet. Add some in the{" "}
          <Link to="/designer" className="cp-focus" style={styles.link}>
            Hall Designer
          </Link>
          .
        </p>
      ) : (
        <>
          <div style={styles.bulk}>
            <label htmlFor="zones-bulk">Set all tables and sofas to</label>
            <select
              id="zones-bulk"
              className="cp-focus"
              style={styles.select}
              value=""
              onChange={(e) => {
                const zone = parseOption(ZONES, e.target.value);
                if (zone) setZones(seating.map((t) => t.id), zone);
              }}
            >
              <option value="">Choose zone…</option>
              {ZONES.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>
          <ul style={styles.list}>
            {seating.map((item) => (
              <li key={item.id} style={styles.item}>
                <span style={styles.tableName}>{item.label}</span>
                <span style={styles.capacity}>{item.capacity} seats</span>
                <select
                  aria-label={`Zone for ${item.label}`}
                  className="cp-focus"
                  style={styles.select}
                  value={zoneForTable(zones, item.id)}
                  onChange={(e) => {
                    const zone = parseOption(ZONES, e.target.value);
                    if (zone) setZone(item.id, zone);
                  }}
                >
                  {ZONES.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                      {z.value === DEFAULT_ZONE ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}