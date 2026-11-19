import { create } from "zustand";
import { DEFAULT_EVENT, eventSchema } from "../types/eventSchema";
import type { EventInfo } from "../types/eventSchema";

interface EventState {
  event: EventInfo;
  setEvent: (event: EventInfo) => void;
  resetEvent: () => void;
}

export const useEventStore = create<EventState>()((set) => ({
  event: { ...DEFAULT_EVENT },
  setEvent: (event) => {
    const parsed = eventSchema.safeParse(event);
    if (!parsed.success) return; // invalid input is a no-op
    set({ event: parsed.data }); // parsed.data is a fresh copy
  },
  resetEvent: () => set({ event: { ...DEFAULT_EVENT } }),
}));