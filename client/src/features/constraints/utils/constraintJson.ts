import {
  DEFAULT_SETTINGS,
  MAX_RULES,
  constraintDataSchema,
  DEFAULT_RULE_WEIGHT,
} from "../types/constraintSchema";
import type { ConstraintData, Rule } from "../types/constraintSchema";

export const MAX_CONSTRAINT_JSON_BYTES = 2 * 1024 * 1024;
const MAX_REPORTED_ERRORS = 10;

export interface ConstraintParseResult {
  data: ConstraintData | null;
  errors: string[];
}

function fail(...errors: string[]): ConstraintParseResult {
  return { data: null, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function serializeConstraints(data: ConstraintData): string {
  // Parsing strips anything that is not part of the schema.
  const parsed = constraintDataSchema.safeParse(data);
  return JSON.stringify(parsed.success ? parsed.data : data, null, 2);
}

export function parseConstraintsJson(text: string): ConstraintParseResult {
  if (text.length > MAX_CONSTRAINT_JSON_BYTES) return fail("File too large (max 2 MB)");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return fail(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!isRecord(raw)) return fail("Constraints file must be a JSON object.");

  if (raw.version !== 1) {
    const found = raw.version === undefined ? "none" : JSON.stringify(raw.version);
    return fail(`Unsupported version: found ${found}, expected 1.`);
  }
  if (Array.isArray(raw.rules) && raw.rules.length > MAX_RULES) {
    return fail(`Too many rules (found ${raw.rules.length}, max ${MAX_RULES}).`);
  }

  const candidate: Record<string, unknown> = { ...raw };
  if (candidate.settings === undefined) candidate.settings = structuredClone(DEFAULT_SETTINGS);
  if (candidate.zones === undefined) candidate.zones = {};

  const result = constraintDataSchema.safeParse(candidate);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const path = issue.path.map(String).join(".");
      return `${path === "" ? "(root)" : path}: ${issue.message}`;
    });
    const shown = lines.slice(0, MAX_REPORTED_ERRORS);
    if (lines.length > MAX_REPORTED_ERRORS) shown.push(`and ${lines.length - MAX_REPORTED_ERRORS} more`);
    return fail(...shown);
  }
  return { data: result.data, errors: [] };
}

const TEMPLATE_RULES: Rule[] = [
  {
    id: "rule_00000001",
    kind: "together",
    strength: "must",
    weight: DEFAULT_RULE_WEIGHT,
    guest_ids: ["guest_00000001", "guest_00000002"],
    note: "Example only: replace these guest ids with real ones.",
  },
  {
    id: "rule_00000002",
    kind: "apart",
    strength: "prefer",
    weight: 3,
    guest_ids: ["guest_00000001", "guest_00000002"],
    note: "Example only: delete or edit this rule.",
  },
];

export const CONSTRAINT_JSON_TEMPLATE: string = serializeConstraints({
  version: 1,
  settings: structuredClone(DEFAULT_SETTINGS),
  zones: {},
  rules: TEMPLATE_RULES,
});