import { create } from "zustand";
import type { Hall, HallObject, Viewport } from "../types/layout";

interface EditorState {
  // domain (persisted)
  hall: Hall;
  objects: HallObject[];
  layoutVersion: number;
  // transient UI (never persisted)
  viewport: Viewport;
  selectedId: string | null;
  tool: "select" | "table" | "stage" | "entrance" | "exit" | "restricted_area";

  setViewport: (v: Viewport) => void;
  setHall: (h: Partial<Hall>) => void;
  select: (id: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  hall: { id: crypto.randomUUID(), name: "Main Wedding Hall", width: 40, height: 25, unit: "m" },
  objects: [],
  layoutVersion: 1,
  viewport: { scale: 20, offsetX: 0, offsetY: 0 },
  selectedId: null,
  tool: "select",

  setViewport: (viewport) => set({ viewport }),
  setHall: (h) => set((s) => ({ hall: { ...s.hall, ...h } })),
  select: (selectedId) => set({ selectedId }),
}));