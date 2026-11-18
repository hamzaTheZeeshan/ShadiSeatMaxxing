import { describe, it, expect } from "vitest";
import {
  HISTORY_LIMIT,
  canRedoHistory,
  canUndoHistory,
  emptyHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./history";
import type { History, Snapshot } from "./history";

function makeSnapshot(n: number): Snapshot {
  return {
    hall: { id: "hall_1", name: `Hall ${n}`, width: 40, height: 25, unit: "m" },
    objects: [],
  };
}

describe("history", () => {
  it("starts empty", () => {
    const h = emptyHistory();
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
    expect(canUndoHistory(h)).toBe(false);
    expect(canRedoHistory(h)).toBe(false);
  });

  it("push records the before-state in past", () => {
    const h = pushHistory(emptyHistory(), makeSnapshot(1));
    expect(h.past).toEqual([makeSnapshot(1)]);
    expect(canUndoHistory(h)).toBe(true);
    expect(canRedoHistory(h)).toBe(false);
  });

  it("undo moves the current snapshot onto future and returns the last past", () => {
    let h = pushHistory(emptyHistory(), makeSnapshot(1));
    h = pushHistory(h, makeSnapshot(2));
    const result = undoHistory(h, makeSnapshot(3));
    expect(result).not.toBeNull();
    expect(result?.snapshot).toEqual(makeSnapshot(2));
    expect(result?.history.past).toEqual([makeSnapshot(1)]);
    expect(result?.history.future).toEqual([makeSnapshot(3)]);
  });

  it("redo moves the current snapshot back onto past", () => {
    const h = pushHistory(emptyHistory(), makeSnapshot(1));
    const undone = undoHistory(h, makeSnapshot(2));
    expect(undone).not.toBeNull();
    if (undone === null) return;
    const redone = redoHistory(undone.history, makeSnapshot(1));
    expect(redone).not.toBeNull();
    expect(redone?.snapshot).toEqual(makeSnapshot(2));
    expect(redone?.history.past).toEqual([makeSnapshot(1)]);
    expect(redone?.history.future).toEqual([]);
  });

  it("caps past at HISTORY_LIMIT, dropping the oldest", () => {
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      h = pushHistory(h, makeSnapshot(i));
    }
    expect(h.past.length).toBe(HISTORY_LIMIT);
    expect(h.past[0]).toEqual(makeSnapshot(5));
    expect(h.past[HISTORY_LIMIT - 1]).toEqual(makeSnapshot(HISTORY_LIMIT + 4));
  });

  it("a new push clears future", () => {
    const h = pushHistory(emptyHistory(), makeSnapshot(1));
    const undone = undoHistory(h, makeSnapshot(2));
    expect(undone).not.toBeNull();
    if (undone === null) return;
    expect(canRedoHistory(undone.history)).toBe(true);
    const next = pushHistory(undone.history, makeSnapshot(3));
    expect(next.future).toEqual([]);
    expect(canRedoHistory(next)).toBe(false);
  });

  it("returns null when there is nothing to undo or redo", () => {
    expect(undoHistory(emptyHistory(), makeSnapshot(1))).toBeNull();
    expect(redoHistory(emptyHistory(), makeSnapshot(1))).toBeNull();
  });

  it("does not mutate its inputs", () => {
    const base: History = {
      past: Object.freeze([makeSnapshot(1), makeSnapshot(2)]) as Snapshot[],
      future: Object.freeze([makeSnapshot(9)]) as Snapshot[],
    };
    const before = makeSnapshot(3);
    const current = makeSnapshot(4);
    const baseJson = JSON.stringify(base);
    const beforeJson = JSON.stringify(before);
    const currentJson = JSON.stringify(current);

    pushHistory(base, before);
    undoHistory(base, current);
    redoHistory(base, current);

    expect(JSON.stringify(base)).toBe(baseJson);
    expect(JSON.stringify(before)).toBe(beforeJson);
    expect(JSON.stringify(current)).toBe(currentJson);
  });
});