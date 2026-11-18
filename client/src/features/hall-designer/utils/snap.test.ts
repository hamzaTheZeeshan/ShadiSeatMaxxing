import { describe, it, expect } from "vitest";
import {
  ROTATION_STEP,
  normalizeRotation,
  snapPoint,
  snapRotation,
  snapValue,
} from "./snap";

describe("snapValue", () => {
  it("snaps to a 0.25 grid", () => {
    expect(snapValue(0.1, 0.25)).toBe(0);
    expect(snapValue(0.13, 0.25)).toBe(0.25);
    expect(snapValue(1.4, 0.25)).toBe(1.5);
    expect(snapValue(3.0, 0.25)).toBe(3);
  });

  it("snaps to a 0.5 grid", () => {
    expect(snapValue(0.7, 0.5)).toBe(0.5);
    expect(snapValue(0.8, 0.5)).toBe(1);
    expect(snapValue(12.24, 0.5)).toBe(12);
    expect(snapValue(12.26, 0.5)).toBe(12.5);
  });

  it("snaps to a 1 m grid", () => {
    expect(snapValue(2.4, 1)).toBe(2);
    expect(snapValue(2.6, 1)).toBe(3);
    expect(snapValue(39.9, 1)).toBe(40);
  });

  it("handles negative values", () => {
    expect(snapValue(-0.3, 0.5)).toBe(-0.5);
    expect(snapValue(-1.6, 1)).toBe(-2);
    expect(snapValue(-0.8, 0.25)).toBe(-0.75);
  });

  it("never returns negative zero", () => {
    expect(Object.is(snapValue(-0.1, 0.5), -0)).toBe(false);
    expect(Object.is(snapValue(-0.1, 0.5), 0)).toBe(true);
    expect(Object.is(snapValue(-0, 1), 0)).toBe(true);
  });

  it("returns the value unchanged for an invalid grid", () => {
    expect(snapValue(1.37, 0)).toBe(1.37);
    expect(snapValue(1.37, -1)).toBe(1.37);
    expect(snapValue(1.37, Number.NaN)).toBe(1.37);
  });
});

describe("snapPoint", () => {
  it("snaps both axes", () => {
    expect(snapPoint({ x: 1.3, y: 2.8 }, 0.5)).toEqual({ x: 1.5, y: 3 });
  });

  it("avoids negative zero on both axes", () => {
    const p = snapPoint({ x: -0.1, y: -0.2 }, 0.5);
    expect(Object.is(p.x, 0)).toBe(true);
    expect(Object.is(p.y, 0)).toBe(true);
  });
});

describe("normalizeRotation", () => {
  it("keeps values already in range", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(359.5)).toBe(359.5);
  });

  it("wraps values >= 360", () => {
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(720)).toBe(0);
  });

  it("wraps negative values into [0, 360)", () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-360)).toBe(0);
    expect(normalizeRotation(-1)).toBe(359);
  });

  it("never returns negative zero", () => {
    expect(Object.is(normalizeRotation(-0), 0)).toBe(true);
  });

  it("returns 0 for non-finite input", () => {
    expect(normalizeRotation(Number.NaN)).toBe(0);
    expect(normalizeRotation(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("snapRotation", () => {
  it("uses a 15 degree default step", () => {
    expect(ROTATION_STEP).toBe(15);
    expect(snapRotation(7)).toBe(0);
    expect(snapRotation(8)).toBe(15);
    expect(snapRotation(44)).toBe(45);
    expect(snapRotation(90)).toBe(90);
  });

  it("wraps around 360 consistently", () => {
    expect(snapRotation(359)).toBe(0);
    expect(snapRotation(352.4)).toBe(345);
    expect(snapRotation(352.5)).toBe(0);
    expect(snapRotation(360)).toBe(0);
    expect(snapRotation(725)).toBe(0);
  });

  it("handles negative angles", () => {
    expect(snapRotation(-15)).toBe(345);
    expect(snapRotation(-1)).toBe(0);
    expect(Object.is(snapRotation(-1), 0)).toBe(true);
    expect(snapRotation(-100)).toBe(255);
  });

  it("accepts a custom step", () => {
    expect(snapRotation(50, 45)).toBe(45);
    expect(snapRotation(70, 45)).toBe(90);
    expect(snapRotation(350, 45)).toBe(0);
  });

  it("falls back to plain normalization for an invalid step", () => {
    expect(snapRotation(370, 0)).toBe(10);
    expect(snapRotation(-10, -5)).toBe(350);
  });

  it("always returns a value in [0, 360)", () => {
    for (let d = -720; d <= 720; d += 7.3) {
      const r = snapRotation(d);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(360);
    }
  });
});