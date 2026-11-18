import type { Viewport } from "../types/layout";

export interface Point { x: number; y: number }

export const worldToScreen = (p: Point, v: Viewport): Point => ({
  x: p.x * v.scale + v.offsetX,
  y: p.y * v.scale + v.offsetY,
});

export const screenToWorld = (p: Point, v: Viewport): Point => ({
  x: (p.x - v.offsetX) / v.scale,
  y: (p.y - v.offsetY) / v.scale,
});

export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export function fitViewport(
  hall: { width: number; height: number },
  container: { width: number; height: number },
  padding = 40
): Viewport {
  const scale = Math.min(
    (container.width - padding * 2) / hall.width,
    (container.height - padding * 2) / hall.height
  );
  return {
    scale,
    offsetX: (container.width - hall.width * scale) / 2,
    offsetY: (container.height - hall.height * scale) / 2,
  };
}