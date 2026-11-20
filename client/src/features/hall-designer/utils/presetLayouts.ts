import type {
  Hall,
  HallLayout,
  HallObject,
  HallObjectType,
  RectObject,
} from "../types/layout";
import { hallLayoutSchema } from "../types/layoutSchema";
import { OPENING_THICKNESS } from "./defaults";

export interface HallPreset {
  id: string;
  name: string;
  description: string;
  tableCount: number;
  /** Table seats plus sofa seats. */
  guestCount: number;
  layout: HallLayout;
}

/* ------------------------------ builder ------------------------------ */

interface GridOpts {
  cols: number;
  rows: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  /** column indexes to leave empty (aisles) */
  skipCols?: number[];
  /** odd rows are shifted by dx/2 and have one column less */
  stagger?: boolean;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

const SOFA_WIDTH = 2;
const SOFA_HEIGHT = 0.9;
const SOFA_CAPACITY = 3;

function builder(prefix: string) {
  const objects: HallObject[] = [];
  let n = 0;
  const nextId = (type: HallObjectType): string =>
    `${type}_${prefix}_${String(++n).padStart(2, "0")}`;

  function eachCell(g: GridOpts, fn: (x: number, y: number) => void): void {
    for (let r = 0; r < g.rows; r++) {
      const shifted = g.stagger === true && r % 2 === 1;
      const cols = shifted ? g.cols - 1 : g.cols;
      for (let c = 0; c < cols; c++) {
        if (!shifted && g.skipCols?.includes(c)) continue;
        const x = g.x0 + (shifted ? g.dx / 2 : 0) + c * g.dx;
        fn(r2(x), r2(g.y0 + r * g.dy));
      }
    }
  }

  return {
    objects,
    round(x: number, y: number, radius: number, capacity: number): void {
      objects.push({
        id: nextId("table"), type: "table", shape: "round",
        x, y, rotation: 0, radius, capacity,
      });
    },
    roundGrid(g: GridOpts, radius: number, capacity: number): void {
      eachCell(g, (x, y) =>
        objects.push({
          id: nextId("table"), type: "table", shape: "round",
          x, y, rotation: 0, radius, capacity,
        }),
      );
    },
    rect(
      x: number, y: number, width: number, height: number, capacity: number,
      rotation = 0, shape: "rectangular" | "square" = "rectangular",
    ): void {
      objects.push({
        id: nextId("table"), type: "table", shape,
        x, y, rotation, width, height, capacity,
      });
    },
    rectGrid(
      g: GridOpts, width: number, height: number, capacity: number,
      rotation = 0, shape: "rectangular" | "square" = "rectangular",
    ): void {
      eachCell(g, (x, y) =>
        objects.push({
          id: nextId("table"), type: "table", shape,
          x, y, rotation, width, height, capacity,
        }),
      );
    },
    sofa(
      x: number, y: number,
      width = SOFA_WIDTH, height = SOFA_HEIGHT, capacity = SOFA_CAPACITY,
      rotation = 0,
    ): void {
      objects.push({
        id: nextId("sofa"), type: "sofa",
        x, y, rotation, width, height, capacity,
      });
    },
    sofaGrid(
      g: GridOpts,
      width = SOFA_WIDTH, height = SOFA_HEIGHT, capacity = SOFA_CAPACITY,
      rotation = 0,
    ): void {
      eachCell(g, (x, y) =>
        objects.push({
          id: nextId("sofa"), type: "sofa",
          x, y, rotation, width, height, capacity,
        }),
      );
    },
    area(
      type: RectObject["type"], x: number, y: number,
      width: number, height: number, rotation = 0,
    ): void {
      objects.push({ id: nextId(type), type, x, y, rotation, width, height });
    },
    opening(
      type: "entrance" | "exit", x: number, y: number,
      width: number, rotation = 0,
    ): void {
      objects.push({ id: nextId(type), type, x, y, rotation, width });
    },
  };
}

function makePreset(
  id: string,
  name: string,
  description: string,
  width: number,
  height: number,
  objects: HallObject[],
): HallPreset {
  const hall: Hall = { id: `hall_${id}`, name, width, height, unit: "m" };
  let tableCount = 0;
  let guestCount = 0;
  for (const o of objects) {
    if (o.type === "table") {
      tableCount += 1;
      guestCount += o.capacity;
    } else if (o.type === "sofa") {
      guestCount += o.capacity;
    }
  }
  return {
    id, name, description, tableCount, guestCount,
    layout: { schema_version: 1, hall, objects },
  };
}

/* ------------------------------ presets ------------------------------ */

function classicBanquet(): HallPreset {
  const b = builder("cb");
  b.area("stage", 15, 2.5, 10, 3);
  b.area("dance_floor", 15, 7.5, 8, 6);
  b.area("service_area", 27.5, 2, 5, 3);
  // senior sofas beside the stage
  b.sofaGrid({ cols: 3, rows: 1, x0: 3.2, y0: 2.2, dx: 2.5, dy: 0 });
  b.sofa(22.5, 2.2);
  b.round(5, 7.5, 1.2, 10);
  b.round(25, 7.5, 1.2, 10);
  b.roundGrid(
    { cols: 7, rows: 2, x0: 4.5, y0: 13, dx: 3.5, dy: 3.5, skipCols: [3] },
    1.2, 10,
  );
  b.opening("entrance", 15, 20, 3);
  b.opening("exit", 0, 10, 3, 90);
  b.opening("exit", 30, 10, 3, 90);
  return makePreset(
    "classic-banquet", "Classic Banquet Hall",
    "Standard 30 × 20 m rectangular hall with a stage, central dance floor, a clear entrance aisle and four sofas beside the stage for elders.",
    30, 20, b.objects,
  );
}

function compactDining(): HallPreset {
  const b = builder("cd");
  b.area("stage", 9, 1.4, 6, 2.2);
  b.area("dance_floor", 9, 5, 5, 3.5);
  b.area("service_area", 15.5, 1.2, 4, 2);
  b.round(2.4, 5.2, 1, 8);
  b.round(15.6, 5.2, 1, 8);
  b.roundGrid({ cols: 5, rows: 1, x0: 2.4, y0: 9.5, dx: 3.3, dy: 0 }, 1, 8);
  b.opening("entrance", 9, 12, 2.5);
  b.opening("exit", 18, 6, 2, 90);
  return makePreset(
    "compact-dining", "Compact Dining Hall",
    "Small 18 × 12 m hall for intimate functions, around 56 guests.",
    18, 12, b.objects,
  );
}

function royalBallroom(): HallPreset {
  const b = builder("rb");
  b.area("stage", 25, 3.5, 16, 5);
  b.area("dance_floor", 25, 13, 14, 10);
  b.area("service_area", 4, 3, 6, 4);
  b.area("service_area", 46, 3, 6, 4);
  // senior sofas flanking the stage
  b.sofaGrid({ cols: 3, rows: 1, x0: 9.5, y0: 2.5, dx: 3, dy: 0 });
  b.sofaGrid({ cols: 3, rows: 1, x0: 34.5, y0: 2.5, dx: 3, dy: 0 });
  b.roundGrid({ cols: 3, rows: 4, x0: 5.5, y0: 8, dx: 3.5, dy: 4 }, 1.3, 10);
  b.roundGrid({ cols: 3, rows: 4, x0: 37.5, y0: 8, dx: 3.5, dy: 4 }, 1.3, 10);
  b.roundGrid({ cols: 8, rows: 2, x0: 6, y0: 25, dx: 5.4, dy: 5 }, 1.3, 10);
  b.opening("entrance", 25, 35, 6);
  b.opening("exit", 0, 17.5, 4, 90);
  b.opening("exit", 50, 17.5, 4, 90);
  return makePreset(
    "royal-ballroom", "Royal Ballroom",
    "Large 50 × 35 m ballroom with a wide stage, grand dance floor, 400 table seats and six senior sofas beside the stage.",
    50, 35, b.objects,
  );
}

function longTableFamily(): HallPreset {
  const b = builder("lt");
  b.area("stage", 14, 1.6, 8, 2.4);
  b.area("dance_floor", 14, 6.5, 7, 5);
  b.area("service_area", 24.5, 1.5, 5, 2.4);
  for (const x of [3, 5.5, 22.5, 25]) b.rect(x, 6.5, 5.4, 1.2, 10, 90);
  b.rectGrid({ cols: 4, rows: 1, x0: 4.4, y0: 12.3, dx: 6.4, dy: 0 }, 5.4, 1.2, 10);
  b.rectGrid({ cols: 4, rows: 1, x0: 4.4, y0: 14.8, dx: 6.4, dy: 0 }, 5.4, 1.2, 10);
  b.opening("entrance", 14, 16, 3);
  b.opening("exit", 0, 8, 2.5, 90);
  b.opening("exit", 28, 8, 2.5, 90);
  return makePreset(
    "long-table-family", "Long-Table Family Hall",
    "Family-style seating on long rectangular tables, 28 × 16 m.",
    28, 16, b.objects,
  );
}

function lShapedHall(): HallPreset {
  const b = builder("ls");
  // the cut-out corner of the L
  b.area("restricted_area", 29, 5, 14, 10);
  b.area("stage", 10, 2.5, 10, 4);
  b.area("dance_floor", 11, 9, 8, 6);
  b.area("service_area", 33.5, 11.8, 4, 3);
  b.round(18, 3, 1.2, 8);
  b.round(18, 7, 1.2, 8);
  b.round(3, 8, 1.2, 8);
  b.roundGrid({ cols: 8, rows: 2, x0: 4, y0: 15.5, dx: 4, dy: 4 }, 1.2, 8);
  b.opening("entrance", 18, 24, 3.5);
  b.opening("exit", 36, 17, 3, 90);
  b.opening("exit", 0, 17, 3, 90);
  return makePreset(
    "l-shaped-hall", "L-Shaped Hall",
    "36 × 24 m footprint with the top-right corner blocked off to form an L.",
    36, 24, b.objects,
  );
}

function outdoorLawn(): HallPreset {
  const b = builder("ol");
  b.area("stage", 22.5, 3, 12, 4);
  b.area("dance_floor", 22.5, 12, 10, 8);
  b.area("service_area", 40, 3, 6, 4);
  b.area("restricted_area", 5, 3, 6, 4);
  // shaded senior sofas beside the stage
  b.sofaGrid({ cols: 2, rows: 1, x0: 10.5, y0: 2.5, dx: 3, dy: 0 });
  b.sofaGrid({ cols: 2, rows: 1, x0: 31.5, y0: 2.5, dx: 3, dy: 0 });
  b.roundGrid({ cols: 2, rows: 2, x0: 8, y0: 9, dx: 4, dy: 4 }, 1.2, 8);
  b.roundGrid({ cols: 2, rows: 2, x0: 33, y0: 9, dx: 4, dy: 4 }, 1.2, 8);
  b.roundGrid(
    { cols: 8, rows: 3, x0: 4.3, y0: 19.5, dx: 5.2, dy: 4, stagger: true },
    1.2, 8,
  );
  b.opening("entrance", 22.5, 30, 6);
  b.opening("exit", 0, 15, 4, 90);
  b.opening("exit", 45, 15, 4, 90);
  return makePreset(
    "outdoor-lawn", "Outdoor Lawn",
    "Open-air 45 × 30 m lawn with staggered tables, four senior sofas by the stage, a catering tent and a generator zone.",
    45, 30, b.objects,
  );
}

function intimateNikkah(): HallPreset {
  const b = builder("in");
  b.area("stage", 10, 1.8, 6, 2.4);
  b.area("service_area", 17.5, 1.5, 4, 2.4);
  b.rectGrid(
    { cols: 6, rows: 3, x0: 2.5, y0: 5.5, dx: 3, dy: 3 },
    1.5, 1.5, 4, 0, "square",
  );
  b.opening("entrance", 10, 14, 3);
  b.opening("exit", 20, 8, 2.5, 90);
  return makePreset(
    "intimate-nikkah", "Intimate Nikkah Hall",
    "20 × 14 m ceremony hall with a small stage and 18 square four-seat tables.",
    20, 14, b.objects,
  );
}

function courtyardMehndi(): HallPreset {
  const b = builder("cm");
  b.area("stage", 20, 3, 12, 4);
  b.area("dance_floor", 20, 14, 10, 10);
  b.area("restricted_area", 5, 3, 6, 4); // bridal green room
  b.area("service_area", 35, 3, 6, 4);
  // two rows of senior sofas flanking the stage
  b.sofaGrid({ cols: 1, rows: 2, x0: 11, y0: 2.5, dx: 0, dy: 1.7 });
  b.sofaGrid({ cols: 1, rows: 2, x0: 29, y0: 2.5, dx: 0, dy: 1.7 });
  b.roundGrid({ cols: 2, rows: 4, x0: 6, y0: 8, dx: 4, dy: 4 }, 1.2, 8);
  b.roundGrid({ cols: 2, rows: 4, x0: 30, y0: 8, dx: 4, dy: 4 }, 1.2, 8);
  b.roundGrid(
    { cols: 5, rows: 1, x0: 8, y0: 24, dx: 6, dy: 0, skipCols: [2] },
    1.2, 8,
  );
  b.opening("entrance", 20, 28, 4);
  b.opening("exit", 0, 14, 3, 90);
  b.opening("exit", 40, 14, 3, 90);
  return makePreset(
    "courtyard-mehndi", "Courtyard Mehndi Hall",
    "Central dance floor surrounded by tables on both sides, with a green room and four sofas flanking the stage.",
    40, 28, b.objects,
  );
}

function longNarrowHall(): HallPreset {
  const b = builder("ln");
  b.area("stage", 1.8, 6, 10, 3, 90);
  b.area("dance_floor", 9, 6, 6, 8);
  b.area("service_area", 9, 11.2, 5, 1.6);
  b.roundGrid({ cols: 8, rows: 3, x0: 15, y0: 2.5, dx: 3.2, dy: 3.5 }, 1.1, 8);
  b.opening("entrance", 40, 6, 3.5, 90);
  b.opening("exit", 20, 0, 3);
  b.opening("exit", 20, 12, 3);
  return makePreset(
    "long-narrow-hall", "Long Narrow Hall",
    "40 × 12 m corridor-style hall with the stage at one end and the entrance at the other.",
    40, 12, b.objects,
  );
}

function buffetBanquet(): HallPreset {
  const b = builder("bb");
  b.area("stage", 20, 2.5, 10, 3);
  b.area("dance_floor", 20, 9, 8, 6);
  b.area("service_area", 6, 3, 8, 2); // buffet line
  b.area("service_area", 34, 3, 8, 2); // buffet line
  b.area("restricted_area", 38.2, 24, 3.6, 3); // kitchen
  b.rectGrid({ cols: 1, rows: 3, x0: 6, y0: 8, dx: 0, dy: 3 }, 2.4, 1.2, 6);
  b.rectGrid({ cols: 1, rows: 3, x0: 34, y0: 8, dx: 0, dy: 3 }, 2.4, 1.2, 6);
  b.round(12, 9, 1.2, 8);
  b.round(28, 9, 1.2, 8);
  b.roundGrid({ cols: 7, rows: 2, x0: 5, y0: 18, dx: 5, dy: 4 }, 1.2, 8);
  b.opening("entrance", 20, 26, 4);
  b.opening("exit", 0, 13, 3, 90);
  b.opening("exit", 40, 13, 3, 90);
  return makePreset(
    "buffet-banquet", "Buffet-Style Banquet",
    "Mixed round and rectangular tables with two buffet lines and a kitchen block.",
    40, 26, b.objects,
  );
}

const BUILDERS: readonly (() => HallPreset)[] = [
  classicBanquet,
  compactDining,
  royalBallroom,
  longTableFamily,
  lShapedHall,
  outdoorLawn,
  intimateNikkah,
  courtyardMehndi,
  longNarrowHall,
  buffetBanquet,
];

export const HALL_PRESETS: readonly HallPreset[] = BUILDERS.map((f) => f());

/** Deep copy so callers can never mutate the library. */
export function getPresetLayout(id: string): HallLayout | null {
  const preset = HALL_PRESETS.find((p) => p.id === id);
  return preset ? structuredClone(preset.layout) : null;
}

/* ----------------------------- validation ----------------------------- */

interface Box { x0: number; y0: number; x1: number; y1: number }

function boundingBox(o: HallObject): Box {
  if (o.type === "table" && o.shape === "round") {
    return { x0: o.x - o.radius, y0: o.y - o.radius, x1: o.x + o.radius, y1: o.y + o.radius };
  }
  const h = "height" in o ? o.height : OPENING_THICKNESS;
  const rad = (o.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  const bw = o.width * c + h * s;
  const bh = o.width * s + h * c;
  return { x0: o.x - bw / 2, y0: o.y - bh / 2, x1: o.x + bw / 2, y1: o.y + bh / 2 };
}

const EPS = 1e-6;

/** Returns human-readable problems; empty array means all presets are good. */
export function validatePresets(): string[] {
  const problems: string[] = [];
  const presetIds = new Set<string>();

  for (const p of HALL_PRESETS) {
    if (presetIds.has(p.id)) problems.push(`${p.id}: duplicate preset id`);
    presetIds.add(p.id);

    const parsed = hallLayoutSchema.safeParse(p.layout);
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        problems.push(`${p.id}: ${i.path.join(".")}: ${i.message}`);
      }
      continue;
    }

    const { hall, objects } = p.layout;
    const ids = new Set<string>();
    const solid: { id: string; box: Box }[] = [];

    for (const o of objects) {
      if (ids.has(o.id)) problems.push(`${p.id}: duplicate object id ${o.id}`);
      ids.add(o.id);
      if (o.type === "entrance" || o.type === "exit") continue; // on the wall line
      const box = boundingBox(o);
      if (box.x0 < -EPS || box.y0 < -EPS || box.x1 > hall.width + EPS || box.y1 > hall.height + EPS) {
        problems.push(`${p.id}: ${o.id} is outside the hall`);
      }
      solid.push({ id: o.id, box });
    }

    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) {
        const a = solid[i]!.box;
        const c = solid[j]!.box;
        if (a.x0 < c.x1 - EPS && c.x0 < a.x1 - EPS && a.y0 < c.y1 - EPS && c.y0 < a.y1 - EPS) {
          problems.push(`${p.id}: ${solid[i]!.id} overlaps ${solid[j]!.id}`);
        }
      }
    }
  }
  return problems;
}

if (import.meta.env.DEV) {
  const problems = validatePresets();
  if (problems.length > 0) console.error("Invalid hall presets:\n" + problems.join("\n"));
}