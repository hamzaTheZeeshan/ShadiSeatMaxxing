import { beforeEach, describe, it, expect } from "vitest";
import type { Hall, HallLayout, HallObject } from "../types/layout";
import { createObject } from "../utils/defaults";
import type { ObjectPatch } from "./editorStore";
import { useEditorStore } from "./editorStore";

function makeHall(): Hall {
  return { id: "hall_test", name: "Test Hall", width: 40, height: 25, unit: "m" };
}

// loadLayout also clears the store's internal history and pending gesture baseline.
function resetStore(): void {
  useEditorStore
    .getState()
    .loadLayout({ schema_version: 1, hall: makeHall(), objects: [] });
  useEditorStore.setState({
    viewport: { scale: 20, offsetX: 0, offsetY: 0 },
    selectedId: null,
    tool: "select",
    snapEnabled: true,
    gridSize: 0.5,
    layoutVersion: 0,
    canUndo: false,
    canRedo: false,
  });
}

function seed(...objects: HallObject[]): void {
  useEditorStore
    .getState()
    .loadLayout({ schema_version: 1, hall: makeHall(), objects });
}

function getObject(id: string): HallObject {
  const obj = useEditorStore.getState().objects.find((o) => o.id === id);
  if (obj === undefined) throw new Error(`Object ${id} not found`);
  return obj;
}

// Undoes until nothing is left and returns how many steps it took.
function countUndoSteps(): number {
  let n = 0;
  while (useEditorStore.getState().canUndo && n < 1000) {
    useEditorStore.getState().undo();
    n++;
  }
  return n;
}

describe("editorStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("addObject appends, selects, resets tool and is one undo step", () => {
    const obj = createObject("table_round", { x: 5, y: 5 });
    const store = useEditorStore.getState();
    store.setTool("table_round");
    store.addObject(obj);

    const state = useEditorStore.getState();
    expect(state.objects.length).toBe(1);
    expect(state.objects[0]?.id).toBe(obj.id);
    expect(state.selectedId).toBe(obj.id);
    expect(state.tool).toBe("select");
    expect(state.canUndo).toBe(true);

    expect(countUndoSteps()).toBe(1);
    expect(useEditorStore.getState().objects.length).toBe(0);
  });

  it("updateObject x20 then commitObjectUpdate is exactly one undo step", () => {
    const obj = createObject("table_round", { x: 10, y: 10 });
    seed(obj);

    for (let i = 1; i <= 20; i++) {
      useEditorStore.getState().updateObject(obj.id, { x: 10 + i * 0.1, y: 10 });
    }
    expect(useEditorStore.getState().canUndo).toBe(false);
    expect(getObject(obj.id).x).toBeCloseTo(12, 5);

    useEditorStore.getState().commitObjectUpdate(obj.id, { x: 12, y: 10 });
    expect(useEditorStore.getState().canUndo).toBe(true);
    expect(countUndoSteps()).toBe(1);
    expect(getObject(obj.id).x).toBe(10);
    expect(getObject(obj.id).y).toBe(10);
  });

  it("removeObject clears selection and undo restores the same id", () => {
    const obj = createObject("stage", { x: 20, y: 5 });
    seed(obj);
    useEditorStore.getState().select(obj.id);

    useEditorStore.getState().removeObject(obj.id);
    expect(useEditorStore.getState().objects.length).toBe(0);
    expect(useEditorStore.getState().selectedId).toBeNull();

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().objects[0]?.id).toBe(obj.id);
  });

  it("undo/redo round trip", () => {
    const obj = createObject("table_round", { x: 10, y: 10 });
    seed(obj);

    useEditorStore.getState().commitObjectUpdate(obj.id, { x: 12 });
    expect(getObject(obj.id).x).toBe(12);

    useEditorStore.getState().undo();
    expect(getObject(obj.id).x).toBe(10);
    expect(useEditorStore.getState().canRedo).toBe(true);

    useEditorStore.getState().redo();
    expect(getObject(obj.id).x).toBe(12);
    expect(useEditorStore.getState().canUndo).toBe(true);
    expect(useEditorStore.getState().canRedo).toBe(false);
  });

  it("a new action after undo clears redo", () => {
    const obj = createObject("table_round", { x: 10, y: 10 });
    seed(obj);

    useEditorStore.getState().commitObjectUpdate(obj.id, { x: 12 });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().canRedo).toBe(true);

    useEditorStore.getState().commitObjectUpdate(obj.id, { y: 15 });
    expect(useEditorStore.getState().canRedo).toBe(false);
  });

  it("undo clears selection when the selected object no longer exists", () => {
    const obj = createObject("table_round", { x: 10, y: 10 });
    useEditorStore.getState().addObject(obj);
    expect(useEditorStore.getState().selectedId).toBe(obj.id);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  it("invalid patches are no-ops with no history entry", () => {
    const obj = createObject("table_rect", { x: 10, y: 10 });
    seed(obj);
    const original = structuredClone(getObject(obj.id));

    const invalid: ObjectPatch[] = [
      { capacity: 0 },
      { capacity: 31 },
      { capacity: 2.5 },
      { capacity: Number.NaN },
      { width: 0.1 },
      { x: Number.NaN },
      { y: Number.POSITIVE_INFINITY },
    ];

    for (const patch of invalid) {
      useEditorStore.getState().updateObject(obj.id, patch);
      useEditorStore.getState().commitObjectUpdate(obj.id, patch);
      expect(getObject(obj.id)).toEqual(original);
      expect(useEditorStore.getState().canUndo).toBe(false);
    }
  });

  it("round table ignores width/height; rect table ignores radius", () => {
    const round = createObject("table_round", { x: 5, y: 5 });
    const rect = createObject("table_rect", { x: 15, y: 5 });
    seed(round, rect);
    const roundBefore = structuredClone(getObject(round.id));
    const rectBefore = structuredClone(getObject(rect.id));

    useEditorStore.getState().commitObjectUpdate(round.id, { width: 9, height: 9 });
    useEditorStore.getState().commitObjectUpdate(rect.id, { radius: 5 });

    expect(getObject(round.id)).toEqual(roundBefore);
    expect(getObject(rect.id)).toEqual(rectBefore);
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it("normalizes rotation", () => {
    const obj = createObject("stage", { x: 20, y: 5 });
    seed(obj);
    useEditorStore.getState().commitObjectUpdate(obj.id, { rotation: 370 });
    expect(getObject(obj.id).rotation).toBe(10);
    useEditorStore.getState().commitObjectUpdate(obj.id, { rotation: -90 });
    expect(getObject(obj.id).rotation).toBe(270);
  });

  it("opening objects only take x, y, rotation and width", () => {
    const obj = createObject("entrance", { x: 0, y: 12 });
    seed(obj);
    useEditorStore
      .getState()
      .commitObjectUpdate(obj.id, { width: 4, height: 9, radius: 3 });
    const updated = getObject(obj.id);
    expect(updated).toEqual({ ...obj, width: 4 });
  });

  it("an unchanged commit pushes no history", () => {
    const obj = createObject("table_round", { x: 10, y: 10 });
    seed(obj);
    useEditorStore.getState().commitObjectUpdate(obj.id, { x: 10, y: 10 });
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it("a gesture that returns to its start pushes no history", () => {
    const obj = createObject("table_round", { x: 10, y: 10 });
    seed(obj);
    useEditorStore.getState().updateObject(obj.id, { x: 14 });
    useEditorStore.getState().commitObjectUpdate(obj.id, { x: 10 });
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it("loadLayout replaces state, clears history/selection and deep-copies", () => {
    const first = createObject("table_round", { x: 3, y: 3 });
    useEditorStore.getState().addObject(first);
    useEditorStore.getState().commitObjectUpdate(first.id, { x: 4 });
    expect(useEditorStore.getState().canUndo).toBe(true);

    const loadedObj = createObject("dance_floor", { x: 20, y: 12 });
    const layout: HallLayout = {
      schema_version: 1,
      hall: { id: "hall_loaded", name: "Loaded", width: 30, height: 20, unit: "m" },
      objects: [loadedObj],
    };
    const layoutJson = JSON.stringify(layout);

    useEditorStore.getState().loadLayout(layout);
    const state = useEditorStore.getState();
    expect(state.hall).toEqual(layout.hall);
    expect(state.objects).toEqual(layout.objects);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.selectedId).toBeNull();
    expect(state.tool).toBe("select");
    expect(state.objects[0]).not.toBe(layout.objects[0]);

    useEditorStore.getState().commitObjectUpdate(loadedObj.id, { x: 25 });
    useEditorStore.getState().commitHallUpdate({ width: 50 });
    expect(JSON.stringify(layout)).toBe(layoutJson);
  });

  it("getLayout returns only domain data", () => {
    const obj = createObject("table_round", { x: 5, y: 5 });
    useEditorStore.getState().addObject(obj);

    const layout = useEditorStore.getState().getLayout();
    expect(Object.keys(layout).sort()).toEqual(["hall", "objects", "schema_version"]);
    expect(layout.schema_version).toBe(1);
    expect(layout.objects.length).toBe(1);

    // returned data is a copy
    layout.objects.pop();
    expect(useEditorStore.getState().objects.length).toBe(1);
  });

  it("commitHallUpdate is one undo step", () => {
    useEditorStore.getState().commitHallUpdate({ width: 50 });
    expect(useEditorStore.getState().hall.width).toBe(50);
    expect(countUndoSteps()).toBe(1);
    expect(useEditorStore.getState().hall.width).toBe(40);
  });

  it("live setHall followed by commitHallUpdate is one undo step", () => {
    useEditorStore.getState().setHall({ width: 41 });
    useEditorStore.getState().setHall({ width: 43 });
    expect(useEditorStore.getState().canUndo).toBe(false);
    useEditorStore.getState().commitHallUpdate({ width: 45 });
    expect(countUndoSteps()).toBe(1);
    expect(useEditorStore.getState().hall.width).toBe(40);
  });

  it("rejects invalid hall patches", () => {
    useEditorStore.getState().commitHallUpdate({ width: 0 });
    useEditorStore.getState().commitHallUpdate({ height: Number.NaN });
    expect(useEditorStore.getState().hall).toEqual(makeHall());
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it("bumpLayoutVersion increments", () => {
    const before = useEditorStore.getState().layoutVersion;
    useEditorStore.getState().bumpLayoutVersion();
    expect(useEditorStore.getState().layoutVersion).toBe(before + 1);
  });

  it("toggleSnap and setGridSize update UI state", () => {
    useEditorStore.getState().toggleSnap();
    expect(useEditorStore.getState().snapEnabled).toBe(false);
    useEditorStore.getState().setGridSize(0.25);
    expect(useEditorStore.getState().gridSize).toBe(0.25);
  });
});