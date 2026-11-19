import { z } from "zod";

export const EVENT_NAME_MAX_LENGTH = 100;
export const NOTES_MAX_LENGTH = 500;
export const GUESTS_MIN = 1;
export const GUESTS_MAX = 2000;

const EVENT_TYPE_VALUES = ["nikah", "barat", "valima", "mehndi", "other"] as const;

export type EventType = (typeof EVENT_TYPE_VALUES)[number];

export const EVENT_TYPES: ReadonlyArray<{ value: EventType; label: string }> = [
  { value: "nikah", label: "Nikah" },
  { value: "barat", label: "Barat" },
  { value: "valima", label: "Valima" },
  { value: "mehndi", label: "Mehndi" },
  { value: "other", label: "Other" },
];

// Accepts only real calendar dates in YYYY-MM-DD form (rejects e.g. 2026-02-30).
function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Unknown keys are stripped (zod object default). Non-finite numbers are rejected by z.number().
export const eventSchema = z.object({
  event_name: z
    .string()
    .trim()
    .min(1, "Event name is required.")
    .max(EVENT_NAME_MAX_LENGTH, `Event name must be at most ${EVENT_NAME_MAX_LENGTH} characters.`),
  event_type: z.enum(EVENT_TYPE_VALUES, { error: "Choose a valid event type." }),
  event_date: z
    .string()
    .refine((value) => value === "" || isRealCalendarDate(value), {
      message: "Enter a valid date or leave it empty.",
    }),
  expected_guests: z
    .number({ error: "Enter the expected number of guests." })
    .int("Guests must be a whole number.")
    .min(GUESTS_MIN, `Guests must be at least ${GUESTS_MIN}.`)
    .max(GUESTS_MAX, `Guests must be at most ${GUESTS_MAX}.`),
  notes: z.string().max(NOTES_MAX_LENGTH, `Notes must be at most ${NOTES_MAX_LENGTH} characters.`),
});

export type EventInfo = z.infer<typeof eventSchema>;

export const DEFAULT_EVENT: EventInfo = {
  event_name: "",
  event_type: "barat",
  event_date: "",
  expected_guests: 100,
  notes: "",
};