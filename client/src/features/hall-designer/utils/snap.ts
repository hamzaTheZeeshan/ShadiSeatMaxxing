import type { Point } from "./coords";

export const ROTATION_STEP = 15;

// Avoids returning -0.
const noNegativeZero = (n: number): number => (n === 0 ? 0 : n);

export function snapValue(value: number, grid: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(grid) || grid <= 0) {
    return value;
  }
  return noNegativeZero(Math.round(value / grid) * grid);
}

export function snapPoint(p: Point, grid: number): Point {
  return { x: snapValue(p.x, grid), y: snapValue(p.y, grid) };
}

export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return noNegativeZero(((deg % 360) + 360) % 360);
}

export function snapRotation(deg: number, step: number = ROTATION_STEP): number {
  if (!Number.isFinite(deg)) return 0;
  if (!Number.isFinite(step) || step <= 0) return normalizeRotation(deg);
  return normalizeRotation(Math.round(deg / step) * step);
}