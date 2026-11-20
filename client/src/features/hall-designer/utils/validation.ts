import type { HallObject } from "../types/layout";
import type { Polygon } from "./geometry";
import { objectPolygon, polygonDistance, polygonInsideRect, polygonsOverlap, tableFootprint } from "./geometry";

export const MIN_AISLE = 0.6; // metres between two table footprints
export const ENTRANCE_CLEARANCE = 1.5; // metres between a table footprint and an entrance/exit

export type Severity = "error" | "warning";
export type IssueCode =
  | "out_of_bounds"
  | "overlap"
  | "table_in_restricted"
  | "table_blocks_opening"
  | "narrow_aisle"
  | "near_opening";

export interface ValidationIssue {
  id: string;
  code: IssueCode;
  severity: Severity;
  objectIds: string[];
  message: string;
}

const EPS = 1e-9;

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

type Kind = "table" | "sofa" | "stage" | "dance_floor" | "restricted_area" | "service_area" | "opening";

function kindOf(obj: HallObject): Kind {
  switch (obj.type) {
    case "table":
      return "table";
    case "sofa":
      return "sofa";
    case "stage":
      return "stage";
    case "dance_floor":
      return "dance_floor";
    case "restricted_area":
      return "restricted_area";
    case "service_area":
      return "service_area";
    case "entrance":
    case "exit":
      return "opening";
    default:
      return assertNever(obj);
  }
}

function nameOf(obj: HallObject, tableNumbers: Map<string, number>, sofaNumbers: Map<string, number>): string {
  switch (obj.type) {
    case "table":
      return `T${tableNumbers.get(obj.id) ?? "?"}`;
    case "sofa":
      return `S${sofaNumbers.get(obj.id) ?? "?"}`;
    case "stage":
      return "Stage";
    case "dance_floor":
      return "Dance Floor";
    case "restricted_area":
      return "Restricted Area";
    case "service_area":
      return "Service Area";
    case "entrance":
      return "Entrance";
    case "exit":
      return "Exit";
    default:
      return assertNever(obj);
  }
}

interface Entry {
  obj: HallObject;
  kind: Kind;
  label: string;
  body: Polygon;
  // Table footprint (body + chair ring); equals body for everything else.
  footprint: Polygon;
}

function buildEntries(objects: readonly HallObject[]): Entry[] {
  const tableNumbers = new Map<string, number>();
  const sofaNumbers = new Map<string, number>();
  let t = 0;
  let s = 0;
  for (const o of objects) {
    if (o.type === "table") {
      t += 1;
      tableNumbers.set(o.id, t);
    } else if (o.type === "sofa") {
      s += 1;
      sofaNumbers.set(o.id, s);
    }
  }
  return objects.map((obj) => {
    const body = objectPolygon(obj);
    return {
      obj,
      kind: kindOf(obj),
      label: nameOf(obj, tableNumbers, sofaNumbers),
      body,
      footprint: obj.type === "table" ? tableFootprint(obj) : body,
    };
  });
}

function issue(code: IssueCode, severity: Severity, objectIds: string[], message: string): ValidationIssue {
  return { id: `${code}:${[...objectIds].sort().join("|")}`, code, severity, objectIds, message };
}

// Only called with `a` being a stage / dance floor / service area / restricted area / opening.
function nonTableOverlaps(a: Kind, b: Kind): boolean {
  switch (a) {
    case "stage":
      return b === "dance_floor" || b === "service_area";
    case "dance_floor":
    case "service_area":
      return b === "stage";
    case "table":
    case "sofa":
    case "restricted_area":
    case "opening":
      return false;
    default:
      return assertNever(a);
  }
}

function checkTablePair(table: Entry, other: Entry, out: ValidationIssue[]): void {
  const ids = [table.obj.id, other.obj.id];
  switch (other.kind) {
    case "table": {
      if (polygonsOverlap(table.footprint, other.footprint)) {
        out.push(issue("overlap", "error", ids, `${table.label} and ${other.label} overlap (chairs included).`));
      } else {
        const d = polygonDistance(table.footprint, other.footprint);
        if (d < MIN_AISLE - EPS) {
          out.push(
            issue(
              "narrow_aisle",
              "warning",
              ids,
              `Aisle between ${table.label} and ${other.label} is only ${d.toFixed(2)} m (minimum ${MIN_AISLE} m).`,
            ),
          );
        }
      }
      return;
    }
    case "sofa":
    case "stage":
    case "dance_floor":
    case "service_area":
      if (polygonsOverlap(table.footprint, other.body)) {
        out.push(issue("overlap", "error", ids, `${table.label} overlaps ${other.label}.`));
      }
      return;
    case "restricted_area":
      if (polygonsOverlap(table.body, other.body)) {
        out.push(issue("table_in_restricted", "error", ids, `${table.label} overlaps a Restricted Area.`));
      }
      return;
    case "opening": {
      if (polygonsOverlap(table.footprint, other.body)) {
        out.push(issue("table_blocks_opening", "error", ids, `${table.label} blocks the ${other.label}.`));
      } else {
        const d = polygonDistance(table.footprint, other.body);
        if (d < ENTRANCE_CLEARANCE - EPS) {
          out.push(
            issue(
              "near_opening",
              "warning",
              ids,
              `${table.label} is only ${d.toFixed(2)} m from the ${other.label} (clearance ${ENTRANCE_CLEARANCE} m).`,
            ),
          );
        }
      }
      return;
    }
    default:
      return assertNever(other.kind);
  }
}

// `other` is never a table here (table pairs are handled by checkTablePair).
function checkSofaPair(sofa: Entry, other: Entry, out: ValidationIssue[]): void {
  const ids = [sofa.obj.id, other.obj.id];
  switch (other.kind) {
    case "table":
      return;
    case "sofa":
    case "stage":
    case "dance_floor":
    case "service_area":
      if (polygonsOverlap(sofa.body, other.body)) {
        out.push(issue("overlap", "error", ids, `${sofa.label} overlaps ${other.label}.`));
      }
      return;
    case "restricted_area":
      if (polygonsOverlap(sofa.body, other.body)) {
        out.push(issue("overlap", "error", ids, `${sofa.label} overlaps a Restricted Area.`));
      }
      return;
    case "opening":
      if (polygonsOverlap(sofa.body, other.body)) {
        out.push(issue("overlap", "error", ids, `${sofa.label} blocks the ${other.label}.`));
      }
      return;
    default:
      return assertNever(other.kind);
  }
}

function rank(kind: Kind): number {
  switch (kind) {
    case "table":
      return 0;
    case "sofa":
      return 1;
    case "stage":
    case "dance_floor":
    case "restricted_area":
    case "service_area":
    case "opening":
      return 2;
    default:
      return assertNever(kind);
  }
}

function checkPair(a: Entry, b: Entry, out: ValidationIssue[]): void {
  const swap = rank(a.kind) > rank(b.kind);
  const first = swap ? b : a;
  const second = swap ? a : b;
  switch (first.kind) {
    case "table":
      checkTablePair(first, second, out);
      return;
    case "sofa":
      checkSofaPair(first, second, out);
      return;
    case "stage":
    case "dance_floor":
    case "restricted_area":
    case "service_area":
    case "opening":
      if (nonTableOverlaps(first.kind, second.kind) && polygonsOverlap(first.body, second.body)) {
        out.push(issue("overlap", "error", [first.obj.id, second.obj.id], `${first.label} overlaps ${second.label}.`));
      }
      return;
    default:
      return assertNever(first.kind);
  }
}

function compareIssues(x: ValidationIssue, y: ValidationIssue): number {
  if (x.severity !== y.severity) return x.severity === "error" ? -1 : 1;
  if (x.id < y.id) return -1;
  if (x.id > y.id) return 1;
  return 0;
}

export function validateLayout(layout: {
  hall: { width: number; height: number };
  objects: readonly HallObject[];
}): ValidationIssue[] {
  const { hall, objects } = layout;
  const entries = buildEntries(objects);
  const out: ValidationIssue[] = [];

  // Rule 1: out of bounds.
  for (const e of entries) {
    if (e.kind === "opening") {
      const inside =
        e.obj.x >= -EPS && e.obj.x <= hall.width + EPS && e.obj.y >= -EPS && e.obj.y <= hall.height + EPS;
      if (!inside) out.push(issue("out_of_bounds", "error", [e.obj.id], `${e.label} is outside the hall.`));
      continue;
    }
    if (!polygonInsideRect(e.footprint, hall.width, hall.height)) {
      const suffix = e.kind === "table" ? " (including chairs)" : "";
      out.push(issue("out_of_bounds", "error", [e.obj.id], `${e.label}${suffix} extends outside the hall.`));
    }
  }

  // Rules 2-6: each pair once.
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (a === undefined || b === undefined) continue;
      checkPair(a, b, out);
    }
  }

  return out.sort(compareIssues);
}