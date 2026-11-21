import { useMemo, useState } from "react";
import { ZONES, zoneForTable } from "../../constraints/types/constraintSchema";
import {
  AGE_BANDS,
  DIETARY_OPTIONS,
  GENDERS,
  MOBILITY_LEVELS,
  ROLES,
  SIDES,
  VIP_LEVELS,
  optionLabel,
} from "../../guests/types/guestSchema";
import type { ConstraintContext } from "../utils/constraintReport";
import type { BrokenConstraint } from "../types/seatingResult";
import { badgeStyle, BORDER, MUTED, tabStyle, ui } from "../ui";

type View = "tables" | "guests";

const TABLE_FILTERS: ReadonlyArray<readonly [string, string]> = [
  ["all", "All"],
  ["table", "Tables only"],
  ["sofa", "Sofas only"],
  ["full", "Full"],
  ["has_empty", "Has empty seats"],
];
const GUEST_FILTERS: ReadonlyArray<readonly [string, string]> = [
  ["all", "All guests"],
  ["seated", "Seated"],
  ["unassigned", "Unassigned"],
  ["issues", "With broken constraints"],
];

interface Props {
  ctx: ConstraintContext;
  selectedGuestId: string | null;
  onSelectGuest: (id: string) => void;
}

export default function SeatingRoster({ ctx, selectedGuestId, onSelectGuest }: Props) {
  const { model } = ctx;
  const [view, setView] = useState<View>("tables");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const q = query.trim().toLowerCase();

  const issuesByGuest = useMemo(() => {
    const map = new Map<string, BrokenConstraint[]>();
    for (const b of ctx.broken) {
      for (const id of b.guest_ids) map.set(id, [...(map.get(id) ?? []), b]);
    }
    return map;
  }, [ctx.broken]);

  const tableRows = useMemo(
    () =>
      model.seatObjects.filter((so) => {
        const filled = so.slots.filter((s) => s.guest !== null).length;
        if (filter === "table" && so.kind !== "table") return false;
        if (filter === "sofa" && so.kind !== "sofa") return false;
        if (filter === "full" && filled < so.capacity) return false;
        if (filter === "has_empty" && filled >= so.capacity) return false;
        if (!q) return true;
        return (
          so.label.toLowerCase().includes(q) ||
          so.object.id.toLowerCase().includes(q) ||
          so.slots.some((s) => s.guest?.name.toLowerCase().includes(q))
        );
      }),
    [model, filter, q],
  );

  const guestRows = useMemo(
    () =>
      [...model.guestById.values()].filter((g) => {
        const placed = model.placementByGuest.has(g.id);
        if (filter === "seated" && !placed) return false;
        if (filter === "unassigned" && placed) return false;
        if (filter === "issues" && !issuesByGuest.has(g.id)) return false;
        if (!q) return true;
        const place = model.placementByGuest.get(g.id)?.seatObject.label ?? "";
        return [g.name, g.id, g.household, g.role, g.notes, place].some((v) => v.toLowerCase().includes(q));
      }),
    [model, filter, q, issuesByGuest],
  );

  const switchView = (next: View) => {
    setView(next);
    setFilter("all");
  };

  return (
    <section style={ui.card}>
      <h2 style={ui.h2}>Roster</h2>
      <div style={ui.toolbar}>
        <button type="button" style={tabStyle(view === "tables")} onClick={() => switchView("tables")}>
          By table ({model.seatObjects.length})
        </button>
        <button type="button" style={tabStyle(view === "guests")} onClick={() => switchView("guests")}>
          By guest ({model.guestById.size})
        </button>
        <input
          type="search"
          placeholder={view === "tables" ? "Search tables or guests…" : "Search name, household, table…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={ui.input}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={ui.input}>
          {(view === "tables" ? TABLE_FILTERS : GUEST_FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {view === "tables" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, maxHeight: 560, overflow: "auto" }}>
          {tableRows.length === 0 ? <p style={ui.muted}>No tables match.</p> : null}
          {tableRows.map((so) => {
            const filled = so.slots.filter((s) => s.guest !== null).length;
            return (
              <div key={so.object.id} style={{ border: `2px solid ${BORDER}`, background: "#fff4dc", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong>
                    {so.label} <span style={{ color: MUTED, fontWeight: 400 }}>· {so.kind}</span>
                  </strong>
                  <span style={badgeStyle(filled === so.capacity ? "good" : "neutral")}>
                    {filled}/{so.capacity}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: MUTED, margin: "2px 0 8px" }}>
                  {so.object.id} · zone {optionLabel(ZONES, zoneForTable(ctx.zones, so.object.id))}
                </div>
                <ol start={0} style={{ margin: 0, paddingLeft: 24, fontSize: 13 }}>
                  {so.slots.map((slot) => (
                    <li key={slot.index}>
                      {slot.guest ? (
                        <button
                          type="button"
                          onClick={() => onSelectGuest(slot.guest?.id ?? "")}
                          style={{
                            border: "none",
                            background: slot.guest.id === selectedGuestId ? "#f6b8f6" : "none",
                            padding: 0,
                            fontFamily: "inherit",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: 13,
                            color: issuesByGuest.has(slot.guest.id) ? "#b91c1c" : "inherit",
                          }}
                        >
                          {slot.guest.name}
                        </button>
                      ) : (
                        <span style={{ color: MUTED }}>empty</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={ui.tableWrap}>
          <table style={ui.table}>
            <thead>
              <tr>
                {["Name", "Household", "Side", "Gender", "Age", "Role", "VIP", "Mobility", "Dietary", "Table", "Seat", "Issues"].map((h) => (
                  <th key={h} style={ui.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guestRows.length === 0 ? (
                <tr>
                  <td style={ui.td} colSpan={12}>
                    No guests match.
                  </td>
                </tr>
              ) : null}
              {guestRows.map((g) => {
                const placement = model.placementByGuest.get(g.id);
                const issues = issuesByGuest.get(g.id)?.length ?? 0;
                return (
                  <tr
                    key={g.id}
                    onClick={() => onSelectGuest(g.id)}
                    style={{ cursor: "pointer", background: g.id === selectedGuestId ? "#f6b8f6" : undefined }}
                  >
                    <td style={ui.td}>{g.name}</td>
                    <td style={ui.td}>{g.household || "—"}</td>
                    <td style={ui.td}>{optionLabel(SIDES, g.side)}</td>
                    <td style={ui.td}>{optionLabel(GENDERS, g.gender)}</td>
                    <td style={ui.td}>{optionLabel(AGE_BANDS, g.age_band)}</td>
                    <td style={ui.td}>{optionLabel(ROLES, g.role)}</td>
                    <td style={ui.td}>{optionLabel(VIP_LEVELS, g.vip)}</td>
                    <td style={ui.td}>{optionLabel(MOBILITY_LEVELS, g.mobility)}</td>
                    <td style={ui.td}>{optionLabel(DIETARY_OPTIONS, g.dietary)}</td>
                    <td style={ui.td}>{placement ? placement.seatObject.label : <span style={badgeStyle("warn")}>Unassigned</span>}</td>
                    <td style={ui.td}>{placement ? placement.slot.index : "—"}</td>
                    <td style={ui.td}>{issues > 0 ? <span style={badgeStyle("bad")}>{issues}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}