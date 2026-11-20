import { create } from "zustand";
import { ApiError, DEFAULT_SOLVE_OPTIONS, solveSeating } from "../../../api/solveSeating";
import type { SolveOptions, SolveRequest, SolveResponse } from "../../../api/solveSeating";
import { useConstraintStore } from "../../constraints/store/constraintStore";
import { useGuestStore } from "../../guests/store/guestStore";
import { useEditorStore } from "../../hall-designer/store/editorStore";

type Status = "idle" | "solving" | "success" | "error";

interface SeatingState {
  status: Status;
  result: SolveResponse | null;
  error: string | null;
  errorDetails: string[];
  solve(options?: Partial<SolveOptions>): Promise<void>;
  cancel(): void;
  reset(): void;
}

let controller: AbortController | null = null;

export function buildSolveRequest(options: SolveOptions): SolveRequest {
  const { hall, objects } = useEditorStore.getState().getLayout();
  const { settings, zones, rules } = useConstraintStore.getState();
  const guests = useGuestStore.getState().guests;
  return {
    // Backend HallSerializer only reads width/height; send just those.
    layout: { hall: { width: hall.width, height: hall.height }, objects },
    guests,
    constraints: { version: 1, settings, zones, rules },
    options,
  };
}

export const useSeatingStore = create<SeatingState>()((set) => ({
  status: "idle",
  result: null,
  error: null,
  errorDetails: [],

  solve: async (opts) => {
    controller?.abort();
    const mine = new AbortController();
    controller = mine;
    const options = { ...DEFAULT_SOLVE_OPTIONS, ...opts };
    set({ status: "solving", error: null, errorDetails: [] });

    // Safety net: solver time limit plus headroom for validation/serialization.
    const timeout = setTimeout(() => mine.abort(), (options.time_limit_seconds + 30) * 1000);
    try {
      const result = await solveSeating(buildSolveRequest(options), mine.signal);
      if (controller !== mine) return;
      set({ status: "success", result });
    } catch (err) {
      if (controller !== mine) return; // superseded or cancelled
      if (err instanceof DOMException && err.name === "AbortError") {
        set({ status: "error", error: "The request timed out.", errorDetails: [] });
      } else if (err instanceof ApiError) {
        set({ status: "error", error: err.message, errorDetails: err.details });
      } else {
        set({ status: "error", error: "Unexpected error while solving.", errorDetails: [] });
      }
    } finally {
      clearTimeout(timeout);
      if (controller === mine) controller = null;
    }
  },

  cancel: () => {
    controller?.abort();
    controller = null;
    set({ status: "idle" });
  },

  reset: () => set({ status: "idle", result: null, error: null, errorDetails: [] }),
}));