import type { ConstraintData } from "../types/constraintSchema";
import { parseConstraintsJson, serializeConstraints } from "./constraintJson";

export const CONSTRAINT_STORAGE_KEY = "shadi-maxing:constraints:v1";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function saveConstraintsToStorage(data: ConstraintData): Result<null> {
  try {
    globalThis.localStorage.setItem(CONSTRAINT_STORAGE_KEY, serializeConstraints(data));
    return { ok: true, value: null };
  } catch (err) {
    return { ok: false, error: `Could not save constraints: ${messageOf(err)}` };
  }
}

export function loadConstraintsFromStorage(): Result<ConstraintData> {
  let text: string | null;
  try {
    text = globalThis.localStorage.getItem(CONSTRAINT_STORAGE_KEY);
  } catch (err) {
    return { ok: false, error: `Could not read saved constraints: ${messageOf(err)}` };
  }
  if (text === null) return { ok: false, error: "No saved constraints found." };
  const { data, errors } = parseConstraintsJson(text);
  if (data === null) return { ok: false, error: `Saved constraints are invalid: ${errors.join("; ")}` };
  return { ok: true, value: data };
}