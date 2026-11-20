import { create } from "zustand";
import type {
  CreationTool,
  Hall,
  HallLayout,
  HallObject,
  Viewport,
} from "../types/layout";
import { MAX_CAPACITY, MIN_CAPACITY, MIN_SIZE } from "../utils/defaults";
import {
  canRedoHistory,
  canUndoHistory,
  emptyHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "../utils/history";
import type { History, Snapshot } from "../utils/history";
import { normalizeRotation } from "../utils/snap";

export type Tool = "select" | CreationTool;
export type GridSize = 0.25 | 0.5 | 1;

// Only fields that apply to the target object's type are used; irrelevant fields are ignored.
export interface ObjectPatch {
  x?: number;
  y?: number;
  rotation?: number;
  width?: number;
  height?: number;
  radius?: number;
  capacity?: number;
}

type HallPatch = Partial<Omit<Hall, "id" | "unit">>;

interface EditorState {
  // domain
  hall: Hall;
  objects: HallObject[];
  layoutVersion: number;
  // UI (never persisted)
  viewport: Viewport;
  selectedId: string | null;
  tool: Tool;
  snapEnabled: boolean;
  gridSize: GridSize;
  canUndo: boolean;
  canRedo: boolean;

  setViewport(v: Viewport): void;
  setHall(patch: HallPatch): void;
  commitHallUpdate(patch: HallPatch): void;
  select(id: string | null): void;
  setTool(tool: Tool): void;
  toggleSnap(): void;
  setGridSize(size: GridSize): void;
  addObject(obj: HallObject): void;
  updateObject(id: string, patch: ObjectPatch): void;
  commitObjectUpdate(id: string, patch: ObjectPatch): void;
  removeObject(id: string): void;
  undo(): void;
  redo(): void;
  loadLayout(layout: HallLayout): void;
  getLayout(): HallLayout;
  bumpLayoutVersion(): void;
}

// Internal (not part of the store state, never part of getLayout).
let history: History = emptyHistory();
// State before the first live update of the gesture currently in progress.
let baseline: Snapshot | null = null;

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isValidSize(n: unknown): n is number {
  return isFiniteNumber(n) && n >= MIN_SIZE;
}

function isValidCapacity(n: unknown): n is number {
  return (
    isFiniteNumber(n) &&
    Number.isInteger(n) &&
    n >= MIN_CAPACITY &&
    n <= MAX_CAPACITY
  );
}

function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Returns the patched object, or null when the (applicable part of the) patch is invalid.
function applyPatch(obj: HallObject, patch: ObjectPatch): HallObject | null {
  const x = patch.x ?? obj.x;
  const y = patch.y ?? obj.y;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;

  let rotation = obj.rotation;
  if (patch.rotation !== undefined) {
    if (!isFiniteNumber(patch.rotation)) return null;
    rotation = normalizeRotation(patch.rotation);
  }

  switch (obj.type) {
    case "table": {
      const capacity = patch.capacity ?? obj.capacity;
      if (!isValidCapacity(capacity)) return null;
      switch (obj.shape) {
        case "round": {
          const radius = patch.radius ?? obj.radius;
          if (!isValidSize(radius)) return null;
          return { ...obj, x, y, rotation, radius, capacity };
        }
        case "rectangular":
        case "square": {
          const width = patch.width ?? obj.width;
          const height = patch.height ?? obj.height;
          if (!isValidSize(width) || !isValidSize(height)) return null;
          return { ...obj, x, y, rotation, width, height, capacity };
        }
        default:
          return assertNever(obj);
      }
    }
    case "entrance":
    case "exit": {
      const width = patch.width ?? obj.width;
      if (!isValidSize(width)) return null;
      return { ...obj, x, y, rotation, width };
    }
        case "sofa": {
      const capacity = patch.capacity ?? obj.capacity;
      if (!isValidCapacity(capacity)) return null;
      const width = patch.width ?? obj.width;
      const height = patch.height ?? obj.height;
      if (!isValidSize(width) || !isValidSize(height)) return null;
      return { ...obj, x, y, rotation, width, height, capacity };
    }
    case "stage":
    case "dance_floor":
    case "restricted_area":
    case "service_area": {
      const width = patch.width ?? obj.width;
      const height = patch.height ?? obj.height;
      if (!isValidSize(width) || !isValidSize(height)) return null;
      return { ...obj, x, y, rotation, width, height };
    }
    default:
      return assertNever(obj);
  }
}

function applyHallPatch(hall: Hall, patch: HallPatch): Hall | null {
  const name = patch.name ?? hall.name;
  const width = patch.width ?? hall.width;
  const height = patch.height ?? hall.height;
  if (typeof name !== "string") return null;
  if (!isValidSize(width) || !isValidSize(height)) return null;
  return { ...hall, name, width, height };
}

function historyFlags(): { canUndo: boolean; canRedo: boolean } {
  return { canUndo: canUndoHistory(history), canRedo: canRedoHistory(history) };
}

function createDefaultHall(): Hall {
  return {
    id: crypto.randomUUID(),
    name: "Main Wedding Hall",
    width: 40,
    height: 25,
    unit: "m",
  };
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  hall: createDefaultHall(),
  objects: [],
  layoutVersion: 0,

  viewport: { scale: 20, offsetX: 0, offsetY: 0 },
  selectedId: null,
  tool: "select",
  snapEnabled: true,
  gridSize: 0.5,
  canUndo: false,
  canRedo: false,

  setViewport: (viewport) => set({ viewport }),

  setHall: (patch) => {
    const { hall, objects } = get();
    const next = applyHallPatch(hall, patch);
    if (next === null || sameValue(hall, next)) return;
    if (baseline === null) baseline = { hall, objects };
    set({ hall: next });
  },

  commitHallUpdate: (patch) => {
    const { hall, objects } = get();
    const next = applyHallPatch(hall, patch);
    if (next === null) return;
    const before: Snapshot = baseline ?? { hall, objects };
    baseline = null;
    const after: Snapshot = { hall: next, objects };
    if (!sameValue(hall, next)) set({ hall: next });
    if (snapshotsEqual(before, after)) return;
    history = pushHistory(history, before);
    set(historyFlags());
  },

  select: (id) => set({ selectedId: id }),

  setTool: (tool) => set({ tool }),

  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  setGridSize: (gridSize) => set({ gridSize }),

  addObject: (obj) => {
    const { hall, objects } = get();
    if (objects.some((o) => o.id === obj.id)) return;
    history = pushHistory(history, { hall, objects });
    baseline = null;
    set({
      objects: [...objects, obj],
      selectedId: obj.id,
      tool: "select",
      ...historyFlags(),
    });
  },

  updateObject: (id, patch) => {
    const { hall, objects } = get();
    const index = objects.findIndex((o) => o.id === id);
    const current = objects[index];
    if (current === undefined) return;
    const next = applyPatch(current, patch);
    if (next === null || sameValue(current, next)) return;
    if (baseline === null) baseline = { hall, objects };
    set({ objects: objects.map((o, i) => (i === index ? next : o)) });
  },

  commitObjectUpdate: (id, patch) => {
    const { hall, objects } = get();
    const index = objects.findIndex((o) => o.id === id);
    const current = objects[index];
    if (current === undefined) return;
    const next = applyPatch(current, patch);
    if (next === null) return;
    const before: Snapshot = baseline ?? { hall, objects };
    baseline = null;
    const nextObjects = sameValue(current, next)
      ? objects
      : objects.map((o, i) => (i === index ? next : o));
    if (nextObjects !== objects) set({ objects: nextObjects });
    if (snapshotsEqual(before, { hall, objects: nextObjects })) return;
    history = pushHistory(history, before);
    set(historyFlags());
  },

  removeObject: (id) => {
    const { hall, objects, selectedId } = get();
    if (!objects.some((o) => o.id === id)) return;
    history = pushHistory(history, { hall, objects });
    baseline = null;
    set({
      objects: objects.filter((o) => o.id !== id),
      selectedId: selectedId === id ? null : selectedId,
      ...historyFlags(),
    });
  },

  undo: () => {
    const { hall, objects, selectedId } = get();
    const result = undoHistory(history, { hall, objects });
    if (result === null) return;
    history = result.history;
    baseline = null;
    const restored = result.snapshot;
    const stillExists =
      selectedId !== null && restored.objects.some((o) => o.id === selectedId);
    set({
      hall: restored.hall,
      objects: restored.objects,
      selectedId: stillExists ? selectedId : null,
      ...historyFlags(),
    });
  },

  redo: () => {
    const { hall, objects, selectedId } = get();
    const result = redoHistory(history, { hall, objects });
    if (result === null) return;
    history = result.history;
    baseline = null;
    const restored = result.snapshot;
    const stillExists =
      selectedId !== null && restored.objects.some((o) => o.id === selectedId);
    set({
      hall: restored.hall,
      objects: restored.objects,
      selectedId: stillExists ? selectedId : null,
      ...historyFlags(),
    });
  },

  loadLayout: (layout) => {
    const copy = structuredClone({ hall: layout.hall, objects: layout.objects });
    history = emptyHistory();
    baseline = null;
    set({
      hall: copy.hall,
      objects: copy.objects,
      selectedId: null,
      tool: "select",
      ...historyFlags(),
    });
  },

  getLayout: () => {
    const { hall, objects } = get();
    return {
      schema_version: 1,
      hall: structuredClone(hall),
      objects: structuredClone(objects),
    };
  },

  bumpLayoutVersion: () => set((s) => ({ layoutVersion: s.layoutVersion + 1 })),
}));