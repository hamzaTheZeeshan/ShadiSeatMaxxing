import type { HallObject } from "../types/layout";
import { CHAIR_OFFSET, CHAIR_RADIUS } from "./chairs";
import { OPENING_THICKNESS } from "./defaults";

export type Vec = { x: number; y: number };
// Convex polygon, world metres.
export type Polygon = Vec[];
export type TableObject = Extract<HallObject, { type: "table" }>;

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

const EPSILON = 1e-9;
const ROUND_SEGMENTS = 32;

function rotatedRect(cx: number, cy: number, width: number, height: number, rotationDeg: number): Polygon {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = width / 2;
  const hh = height / 2;
  const corners: Polygon = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  // Rotation is clockwise on screen (y down): x' = x cos - y sin, y' = x sin + y cos.
  return corners.map((c) => ({ x: cx + c.x * cos - c.y * sin, y: cy + c.x * sin + c.y * cos }));
}

function regularPolygon(cx: number, cy: number, radius: number, segments: number): Polygon {
  const points: Polygon = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (2 * Math.PI * i) / segments;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return points;
}

export function objectPolygon(obj: HallObject): Polygon {
  switch (obj.type) {
    case "table":
      switch (obj.shape) {
        case "round":
          return regularPolygon(obj.x, obj.y, obj.radius, ROUND_SEGMENTS);
        case "rectangular":
        case "square":
          return rotatedRect(obj.x, obj.y, obj.width, obj.height, obj.rotation);
        default:
          return assertNever(obj);
      }
    case "stage":
    case "dance_floor":
    case "restricted_area":
    case "service_area":
      return rotatedRect(obj.x, obj.y, obj.width, obj.height, obj.rotation);
    case "entrance":
    case "exit":
      return rotatedRect(obj.x, obj.y, obj.width, OPENING_THICKNESS, obj.rotation);
    default:
      return assertNever(obj);
  }
}

// Table body outset by CHAIR_OFFSET + CHAIR_RADIUS so the polygon covers the whole chair ring.
export function tableFootprint(table: TableObject): Polygon {
  const ring = CHAIR_OFFSET + CHAIR_RADIUS;
  switch (table.shape) {
    case "round":
      return regularPolygon(table.x, table.y, table.radius + ring, ROUND_SEGMENTS);
    case "rectangular":
    case "square":
      return rotatedRect(table.x, table.y, table.width + 2 * ring, table.height + 2 * ring, table.rotation);
    default:
      return assertNever(table);
  }
}

function edgeAxes(poly: Polygon): Vec[] {
  const axes: Vec[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    if (p === undefined || q === undefined) continue;
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const len = Math.hypot(ex, ey);
    if (len === 0) continue;
    axes.push({ x: -ey / len, y: ex / len });
  }
  return axes;
}

function project(poly: Polygon, axis: Vec): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * axis.x + p.y * axis.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

// Separating Axis Theorem. Touching edges do NOT count as overlap.
export function polygonsOverlap(a: Polygon, b: Polygon): boolean {
  if (a.length < 3 || b.length < 3) return false;
  for (const axis of [...edgeAxes(a), ...edgeAxes(b)]) {
    const pa = project(a, axis);
    const pb = project(b, axis);
    if (pa.max <= pb.min + EPSILON || pb.max <= pa.min + EPSILON) return false;
  }
  return true;
}

function pointSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function minVertexToEdges(points: Polygon, poly: Polygon): number {
  let best = Infinity;
  for (const p of points) {
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (a === undefined || b === undefined) continue;
      const d = pointSegmentDistance(p, a, b);
      if (d < best) best = d;
    }
  }
  return best;
}

// Minimum distance between two convex polygons; 0 if they overlap.
export function polygonDistance(a: Polygon, b: Polygon): number {
  if (polygonsOverlap(a, b)) return 0;
  return Math.min(minVertexToEdges(a, b), minVertexToEdges(b, a));
}

export function polygonInsideRect(poly: Polygon, width: number, height: number): boolean {
  return poly.every(
    (p) => p.x >= -EPSILON && p.x <= width + EPSILON && p.y >= -EPSILON && p.y <= height + EPSILON,
  );
}