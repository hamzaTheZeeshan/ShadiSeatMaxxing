import { assignGuestIds } from "../types/guestSchema";
import type { Guest } from "../types/guestSchema";
import { parseGuestJson, serializeGuests } from "./guestJson";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const GUEST_STORAGE_KEY = "shadi-maxing:guests:v1";

export function saveGuestsToStorage(guests: Guest[]): Result<null> {
  try {
    globalThis.localStorage.setItem(GUEST_STORAGE_KEY, serializeGuests(guests));
    return { ok: true, value: null };
  } catch {
    return { ok: false, error: "Could not save guests to browser storage." };
  }
}

function summarize(errors: string[]): string {
  const shown = errors.slice(0, 3).join("\n");
  return errors.length > 3 ? `${shown}\nand ${errors.length - 3} more` : shown;
}

export function loadGuestsFromStorage(): Result<Guest[]> {
  let raw: string | null;
  try {
    raw = globalThis.localStorage.getItem(GUEST_STORAGE_KEY);
  } catch {
    return { ok: false, error: "Browser storage is unavailable." };
  }
  if (raw === null) return { ok: false, error: "No saved guests found." };

  const parsed = parseGuestJson(raw);
  if (parsed.errors.length > 0) return { ok: false, error: summarize(parsed.errors) };

  const { guests } = assignGuestIds(parsed.guests, new Set());
  return { ok: true, value: guests };
}