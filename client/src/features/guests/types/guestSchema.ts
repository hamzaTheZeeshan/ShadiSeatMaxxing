import { z } from "zod";

export const MAX_GUESTS = 2000;
export const MAX_IMPORT_CHARS = 2_000_000;
export const NAME_MAX_LENGTH = 100;
export const HOUSEHOLD_MAX_LENGTH = 60;
export const NOTES_MAX_LENGTH = 200;

export interface EnumOption<T extends string> {
  value: T;
  label: string;
}

const SIDE_VALUES = ["bride", "groom", "other"] as const;
const GENDER_VALUES = ["male", "female", "unspecified"] as const;
const AGE_BAND_VALUES = ["infant", "child", "teen", "adult", "senior"] as const;
const ROLE_VALUES = [
  "couple",
  "parent",
  "grandparent",
  "sibling",
  "wedding_party",
  "relative",
  "friend",
  "colleague",
  "family_friend",
  "other",
] as const;
const VIP_VALUES = ["none", "vip", "chief_guest"] as const;
const MOBILITY_VALUES = ["none", "wheelchair", "walker", "assistance"] as const;
const DIETARY_VALUES = ["none", "vegetarian", "allergy", "other"] as const;

export type Side = (typeof SIDE_VALUES)[number];
export type Gender = (typeof GENDER_VALUES)[number];
export type AgeBand = (typeof AGE_BAND_VALUES)[number];
export type Role = (typeof ROLE_VALUES)[number];
export type VipLevel = (typeof VIP_VALUES)[number];
export type MobilityLevel = (typeof MOBILITY_VALUES)[number];
export type DietaryOption = (typeof DIETARY_VALUES)[number];

export const SIDES: ReadonlyArray<EnumOption<Side>> = [
  { value: "bride", label: "Bride" },
  { value: "groom", label: "Groom" },
  { value: "other", label: "Other" },
];
export const GENDERS: ReadonlyArray<EnumOption<Gender>> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unspecified", label: "Unspecified" },
];
export const AGE_BANDS: ReadonlyArray<EnumOption<AgeBand>> = [
  { value: "infant", label: "Infant (0-4)" },
  { value: "child", label: "Child (5-12)" },
  { value: "teen", label: "Teen" },
  { value: "adult", label: "Adult" },
  { value: "senior", label: "Senior" },
];
export const ROLES: ReadonlyArray<EnumOption<Role>> = [
  { value: "couple", label: "Couple" },
  { value: "parent", label: "Parent" },
  { value: "grandparent", label: "Grandparent" },
  { value: "sibling", label: "Sibling" },
  { value: "wedding_party", label: "Wedding party" },
  { value: "relative", label: "Relative" },
  { value: "friend", label: "Friend" },
  { value: "colleague", label: "Colleague" },
  { value: "family_friend", label: "Family friend" },
  { value: "other", label: "Other" },
];
export const VIP_LEVELS: ReadonlyArray<EnumOption<VipLevel>> = [
  { value: "none", label: "None" },
  { value: "vip", label: "VIP" },
  { value: "chief_guest", label: "Chief guest" },
];
export const MOBILITY_LEVELS: ReadonlyArray<EnumOption<MobilityLevel>> = [
  { value: "none", label: "None" },
  { value: "wheelchair", label: "Wheelchair" },
  { value: "walker", label: "Walker" },
  { value: "assistance", label: "Needs assistance" },
];
export const DIETARY_OPTIONS: ReadonlyArray<EnumOption<DietaryOption>> = [
  { value: "none", label: "None" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "allergy", label: "Allergy" },
  { value: "other", label: "Other" },
];

// Validate-on-read helpers so UI selects never need an unchecked cast.
export function parseOption<T extends string>(options: ReadonlyArray<EnumOption<T>>, value: string): T | undefined {
  return options.find((o) => o.value === value)?.value;
}

export function optionLabel<T extends string>(options: ReadonlyArray<EnumOption<T>>, value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export const DEFAULT_GUEST_FIELDS = {
  household: "",
  side: "other",
  gender: "unspecified",
  age_band: "adult",
  role: "other",
  vip: "none",
  mobility: "none",
  dietary: "none",
  notes: "",
} as const;

const GUEST_ID_PATTERN = /^guest_[0-9a-f]{8}$/;

function oneOf(values: readonly string[]): { error: string } {
  return { error: `must be one of: ${values.join(", ")}` };
}

const nameField = z
  .string({ error: "Name is required." })
  .trim()
  .min(1, "Name is required.")
  .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters.`);
const householdField = z
  .string()
  .trim()
  .max(HOUSEHOLD_MAX_LENGTH, `Household must be at most ${HOUSEHOLD_MAX_LENGTH} characters.`);
const notesField = z.string().trim().max(NOTES_MAX_LENGTH, `Notes must be at most ${NOTES_MAX_LENGTH} characters.`);

export const guestSchema = z.object({
  id: z.string().regex(GUEST_ID_PATTERN, "Invalid guest id."),
  name: nameField,
  household: householdField,
  side: z.enum(SIDE_VALUES, oneOf(SIDE_VALUES)),
  gender: z.enum(GENDER_VALUES, oneOf(GENDER_VALUES)),
  age_band: z.enum(AGE_BAND_VALUES, oneOf(AGE_BAND_VALUES)),
  role: z.enum(ROLE_VALUES, oneOf(ROLE_VALUES)),
  vip: z.enum(VIP_VALUES, oneOf(VIP_VALUES)),
  mobility: z.enum(MOBILITY_VALUES, oneOf(MOBILITY_VALUES)),
  dietary: z.enum(DIETARY_VALUES, oneOf(DIETARY_VALUES)),
  notes: notesField,
});

export const newGuestSchema = guestSchema.omit({ id: true });

// Store-side import shape: id optional and loosely typed; the store reassigns bad or colliding ids.
export const importedGuestSchema = guestSchema.extend({ id: z.string().optional() });

const ENUM_KEYS = ["side", "gender", "age_band", "role", "vip", "mobility", "dietary"] as const;

// Trims and lowercases enum strings, treats ""/null as "missing" so defaults apply.
function normalizeInput(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) out[key] = value;
  for (const key of ENUM_KEYS) {
    const value = out[key];
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
      if (normalized === "") delete out[key];
      else out[key] = normalized;
    } else if (value === null) {
      delete out[key];
    }
  }
  if (out.household === null) delete out.household;
  if (out.notes === null) delete out.notes;
  if (typeof out.id !== "string") delete out.id;
  return out;
}

const inputObject = z.object({
  id: z.string().optional(),
  name: nameField,
  household: householdField.default(DEFAULT_GUEST_FIELDS.household),
  side: z.enum(SIDE_VALUES, oneOf(SIDE_VALUES)).default(DEFAULT_GUEST_FIELDS.side),
  gender: z.enum(GENDER_VALUES, oneOf(GENDER_VALUES)).default(DEFAULT_GUEST_FIELDS.gender),
  age_band: z.enum(AGE_BAND_VALUES, oneOf(AGE_BAND_VALUES)).default(DEFAULT_GUEST_FIELDS.age_band),
  role: z.enum(ROLE_VALUES, oneOf(ROLE_VALUES)).default(DEFAULT_GUEST_FIELDS.role),
  vip: z.enum(VIP_VALUES, oneOf(VIP_VALUES)).default(DEFAULT_GUEST_FIELDS.vip),
  mobility: z.enum(MOBILITY_VALUES, oneOf(MOBILITY_VALUES)).default(DEFAULT_GUEST_FIELDS.mobility),
  dietary: z.enum(DIETARY_VALUES, oneOf(DIETARY_VALUES)).default(DEFAULT_GUEST_FIELDS.dietary),
  notes: notesField.default(DEFAULT_GUEST_FIELDS.notes),
});

export const guestInputSchema = z.preprocess(normalizeInput, inputObject);

export const guestListSchema = z
  .array(guestSchema)
  .max(MAX_GUESTS, `Too many guests (max ${MAX_GUESTS})`)
  .refine((list) => new Set(list.map((g) => g.id)).size === list.length, { message: "Guest ids must be unique." });

export type Guest = z.infer<typeof guestSchema>;
export type NewGuest = Omit<Guest, "id">;
export type ImportedGuest = NewGuest & { id?: string };

export interface GuestParseResult {
  guests: ImportedGuest[];
  errors: string[];
}

export function createGuestId(): string {
  const c: Crypto | undefined = globalThis.crypto;
  let hex: string;
  if (c && typeof c.randomUUID === "function") {
    hex = c.randomUUID().slice(0, 8);
  } else if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    hex = (buf[0] ?? 0).toString(16).padStart(8, "0");
  } else {
    hex = Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, "0");
  }
  return `guest_${hex}`;
}

export function isValidGuestId(id: string): boolean {
  return GUEST_ID_PATTERN.test(id);
}

export function createUniqueGuestId(taken: ReadonlySet<string>): string {
  let id = createGuestId();
  while (taken.has(id)) id = createGuestId();
  return id;
}

// Keeps valid, unused incoming ids; assigns fresh ones otherwise. `reassigned` counts supplied ids that were not kept.
export function assignGuestIds(
  items: ReadonlyArray<ImportedGuest>,
  taken: ReadonlySet<string>,
): { guests: Guest[]; reassigned: number } {
  const used = new Set(taken);
  const guests: Guest[] = [];
  let reassigned = 0;
  for (const item of items) {
    let id: string;
    if (item.id !== undefined && isValidGuestId(item.id) && !used.has(item.id)) {
      id = item.id;
    } else {
      if (item.id !== undefined) reassigned += 1;
      id = createUniqueGuestId(used);
    }
    used.add(id);
    guests.push({ ...item, id });
  }
  return { guests, reassigned };
}