import type { Guest } from "../../guests/types/guestSchema";
import { zoneForTable } from "../types/constraintSchema";
import type { ConstraintData, Rule, Zone } from "../types/constraintSchema";
import type { LayoutSummary } from "./layoutSummary";

export interface ConstraintIssue {
  id: string;
  severity: "error" | "warning";
  message: string;
  ruleId?: string;
}

export interface SofaSummary {
  id: string;
  capacity: number;
}

/** LayoutSummary plus the sofas in the hall (add `sofas` to layoutSummary.ts). */
export type ValidationLayout = LayoutSummary & {
  sofas?: ReadonlyArray<SofaSummary>;
};

/** guest id -> id of the table or sofa the guest is seated at. */
export type SeatAssignments = ReadonlyMap<string, string>;

type SeatGender = "male" | "female";

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}

function zoneAllows(zone: Zone, gender: SeatGender): boolean {
  switch (zone) {
    case "men":
      return gender === "male";
    case "women":
      return gender === "female";
    case "family":
    case "mixed":
      return true;
    default:
      return assertNever(zone);
  }
}

// Guests whose gender is neither "male" nor "female" are never blocked by a gender zone.
function violatesZone(zone: Zone, gender: string): boolean {
  if (gender === "male" || gender === "female") return !zoneAllows(zone, gender);
  return false;
}

function createUnionFind() {
  const parent = new Map<string, string>();
  function find(x: string): string {
    let root = x;
    for (;;) {
      const p = parent.get(root);
      if (p === undefined || p === root) break;
      root = p;
    }
    let cur = x;
    while (cur !== root) {
      const next = parent.get(cur);
      parent.set(cur, root);
      if (next === undefined) break;
      cur = next;
    }
    return root;
  }
  // The smallest id always becomes the root, so group roots are deterministic.
  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (ra < rb) parent.set(rb, ra);
    else parent.set(ra, rb);
  }
  return { find, union };
}

function ruleLabel(rule: Rule): string {
  return `Rule ${rule.id} (${rule.strength} ${rule.kind})`;
}

function listNames(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

export function validateConstraints(
  data: ConstraintData,
  guests: ReadonlyArray<Guest>,
  layout: ValidationLayout,
  assignments?: SeatAssignments,
): ConstraintIssue[] {
  const issues: ConstraintIssue[] = [];
  const { settings } = data;
  const byId = new Map<string, Guest>();
  for (const g of guests) byId.set(g.id, g);
  const sofas = layout.sofas ?? [];
  const sofaById = new Map<string, SofaSummary>();
  for (const s of sofas) sofaById.set(s.id, s);

  // 1. Unknown guests
  for (const rule of data.rules) {
    const seen = new Set<string>();
    for (const gid of rule.guest_ids) {
      if (byId.has(gid) || seen.has(gid)) continue;
      seen.add(gid);
      issues.push({
        id: `missing-guest:${rule.id}:${gid}`,
        severity: "error",
        message: `${ruleLabel(rule)} references guest "${gid}", who does not exist.`,
        ruleId: rule.id,
      });
    }
  }

  // Must-together groups (rules + households)
  const uf = createUnionFind();
  const participants = new Set<string>();
  for (const rule of data.rules) {
    if (rule.kind !== "together" || rule.strength !== "must") continue;
    const ids = [...new Set(rule.guest_ids)].filter((id) => byId.has(id));
    const first = ids[0];
    if (first === undefined || ids.length < 2) continue;
    for (const id of ids) {
      uf.union(first, id);
      participants.add(id);
    }
  }
  if (settings.households_together) {
    const households = new Map<string, string[]>();
    for (const g of guests) {
      const household = g.household.trim();
      if (household === "") continue;
      const list = households.get(household);
      if (list) list.push(g.id);
      else households.set(household, [g.id]);
    }
    for (const list of households.values()) {
      const first = list[0];
      if (first === undefined || list.length < 2) continue;
      for (const id of list) {
        uf.union(first, id);
        participants.add(id);
      }
    }
  }
  const groupMap = new Map<string, string[]>();
  for (const id of [...participants].sort()) {
    const root = uf.find(id);
    const list = groupMap.get(root);
    if (list) list.push(id);
    else groupMap.set(root, [id]);
  }
  const groups = [...groupMap.values()].filter((g) => g.length > 1);

  // 2. Conflicts between must-apart rules and forced groups
  for (const rule of data.rules) {
    if (rule.kind !== "apart" || rule.strength !== "must") continue;
    const a = rule.guest_ids[0];
    const b = rule.guest_ids[1];
    if (a === undefined || b === undefined || a === b) continue;
    const ga = byId.get(a);
    const gb = byId.get(b);
    if (!ga || !gb) continue;
    if (uf.find(a) === uf.find(b)) {
      issues.push({
        id: `conflict:${rule.id}`,
        severity: "error",
        message: `Conflict: ${ruleLabel(rule)} keeps ${ga.name} and ${gb.name} apart, but must-together rules or households force them to share a table.`,
        ruleId: rule.id,
      });
    }
  }

  // 3. Groups larger than any table (sofas are small and seniors-only, so tables only)
  const maxCapacity = Math.max(0, ...layout.tables.map((t) => t.capacity));
  if (groups.length > 0 && layout.tables.length === 0) {
    issues.push({
      id: "groups-need-tables",
      severity: "warning",
      message: "Some guests must sit together, but the hall has no tables yet.",
    });
  } else {
    for (const group of groups) {
      if (group.length <= maxCapacity) continue;
      const names = group.map((id) => byId.get(id)?.name ?? id);
      issues.push({
        id: `group-too-large:${group[0] ?? ""}`,
        severity: "error",
        message: `${group.length} guests must sit together (${listNames(names)}), but the largest table seats ${maxCapacity}.`,
      });
    }
  }

  // 4 + 5. Gender zones (sofas use the same zone map as tables)
  if (settings.enforce_gender_zones) {
    let maleSeats = 0;
    let femaleSeats = 0;
    for (const table of layout.tables) {
      const zone = zoneForTable(data.zones, table.id);
      if (zoneAllows(zone, "male")) maleSeats += table.capacity;
      if (zoneAllows(zone, "female")) femaleSeats += table.capacity;
    }
    for (const sofa of sofas) {
      const zone = zoneForTable(data.zones, sofa.id);
      if (zoneAllows(zone, "male")) maleSeats += sofa.capacity;
      if (zoneAllows(zone, "female")) femaleSeats += sofa.capacity;
    }
    const where =
      sofas.length > 0 ? "men, family or mixed tables and sofas" : "men, family or mixed tables";
    const whereWomen =
      sofas.length > 0 ? "women, family or mixed tables and sofas" : "women, family or mixed tables";
    const maleCount = guests.filter((g) => g.gender === "male").length;
    const femaleCount = guests.filter((g) => g.gender === "female").length;
    if (maleCount > maleSeats) {
      issues.push({
        id: "gender-seats:male",
        severity: "error",
        message: `${maleCount} male guests but only ${maleSeats} seats at ${where}.`,
      });
    }
    if (femaleCount > femaleSeats) {
      issues.push({
        id: "gender-seats:female",
        severity: "error",
        message: `${femaleCount} female guests but only ${femaleSeats} seats at ${whereWomen}.`,
      });
    }
    for (const group of groups) {
      const members = group.map((id) => byId.get(id));
      const hasMale = members.some((g) => g?.gender === "male");
      const hasFemale = members.some((g) => g?.gender === "female");
      if (!hasMale || !hasFemale) continue;
      const roomy = layout.tables.some((t) => {
        const zone = zoneForTable(data.zones, t.id);
        return (zone === "family" || zone === "mixed") && t.capacity >= group.length;
      });
      if (!roomy) {
        issues.push({
          id: `mixed-group-no-table:${group[0] ?? ""}`,
          severity: "error",
          message: `A group of ${group.length} men and women must sit together, but no family or mixed table is big enough.`,
        });
      }
    }
  }

  // 6. Missing stage / entrance
  if (settings.vip_near_stage && !layout.hasStage && guests.some((g) => g.vip !== "none")) {
    issues.push({
      id: "vip-no-stage",
      severity: "warning",
      message: "VIP guests should sit near the stage, but the hall has no stage.",
    });
  }
  if (settings.accessible_near_entrance && !layout.hasEntrance && guests.some((g) => g.mobility !== "none")) {
    issues.push({
      id: "mobility-no-entrance",
      severity: "warning",
      message: "Guests with mobility needs should sit near an entrance, but the hall has no entrance or exit.",
    });
  }

  // 7. Stale zones (a zone may belong to a table or a sofa)
  const seatObjectIds = new Set<string>([
    ...layout.tables.map((t) => t.id),
    ...sofas.map((s) => s.id),
  ]);
  for (const objectId of Object.keys(data.zones)) {
    if (seatObjectIds.has(objectId)) continue;
    issues.push({
      id: `stale-zone:${objectId}`,
      severity: "warning",
      message: `A zone is set for table "${objectId}", which is not in the hall.`,
    });
  }

  // 8. Capacity
  const tableSeats = layout.tables.reduce((sum, t) => sum + t.capacity, 0);
  const sofaSeats = sofas.reduce((sum, s) => sum + s.capacity, 0);
  const totalSeats = tableSeats + sofaSeats;
  if (guests.length > totalSeats) {
    issues.push({
      id: "guests-exceed-seats",
      severity: "warning",
      message: `${guests.length} guests but only ${totalSeats} seats.`,
    });
  } else if (settings.sofas_for_seniors_only && sofaSeats > 0) {
    const nonSeniors = guests.filter((g) => g.age_band !== "senior").length;
    if (nonSeniors > tableSeats) {
      issues.push({
        id: "non-seniors-exceed-table-seats",
        severity: "warning",
        message: `${nonSeniors} guests are not seniors, but only ${tableSeats} seats are outside the seniors-only sofas.`,
      });
    }
  }

  // 9. Kids table
  if (settings.kids_table) {
    const children = guests.filter((g) => g.age_band === "child").length;
    if (children < 3) {
      issues.push({
        id: "kids-table-few-children",
        severity: "warning",
        message: `Kids table is on, but only ${children} guests are aged 5-12.`,
      });
    }
  }

  // 10. Sofa assignments (only when the caller supplies seat assignments)
  if (assignments !== undefined && sofas.length > 0) {
    const seatedOnSofa = new Map<string, number>();
    for (const [guestId, seatId] of assignments) {
      const sofa = sofaById.get(seatId);
      if (sofa === undefined) continue;
      seatedOnSofa.set(sofa.id, (seatedOnSofa.get(sofa.id) ?? 0) + 1);

      const guest = byId.get(guestId);
      if (guest === undefined) continue;

      if (settings.sofas_for_seniors_only && guest.age_band !== "senior") {
        issues.push({
          id: `sofa-non-senior:${sofa.id}:${guestId}`,
          severity: "warning",
          message: `${guest.name} is not a senior but is seated on sofa "${sofa.id}", which is reserved for seniors.`,
        });
      }

      if (settings.enforce_gender_zones) {
        const zone = zoneForTable(data.zones, sofa.id);
        if (violatesZone(zone, guest.gender)) {
          issues.push({
            id: `sofa-zone:${sofa.id}:${guestId}`,
            severity: "error",
            message: `${guest.name} is seated on sofa "${sofa.id}", which is in the ${zone} zone.`,
          });
        }
      }
    }
    for (const [sofaId, count] of seatedOnSofa) {
      const sofa = sofaById.get(sofaId);
      if (sofa !== undefined && count > sofa.capacity) {
        issues.push({
          id: `sofa-over-capacity:${sofaId}`,
          severity: "error",
          message: `${count} guests are assigned to sofa "${sofaId}", which seats ${sofa.capacity}.`,
        });
      }
    }
  }

  issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    if (a.id < b.id) return -1;
    return a.id > b.id ? 1 : 0;
  });
  return issues;
}