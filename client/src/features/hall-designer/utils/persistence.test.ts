import { afterEach, beforeEach, describe, it, expect } from "vitest";
import type { HallLayout } from "../types/layout";
import {
  STORAGE_KEY,
  loadLayoutFromStorage,
  parseLayout,
  saveLayoutToStorage,
  serializeLayout,
} from "./persistence";

const layout: HallLayout = {
  schema_version: 1,
  hall: {
    id: "hall-1",
    name: "Main Wedding Hall",
    width: 40,
    height: 25,
    unit: "m",
  },
  objects: [
    {
      id: "table_aaaa0001",
      type: "table",
      shape: "round",
      x: 10.5,
      y: 8,
      rotation: 15,
      radius: 1.2,
      capacity: 8,
    },
    {
      id: "table_aaaa0002",
      type: "table",
      shape: "rectangular",
      x: 14,
      y: 8.5,
      rotation: 90,
      width: 2.4,
      height: 1.2,
      capacity: 10,
    },
    {
      id: "table_aaaa0003",
      type: "table",
      shape: "square",
      x: 18,
      y: 8,
      rotation: 0,
      width: 1.5,
      height: 1.5,
      capacity: 4,
    },
    {
      id: "stage_bbbb0001",
      type: "stage",
      x: 20,
      y: 3,
      rotation: 0,
      width: 12,
      height: 4,
    },
    {
      id: "dance_floor_bbbb0002",
      type: "dance_floor",
      x: 20,
      y: 14,
      rotation: 45,
      width: 6,
      height: 6,
    },
    {
      id: "restricted_area_bbbb0003",
      type: "restricted_area",
      x: 35,
      y: 20,
      rotation: 0,
      width: 4,
      height: 4,
    },
    {
      id: "service_area_bbbb0004",
      type: "service_area",
      x: 5,
      y: 21,
      rotation: 270,
      width: 4,
      height: 3,
    },
    {
      id: "entrance_cccc0001",
      type: "entrance",
      x: 20,
      y: 24.85,
      rotation: 0,
      width: 3,
    },
    {
      id: "exit_cccc0002",
      type: "exit",
      x: 0.15,
      y: 12,
      rotation: 90,
      width: 3,
    },
  ],
};

const baseTable = {
  id: "table_x",
  type: "table",
  shape: "round",
  x: 1,
  y: 1,
  rotation: 0,
  radius: 1,
  capacity: 8,
};

function jsonWithObjects(objects: unknown[]): string {
  return JSON.stringify({
    schema_version: 1,
    hall: layout.hall,
    objects,
  });
}

describe("round trip", () => {
  it("preserves a layout containing every object type and table shape", () => {
    const parsed = parseLayout(serializeLayout(layout));
    expect(parsed).toEqual(layout);
  });

  it("preserves ids, positions, dimensions, rotation and capacity", () => {
    const parsed = parseLayout(serializeLayout(layout));
    expect(parsed.objects.map((o) => o.id)).toEqual(layout.objects.map((o) => o.id));
    expect(parsed.objects.map((o) => [o.x, o.y, o.rotation])).toEqual(
      layout.objects.map((o) => [o.x, o.y, o.rotation]),
    );
    const capacities = parsed.objects.flatMap((o) =>
      o.type === "table" ? [o.capacity] : [],
    );
    expect(capacities).toEqual([8, 10, 4]);
  });

  it("is pretty-printed", () => {
    expect(serializeLayout(layout)).toContain("\n  ");
  });
});

describe("parseLayout rejection", () => {
  it("rejects bad JSON", () => {
    expect(() => parseLayout("{not json")).toThrow(/^Invalid JSON: /);
  });

  it("rejects a non-object top level", () => {
    expect(() => parseLayout("[]")).toThrow(/expected a JSON object/);
  });

  it("rejects a wrong schema_version naming found and expected", () => {
    const json = JSON.stringify({ ...layout, schema_version: 2 });
    expect(() => parseLayout(json)).toThrow(/found 2.*expected 1/);
  });

  it("rejects a missing schema_version", () => {
    const json = JSON.stringify({ hall: layout.hall, objects: [] });
    expect(() => parseLayout(json)).toThrow(/found missing.*expected 1/);
  });

  it("rejects an unknown object type with a readable error", () => {
    const json = jsonWithObjects([
      { id: "banana_1", type: "banana", x: 0, y: 0, rotation: 0, width: 1 },
    ]);
    expect(() => parseLayout(json)).toThrow(
      /objects\[0\]\.type: Unknown object type "banana"/,
    );
  });

  it("rejects walls in this step", () => {
    const json = jsonWithObjects([
      { id: "wall_1", type: "wall", x: 0, y: 0, rotation: 0, width: 1, height: 1 },
    ]);
    expect(() => parseLayout(json)).toThrow(/Unknown object type "wall"/);
  });

  it("rejects an unknown table shape", () => {
    const json = jsonWithObjects([{ ...baseTable, shape: "hexagon" }]);
    expect(() => parseLayout(json)).toThrow(/objects\[0\]\.shape/);
  });

  it("rejects capacity 0", () => {
    const json = jsonWithObjects([{ ...baseTable, capacity: 0 }]);
    expect(() => parseLayout(json)).toThrow(/objects\[0\]\.capacity/);
  });

  it("rejects capacity 31", () => {
    const json = jsonWithObjects([{ ...baseTable, capacity: 31 }]);
    expect(() => parseLayout(json)).toThrow(/objects\[0\]\.capacity/);
  });

  it("rejects capacity 2.5", () => {
    const json = jsonWithObjects([{ ...baseTable, capacity: 2.5 }]);
    expect(() => parseLayout(json)).toThrow(/objects\[0\]\.capacity/);
  });

  it("rejects negative width", () => {
    const json = jsonWithObjects([
      { id: "stage_x", type: "stage", x: 0, y: 0, rotation: 0, width: -2, height: 4 },
    ]);
    expect(() => parseLayout(json)).toThrow(/objects\[0\]\.width/);
  });

  it("rejects zero radius", () => {
    const json = jsonWithObjects([{ ...baseTable, radius: 0 }]);
    expect(() => parseLayout(json)).toThrow(/objects\[0\]\.radius/);
  });

  it("includes the index of the offending object in the path", () => {
    const json = jsonWithObjects([
      layout.objects[0],
      layout.objects[1],
      { ...baseTable, capacity: 0 },
    ]);
    expect(() => parseLayout(json)).toThrow(/objects\[2\]\.capacity/);
  });

  it("strips unknown keys on parse", () => {
    const json = jsonWithObjects([{ ...baseTable, selected: true }]);
    const parsed = parseLayout(json);
    expect(parsed.objects[0]).not.toHaveProperty("selected");
  });
});

describe("serializeLayout output", () => {
  it("has exactly schema_version, hall and objects at the top level", () => {
    const parsed: unknown = JSON.parse(serializeLayout(layout));
    expect(Object.keys(parsed as Record<string, unknown>).sort()).toEqual([
      "hall",
      "objects",
      "schema_version",
    ]);
  });

  it("drops UI keys even when extra props are passed in", () => {
    const dirty = {
      ...layout,
      hall: { ...layout.hall, snapEnabled: true },
      selectedId: "table_aaaa0001",
      tool: "select",
      viewport: { scale: 20, offsetX: 0, offsetY: 0 },
      snapEnabled: true,
      gridSize: 0.5,
    };
    const json = serializeLayout(dirty);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["hall", "objects", "schema_version"]);
    for (const key of ["selectedId", "tool", "viewport", "snapEnabled", "gridSize"]) {
      expect(json).not.toContain(key);
    }
  });

  it("throws a readable error for an invalid layout", () => {
    const bad: HallLayout = {
      ...layout,
      objects: [
        {
          id: "table_bad",
          type: "table",
          shape: "round",
          x: 0,
          y: 0,
          rotation: 0,
          radius: 1,
          capacity: 99,
        },
      ],
    };
    expect(() => serializeLayout(bad)).toThrow(/objects\[0\]\.capacity/);
  });
});

describe("storage helpers", () => {
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
    if (original) Object.defineProperty(globalThis, "localStorage", original);
  });

  function installStub(overrides?: { setItem?: () => void }): Map<string, string> {
    const data = new Map<string, string>();
    const stub = {
      getItem: (key: string): string | null => data.get(key) ?? null,
      setItem:
        overrides?.setItem ??
        ((key: string, value: string): void => {
          data.set(key, value);
        }),
      removeItem: (key: string): void => {
        data.delete(key);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: stub,
      configurable: true,
      writable: true,
    });
    return data;
  }

  it("saves and loads a layout round trip", () => {
    const data = installStub();
    expect(saveLayoutToStorage(layout)).toEqual({ ok: true, value: null });
    expect(data.has(STORAGE_KEY)).toBe(true);
    const loaded = loadLayoutFromStorage();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(layout);
  });

  it("reports a missing key", () => {
    installStub();
    expect(loadLayoutFromStorage()).toEqual({
      ok: false,
      error: "No saved layout found.",
    });
  });

  it("reports corrupt stored data without throwing", () => {
    const data = installStub();
    data.set(STORAGE_KEY, "{broken");
    const loaded = loadLayoutFromStorage();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error).toContain("Invalid JSON");
  });

  it("returns ok:false when setItem throws (quota exceeded)", () => {
    installStub({
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    const result = saveLayoutToStorage(layout);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("QuotaExceededError");
  });

  it("returns ok:false from save when localStorage is unavailable", () => {
    expect(typeof (globalThis as { localStorage?: unknown }).localStorage).toBe(
      "undefined",
    );
    const result = saveLayoutToStorage(layout);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false from load when localStorage is unavailable", () => {
    const result = loadLayoutFromStorage();
    expect(result.ok).toBe(false);
  });
});