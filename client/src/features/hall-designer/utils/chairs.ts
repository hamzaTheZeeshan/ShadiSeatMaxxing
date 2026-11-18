import type { TableObject } from "../types/layout";

export interface Chair {
  x: number;
  y: number;
  rotation: number;
}

export const CHAIR_RADIUS = 0.2;
export const CHAIR_OFFSET = 0.25;

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

// Rounds to 1e-6 and removes -0 / NaN so output is stable and deterministic.
function clean(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e6) / 1e6 + 0;
}

function cleanAngle(deg: number): number {
  const c = clean(((deg % 360) + 360) % 360);
  return c >= 360 ? 0 : c;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

// Round: evenly spaced by angle on radius + CHAIR_OFFSET, first chair at the top, clockwise.
function roundChairs(radius: number, count: number): Chair[] {
  const r = radius + CHAIR_OFFSET;
  const chairs: Chair[] = [];
  for (let i = 0; i < count; i++) {
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / count;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    chairs.push({
      x: clean(x),
      y: clean(y),
      rotation: cleanAngle(toDegrees(Math.atan2(-y, -x))),
    });
  }
  return chairs;
}

// Rect/square: evenly spaced by arc length along the perimeter of the offset rectangle
// (width + 2*offset) x (height + 2*offset), starting at its top-left corner, clockwise.
// Each chair faces the nearest point of the table body.
function rectChairs(width: number, height: number, count: number): Chair[] {
  const w = width + 2 * CHAIR_OFFSET;
  const h = height + 2 * CHAIR_OFFSET;
  const perimeter = 2 * (w + h);
  const hw = width / 2;
  const hh = height / 2;
  const chairs: Chair[] = [];
  for (let i = 0; i < count; i++) {
    let s = (perimeter * i) / count;
    let x: number;
    let y: number;
    if (s < w) {
      x = -w / 2 + s;
      y = -h / 2;
    } else if ((s -= w) < h) {
      x = w / 2;
      y = -h / 2 + s;
    } else if ((s -= h) < w) {
      x = w / 2 - s;
      y = h / 2;
    } else {
      s -= w;
      x = -w / 2;
      y = h / 2 - s;
    }
    const qx = Math.min(Math.max(x, -hw), hw);
    const qy = Math.min(Math.max(y, -hh), hh);
    chairs.push({
      x: clean(x),
      y: clean(y),
      rotation: cleanAngle(toDegrees(Math.atan2(qy - y, qx - x))),
    });
  }
  return chairs;
}

export function generateChairs(table: TableObject): Chair[] {
  const count = Number.isFinite(table.capacity) ? Math.max(0, Math.floor(table.capacity)) : 0;
  switch (table.shape) {
    case "round":
      return roundChairs(table.radius, count);
    case "rectangular":
    case "square":
      return rectChairs(table.width, table.height, count);
    default:
      return assertNever(table);
  }
}