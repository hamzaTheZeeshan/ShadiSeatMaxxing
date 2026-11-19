import { eventSchema } from "../types/eventSchema";
import type { EventInfo } from "../types/eventSchema";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const EVENT_STORAGE_KEY = "shadi-maxing:event:v1";

export function serializeEvent(event: EventInfo): string {
  // Explicit pick so only schema fields are ever written.
  return JSON.stringify(
    {
      event_name: event.event_name,
      event_type: event.event_type,
      event_date: event.event_date,
      expected_guests: event.expected_guests,
      notes: event.notes,
    },
    null,
    2,
  );
}

export function parseEvent(json: string): EventInfo {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const result = eventSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const path = issue.path.map(String).join(".");
      return `${path === "" ? "(root)" : path}: ${issue.message}`;
    });
    throw new Error(lines.join("\n"));
  }
  return result.data;
}

export function saveEventToStorage(event: EventInfo): Result<null> {
  try {
    globalThis.localStorage.setItem(EVENT_STORAGE_KEY, serializeEvent(event));
    return { ok: true, value: null };
  } catch {
    return { ok: false, error: "Could not save the event to browser storage." };
  }
}

export function loadEventFromStorage(): Result<EventInfo> {
  let raw: string | null;
  try {
    raw = globalThis.localStorage.getItem(EVENT_STORAGE_KEY);
  } catch {
    return { ok: false, error: "Browser storage is unavailable." };
  }
  if (raw === null) return { ok: false, error: "No saved event found." };
  try {
    return { ok: true, value: parseEvent(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read the saved event." };
  }
}