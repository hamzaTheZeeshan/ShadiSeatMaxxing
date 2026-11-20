import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { parseOption } from "../../guests/types/guestSchema";
import { useEditorStore } from "../../hall-designer/store/editorStore";
import { useConstraintStore } from "../store/constraintStore";
import { DEFAULT_ZONE, ZONES, zoneForTable } from "../types/constraintSchema";
import { summarizeLayout } from "../utils/layoutSummary";

const styles = {
  section: { margin: "0 0 24px", padding: 16, border: "1px solid #d1d5db", borderRadius: 10, background: "#ffffff" } satisfies CSSProperties,
  heading: { margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  help: { margin: "0 0 12px", fontSize: 13, color: "#4b5563" } satisfies CSSProperties,
  bulk: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 14 } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  item: { display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "#111827" } satisfies CSSProperties,
  tableName: { width: 56, fontWeight: 600 } satisfies CSSProperties,
  capacity: { width: 90, color: "#4b5563" } satisfies CSSProperties,
  empty: { margin: 0, fontSize: 14, color: "#4b5563" } satisfies CSSProperties,
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
          No tables or sofas yet. Add some in the <Link to="/designer">Hall Designer</Link>.
        </p>
      ) : (
        <>
          <div style={styles.bulk}>
            <label htmlFor="zones-bulk">Set all tables and sofas to</label>
            <select
              id="zones-bulk"
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