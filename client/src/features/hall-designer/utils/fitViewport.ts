import type { Hall, Viewport } from "../types/layout";

// Assumes screen = world * scale + offset (hall origin at top-left).
export function fitViewport(
  hall: Pick<Hall, "width" | "height">,
  canvasWidth: number,
  canvasHeight: number,
  padding = 32,
): Viewport {
  const availW = Math.max(canvasWidth - padding * 2, 1);
  const availH = Math.max(canvasHeight - padding * 2, 1);
  const scale = Math.min(availW / hall.width, availH / hall.height);
  return {
    scale,
    offsetX: (canvasWidth - hall.width * scale) / 2,
    offsetY: (canvasHeight - hall.height * scale) / 2,
  };
}