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

  // pruneZones is a no-op when nothing is stale, so this cannot loop.
  useEffect(() => {
    pruneZones(summary.tables.map((t) => t.id));
  }, [summary, pruneZones]);

  return (
    <section style={styles.section} aria-labelledby="table-zones-heading">
      <h2 id="table-zones-heading" style={styles.heading}>
        Table zones
      </h2>
      <p style={styles.help}>Tables without a zone are Mixed.</p>
      {summary.tables.length === 0 ? (
        <p style={styles.empty}>
          No tables yet. Add tables in the <Link to="/designer">Hall Designer</Link>.
        </p>
      ) : (
        <>
          <div style={styles.bulk}>
            <label htmlFor="zones-bulk">Set all tables to</label>
            <select
              id="zones-bulk"
              value=""
              onChange={(e) => {
                const zone = parseOption(ZONES, e.target.value);
                if (zone) setZones(summary.tables.map((t) => t.id), zone);
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
            {summary.tables.map((table) => (
              <li key={table.id} style={styles.item}>
                <span style={styles.tableName}>{table.label}</span>
                <span style={styles.capacity}>{table.capacity} seats</span>
                <select
                  aria-label={`Zone for ${table.label}`}
                  value={zoneForTable(zones, table.id)}
                  onChange={(e) => {
                    const zone = parseOption(ZONES, e.target.value);
                    if (zone) setZone(table.id, zone);
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