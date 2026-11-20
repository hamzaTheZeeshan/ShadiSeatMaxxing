import type { ConstraintData } from "../features/constraints/types/constraintSchema";
import type { Guest } from "../features/guests/types/guestSchema";
import type { HallLayout } from "../features/hall-designer/types/layout";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export interface SolveOptions {
  time_limit_seconds: number; // backend: 1..300
  num_workers: number; // backend: 1..32
}

export const DEFAULT_SOLVE_OPTIONS: SolveOptions = { time_limit_seconds: 30, num_workers: 8 };

export interface SolveRequest {
  layout: { hall: { width: number; height: number }; objects: HallLayout["objects"] };
  guests: Guest[];
  constraints: { version: 1; settings: ConstraintData["settings"]; zones: ConstraintData["zones"]; rules: ConstraintData["rules"] };
  options: SolveOptions;
}

// TODO: replace with the real shape returned by solve_seating() in solver.py.
export type SolveResponse = Record<string, unknown>;

export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];
  constructor(message: string, status: number, details: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// DRF errors are nested ({guests: [{name: ["..."]}], ...}); flatten to "guests[0].name: ..." lines.
function flattenErrors(value: unknown, path = ""): string[] {
  if (typeof value === "string") return [path ? `${path}: ${value}` : value];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) =>
      typeof v === "string" ? flattenErrors(v, path) : flattenErrors(v, `${path}[${i}]`),
    );
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => flattenErrors(v, path ? `${path}.${k}` : k));
  }
  return [];
}

export async function solveSeating(req: SolveRequest, signal?: AbortSignal): Promise<SolveResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/solve-seating/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Could not reach the seating server. Is the backend running?", 0);
  }

  const body: unknown = await res.json().catch(() => null);

  if (res.status === 400 && body && typeof body === "object" && "errors" in body) {
    const details = flattenErrors((body as { errors: unknown }).errors);
    throw new ApiError("The server rejected the seating data.", 400, details);
  }
  if (!res.ok) throw new ApiError(`Seating server error (${res.status}).`, res.status);
  if (body === null || typeof body !== "object") throw new ApiError("Invalid response from server.", res.status);
  return body as SolveResponse;
}