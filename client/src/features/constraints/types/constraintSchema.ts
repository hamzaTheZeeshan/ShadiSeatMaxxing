import { z } from "zod";
import type { EnumOption } from "../../guests/types/guestSchema";

export const MAX_RULES = 2000;
export const NOTE_MAX_LENGTH = 200;
export const TOGETHER_MIN_GUESTS = 2;
export const TOGETHER_MAX_GUESTS = 20;
export const DEFAULT_RULE_WEIGHT = 5;
const DEFAULT_ELDERS_NEAR_EXITS = 5;

const ZONE_VALUES = ["men", "women", "family", "mixed"] as const;
const RULE_KIND_VALUES = ["together", "apart"] as const;
const RULE_STRENGTH_VALUES = ["must", "prefer"] as const;

export type Zone = (typeof ZONE_VALUES)[number];
export type RuleKind = (typeof RULE_KIND_VALUES)[number];
export type RuleStrength = (typeof RULE_STRENGTH_VALUES)[number];

export const ZONES: ReadonlyArray<EnumOption<Zone>> = [
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "family", label: "Family" },
  { value: "mixed", label: "Mixed" },
];
export const DEFAULT_ZONE: Zone = "mixed";

export const RULE_KINDS: ReadonlyArray<EnumOption<RuleKind>> = [
  { value: "together", label: "Sit together" },
  { value: "apart", label: "Sit apart" },
];
export const RULE_STRENGTHS: ReadonlyArray<EnumOption<RuleStrength>> = [
  { value: "must", label: "Must" },
  { value: "prefer", label: "Prefer" },
];

function oneOf(values: readonly string[]): { error: string } {
  return { error: `must be one of: ${values.join(", ")}` };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}

export const zoneSchema = z.enum(ZONE_VALUES, oneOf(ZONE_VALUES));

const distanceField = z
  .number()
  .min(1, "Distance must be between 1 and 50 metres.")
  .max(50, "Distance must be between 1 and 50 metres.");
const weightField = z
  .number()
  .int("Weights must be whole numbers.")
  .min(0, "Weights must be between 0 and 10.")
  .max(10, "Weights must be between 0 and 10.");

export const settingsSchema = z.object({
  households_together: z.boolean(),
  enforce_gender_zones: z.boolean(),
  children_with_guardian: z.boolean(),
  accessible_near_entrance: z.boolean(),
  accessible_max_distance_m: distanceField,
  vip_near_stage: z.boolean(),
  vip_max_distance_m: distanceField,
  kids_table: z.boolean(),
  // .default keeps previously saved constraint data (without this field) valid.
  sofas_for_seniors_only: z.boolean().default(true),
  weights: z.object({
    // .default keeps data saved before this weight existed valid; the old
    // elders_away_from_speakers key is ignored (unknown keys are stripped).
    elders_near_exits: weightField.default(DEFAULT_ELDERS_NEAR_EXITS),
    seniors_near_stage: weightField,
    balance_sides: weightField,
    similar_ages: weightField,
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  households_together: true,
  enforce_gender_zones: false,
  children_with_guardian: true,
  accessible_near_entrance: true,
  accessible_max_distance_m: 10,
  vip_near_stage: true,
  vip_max_distance_m: 12,
  kids_table: false,
  sofas_for_seniors_only: true,
  weights: {
    elders_near_exits: DEFAULT_ELDERS_NEAR_EXITS,
    seniors_near_stage: 3,
    balance_sides: 3,
    similar_ages: 2,
  },
};

const RULE_ID_PATTERN = /^rule_[0-9a-f]{8}$/;

const GUEST_COUNT_MESSAGE =
  "Together rules need 2-20 different guests; apart rules need exactly 2 different guests.";

function guestsOk(rule: { kind: RuleKind; guest_ids: string[] }): boolean {
  const count = rule.guest_ids.length;
  const unique = new Set(rule.guest_ids).size === count;
  switch (rule.kind) {
    case "together":
      return unique && count >= TOGETHER_MIN_GUESTS && count <= TOGETHER_MAX_GUESTS;
    case "apart":
      return unique && count === 2;
    default:
      return assertNever(rule.kind);
  }
}

// "must" rules always store the default weight.
function withDefaultWeight<T extends { strength: RuleStrength; weight: number }>(rule: T): T {
  return rule.strength === "must" ? { ...rule, weight: DEFAULT_RULE_WEIGHT } : rule;
}

const ruleShape = {
  kind: z.enum(RULE_KIND_VALUES, oneOf(RULE_KIND_VALUES)),
  strength: z.enum(RULE_STRENGTH_VALUES, oneOf(RULE_STRENGTH_VALUES)),
  weight: z
    .number()
    .int("Weight must be a whole number.")
    .min(1, "Weight must be between 1 and 10.")
    .max(10, "Weight must be between 1 and 10."),
  guest_ids: z.array(z.string().min(1, "Guest id is required.")),
  note: z.string().trim().max(NOTE_MAX_LENGTH, `Note must be at most ${NOTE_MAX_LENGTH} characters.`),
};

export const newRuleSchema = z
  .object(ruleShape)
  .refine(guestsOk, { message: GUEST_COUNT_MESSAGE, path: ["guest_ids"] })
  .transform((rule) => withDefaultWeight(rule));

export const ruleSchema = z
  .object({ id: z.string().regex(RULE_ID_PATTERN, "Invalid rule id."), ...ruleShape })
  .refine(guestsOk, { message: GUEST_COUNT_MESSAGE, path: ["guest_ids"] })
  .transform((rule) => withDefaultWeight(rule));

export type Rule = z.infer<typeof ruleSchema>;
export type NewRule = z.infer<typeof newRuleSchema>;

function stripDefaultZones(zones: Record<string, Zone>): Record<string, Zone> {
  const out: Record<string, Zone> = {};
  for (const [tableId, zone] of Object.entries(zones)) {
    if (zone !== DEFAULT_ZONE) out[tableId] = zone;
  }
  return out;
}

const zonesSchema = z.record(z.string().min(1), zoneSchema).transform((zones) => stripDefaultZones(zones));

export const constraintDataSchema = z
  .object({
    version: z.literal(1),
    settings: settingsSchema,
    zones: zonesSchema,
    rules: z.array(ruleSchema).max(MAX_RULES, `Too many rules (max ${MAX_RULES}).`),
  })
  .refine((data) => new Set(data.rules.map((r) => r.id)).size === data.rules.length, {
    message: "Rule ids must be unique.",
    path: ["rules"],
  });

export type ConstraintData = z.infer<typeof constraintDataSchema>;

export const DEFAULT_CONSTRAINT_DATA: ConstraintData = {
  version: 1,
  settings: DEFAULT_SETTINGS,
  zones: {},
  rules: [],
};

// Works for any seating object id (tables and sofas share the same zone map).
export function zoneForTable(zones: Readonly<Record<string, Zone>>, tableId: string): Zone {
  const zone = Object.prototype.hasOwnProperty.call(zones, tableId) ? zones[tableId] : undefined;
  return zone ?? DEFAULT_ZONE;
}

export function createRuleId(): string {
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
  return `rule_${hex}`;
}

export function isValidRuleId(id: string): boolean {
  return RULE_ID_PATTERN.test(id);
}

export function createUniqueRuleId(taken: ReadonlySet<string>): string {
  let id = createRuleId();
  while (taken.has(id)) id = createRuleId();
  return id;
}