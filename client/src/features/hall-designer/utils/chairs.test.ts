import { describe, it, expect } from "vitest";
import type { TableObject } from "../types/layout";
import { CHAIR_OFFSET, generateChairs } from "./chairs";

function round(capacity: number): TableObject {
  return { id: "table_round", type: "table", shape: "round", x: 0, y: 0, rotation: 0, radius: 1.2, capacity };
}

function rect(capacity: number): TableObject {
  return { id: "table_rect", type: "table", shape: "rectangular", x: 0, y: 0, rotation: 0, width: 2.4, height: 1.2, capacity };
}

function square(capacity: number): TableObject {
  return { id: "table_square", type: "table", shape: "square", x: 0, y: 0, rotation: 0, width: 1.5, height: 1.5, capacity };
}

const CAPACITIES = [1, 8, 30];
const MAKERS: Array<[string, (capacity: number) => TableObject]> = [
  ["round", round],
  ["rectangular", rect],
  ["square", square],
];

describe("generateChairs", () => {
  for (const [name, make] of MAKERS) {
    for (const capacity of CAPACITIES) {
      it(`${name}: returns ${capacity} chair(s)`, () => {
        expect(generateChairs(make(capacity))).toHaveLength(capacity);
      });

      it(`${name}: capacity ${capacity} is finite, never NaN or -0`, () => {
        for (const chair of generateChairs(make(capacity))) {
          for (const v of [chair.x, chair.y, chair.rotation]) {
            expect(Number.isFinite(v)).toBe(true);
            expect(Object.is(v, -0)).toBe(false);
          }
        }
      });

      it(`${name}: capacity ${capacity} is deterministic`, () => {
        expect(generateChairs(make(capacity))).toEqual(generateChairs(make(capacity)));
      });

      it(`${name}: capacity ${capacity} chairs are outside the table body`, () => {
        const table = make(capacity);
        for (const chair of generateChairs(table)) {
          switch (table.shape) {
            case "round":
              expect(Math.hypot(chair.x, chair.y)).toBeGreaterThan(table.radius);
              break;
            case "rectangular":
            case "square":
              expect(
                Math.abs(chair.x) > table.width / 2 + 1e-9 || Math.abs(chair.y) > table.height / 2 + 1e-9,
              ).toBe(true);
              break;
          }
        }
      });
    }
  }

  it("round: chairs are all equidistant from the center", () => {
    for (const capacity of CAPACITIES) {
      for (const chair of generateChairs(round(capacity))) {
        expect(Math.hypot(chair.x, chair.y)).toBeCloseTo(1.2 + 0.25, 4);
      }
    }
  });

  it("uses the 0.25 m chair offset", () => {
    expect(CHAIR_OFFSET).toBe(0.25);
  });

  it("round: capacity 1 puts one chair at the top facing the center", () => {
    const [chair] = generateChairs(round(1));
    expect(chair).toBeDefined();
    expect(chair?.x).toBeCloseTo(0, 4);
    expect(chair?.y).toBeCloseTo(-1.45, 4);
    expect(chair?.rotation).toBeCloseTo(90, 4);
  });

  it("rect: first chair sits at the top-left corner of the offset path", () => {
    const [chair] = generateChairs(rect(8));
    expect(chair?.x).toBeCloseTo(-(1.2 + 0.25), 4);
    expect(chair?.y).toBeCloseTo(-(0.6 + 0.25), 4);
  });
});