import { MAX_GUESTS, MAX_IMPORT_CHARS, guestInputSchema, isValidGuestId } from "../types/guestSchema";
import type { Guest, GuestParseResult, ImportedGuest, NewGuest } from "../types/guestSchema";

const SHAPE_ERROR = "Expected a list of guests or { version: 1, guests: [...] }";

function fail(message: string): GuestParseResult {
  return { guests: [], errors: [message] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGuestJson(text: string): GuestParseResult {
  if (text.length > MAX_IMPORT_CHARS) return fail("File too large (max 2 MB)");

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return fail(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  let list: unknown[];
  if (Array.isArray(data)) {
    list = data;
  } else if (isRecord(data) && "guests" in data) {
    if (data.version !== 1) {
      const found = data.version === undefined ? "none" : JSON.stringify(data.version);
      return fail(`Unsupported version: found ${found}, expected 1`);
    }
    if (!Array.isArray(data.guests)) return fail(SHAPE_ERROR);
    list = data.guests;
  } else {
    return fail(SHAPE_ERROR);
  }

  if (list.length > MAX_GUESTS) return fail(`Too many guests (max ${MAX_GUESTS})`);

  const guests: ImportedGuest[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  list.forEach((entry, index) => {
    const parsed = guestInputSchema.safeParse(entry);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.map(String).join(".");
        errors.push(`guests[${index}]${path === "" ? "" : `.${path}`}: ${issue.message}`);
      }
      return;
    }
    const { id, ...rest } = parsed.data;
    if (id !== undefined && isValidGuestId(id) && !seenIds.has(id)) {
      seenIds.add(id);
      guests.push({ ...rest, id });
    } else {
      guests.push(rest); // invalid or duplicate id dropped silently; the store assigns a new one
    }
  });

  return { guests, errors };
}

function pickGuest(g: Guest): Guest {
  return {
    id: g.id,
    name: g.name,
    household: g.household,
    side: g.side,
    gender: g.gender,
    age_band: g.age_band,
    role: g.role,
    vip: g.vip,
    mobility: g.mobility,
    dietary: g.dietary,
    notes: g.notes,
  };
}

export function serializeGuests(guests: Guest[]): string {
  return JSON.stringify({ version: 1, guests: guests.map(pickGuest) }, null, 2);
}

const TEMPLATE_GUESTS: NewGuest[] = [
  {
    name: "Example Guest 1",
    household: "Example Family A",
    side: "bride",
    gender: "female",
    age_band: "senior",
    role: "grandparent",
    vip: "chief_guest",
    mobility: "wheelchair",
    dietary: "none",
    notes: "Needs step-free access",
  },
  {
    name: "Example Guest 2",
    household: "Example Family A",
    side: "bride",
    gender: "male",
    age_band: "adult",
    role: "parent",
    vip: "vip",
    mobility: "none",
    dietary: "vegetarian",
    notes: "",
  },
  {
    name: "Example Guest 3",
    household: "",
    side: "groom",
    gender: "unspecified",
    age_band: "child",
    role: "friend",
    vip: "none",
    mobility: "assistance",
    dietary: "allergy",
    notes: "Example allergy note",
  },
];

export const GUEST_JSON_TEMPLATE: string = JSON.stringify({ version: 1, guests: TEMPLATE_GUESTS }, null, 2);