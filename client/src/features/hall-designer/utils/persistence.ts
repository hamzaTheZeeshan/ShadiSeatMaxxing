import type { HallLayout } from "../types/layout";
import { hallLayoutSchema } from "../types/layoutSchema";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const STORAGE_KEY = "shadi-maxing:layout:v1";

const SUPPORTED_VERSION = 1;
const OBJECT_TYPES: readonly string[] = [
  "table",
  "sofa",
  "entrance",
  "exit",
  "stage",
  "dance_floor",
  "restricted_area",
  "service_area",
];
const TABLE_SHAPES: readonly string[] = ["round", "rectangular", "square"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function formatPath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      out += `[${segment}]`;
    } else {
      const key = String(segment);
      out += out === "" ? key : `.${key}`;
    }
  }
  return out === "" ? "(root)" : out;
}

// Readable errors for unknown object types / table shapes.
function findTypeProblems(objects: unknown[]): string[] {
  const problems: string[] = [];
  objects.forEach((obj, i) => {
    if (!isRecord(obj)) {
      problems.push(`objects[${i}]: Expected an object.`);
      return;
    }
    const type = obj["type"];
    if (typeof type !== "string" || !OBJECT_TYPES.includes(type)) {
      const shown = typeof type === "string" ? JSON.stringify(type) : String(type);
      const extra =
        type === "wall" ? " (walls are not supported in schema version 1)" : "";
      problems.push(`objects[${i}].type: Unknown object type ${shown}${extra}.`);
      return;
    }
    if (type === "table") {
      const shape = obj["shape"];
      if (typeof shape !== "string" || !TABLE_SHAPES.includes(shape)) {
        const shown =
          typeof shape === "string" ? JSON.stringify(shape) : String(shape);
        problems.push(`objects[${i}].shape: Unknown table shape ${shown}.`);
      }
    }
  });
  return problems;
}

// Domain data only. Rebuilt through the schema so extra properties are stripped.
// Throws a readable Error if the layout is invalid.
export function serializeLayout(layout: HallLayout): string {
  const picked = {
    schema_version: layout.schema_version,
    hall: layout.hall,
    objects: layout.objects,
  };
  const result = hallLayoutSchema.safeParse(picked);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `${formatPath(issue.path)}: ${issue.message}`,
    );
    throw new Error(`Cannot serialize invalid layout:\n${lines.join("\n")}`);
  }
  const clean: HallLayout = {
    schema_version: SUPPORTED_VERSION,
    hall: result.data.hall,
    objects: result.data.objects,
  };
  return JSON.stringify(clean, null, 2);
}

export function parseLayout(json: string): HallLayout {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON: ${errorMessage(e)}`);
  }

  if (!isRecord(raw)) {
    throw new Error("Invalid layout: expected a JSON object at the top level.");
  }

  if (raw["schema_version"] !== SUPPORTED_VERSION) {
    const found =
      "schema_version" in raw ? JSON.stringify(raw["schema_version"]) : "missing";
    throw new Error(
      `Unsupported schema_version: found ${found}, expected ${SUPPORTED_VERSION}.`,
    );
  }

  const rawObjects = raw["objects"];
  if (Array.isArray(rawObjects)) {
    const problems = findTypeProblems(rawObjects);
    if (problems.length > 0) {
      throw new Error(`Invalid layout:\n${problems.join("\n")}`);
    }
  }

  const result = hallLayoutSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `${formatPath(issue.path)}: ${issue.message}`,
    );
    throw new Error(`Invalid layout:\n${lines.join("\n")}`);
  }
  return result.data;
}

export function saveLayoutToStorage(layout: HallLayout): Result<null> {
  try {
    const json = serializeLayout(layout);
    localStorage.setItem(STORAGE_KEY, json);
    return { ok: true, value: null };
  } catch (e) {
    return { ok: false, error: `Could not save layout: ${errorMessage(e)}` };
  }
}

export function loadLayoutFromStorage(): Result<HallLayout> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { ok: false, error: "No saved layout found." };
    }
    return { ok: true, value: parseLayout(raw) };
  } catch (e) {
    return { ok: false, error: `Could not load layout: ${errorMessage(e)}` };
  }
}