import { describe, it, expect } from "vitest";
import { worldToScreen, screenToWorld } from "./coords";

describe("coords", () => {
  const v = { scale: 20, offsetX: 100, offsetY: 50 };
  it("round-trips world → screen → world", () => {
    const p = { x: 12.5, y: 3.25 };
    const back = screenToWorld(worldToScreen(p, v), v);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });
  it("maps the origin to the offset", () => {
    expect(worldToScreen({ x: 0, y: 0 }, v)).toEqual({ x: 100, y: 50 });
  });
});