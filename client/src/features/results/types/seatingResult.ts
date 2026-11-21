export type SolverStatus = "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
export type BrokenKind = "hard" | "soft";

export interface SeatAssignment {
  guest_id: string;
  table_id: string;
  seat_index: number;
}

export interface BrokenConstraint {
  type: BrokenKind;
  code: string;
  message: string;
  guest_ids: string[];
  seat_ids: string[];
  rule_id?: string;
}

export interface SeatingResult {
  status: SolverStatus;
  assignments: SeatAssignment[];
  unassigned_guests: string[];
  broken_constraints: BrokenConstraint[];
  score: number;
  execution_time_ms: number;
  messages: string[];
}

const STATUSES: readonly SolverStatus[] = ["OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNKNOWN"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((i): i is string => typeof i === "string") : [];
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// Accepts the solver payload itself or the payload nested under `result` / `solution`.
function unwrap(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  if (Array.isArray(raw.assignments)) return raw;
  for (const key of ["result", "solution"]) {
    const inner = raw[key];
    if (isRecord(inner) && Array.isArray(inner.assignments)) return inner;
  }
  return null;
}

export function parseSeatingResult(raw: unknown): SeatingResult | null {
  const root = unwrap(raw);
  if (root === null) return null;

  const assignments: SeatAssignment[] = [];
  const assignmentList: unknown[] = Array.isArray(root.assignments) ? root.assignments : [];
  for (const a of assignmentList) {
    if (!isRecord(a)) continue;
    if (typeof a.guest_id !== "string" || typeof a.table_id !== "string") continue;
    assignments.push({ guest_id: a.guest_id, table_id: a.table_id, seat_index: num(a.seat_index, -1) });
  }

  const broken: BrokenConstraint[] = [];
  const brokenList: unknown[] = Array.isArray(root.broken_constraints) ? root.broken_constraints : [];
  for (const b of brokenList) {
    if (!isRecord(b)) continue;
    const item: BrokenConstraint = {
      type: b.type === "soft" ? "soft" : "hard",
      code: typeof b.code === "string" ? b.code : "unknown",
      message: typeof b.message === "string" ? b.message : "Broken constraint",
      guest_ids: stringList(b.guest_ids),
      seat_ids: stringList(b.seat_ids),
    };
    if (typeof b.rule_id === "string") item.rule_id = b.rule_id;
    broken.push(item);
  }

  return {
    status: STATUSES.find((s) => s === root.status) ?? "UNKNOWN",
    assignments,
    unassigned_guests: stringList(root.unassigned_guests),
    broken_constraints: broken,
    score: num(root.score),
    execution_time_ms: num(root.execution_time_ms),
    messages: stringList(root.messages),
  };
}