import { create } from "zustand";
import {
  MAX_GUESTS,
  assignGuestIds,
  createUniqueGuestId,
  guestListSchema,
  importedGuestSchema,
  newGuestSchema,
} from "../types/guestSchema";
import type { Guest, ImportedGuest, NewGuest } from "../types/guestSchema";

type ImportMode = "append" | "replace";

interface GuestState {
  guests: Guest[];
  addGuest: (g: NewGuest) => boolean;
  updateGuest: (id: string, patch: Partial<NewGuest>) => boolean;
  updateGuests: (ids: string[], patch: Partial<NewGuest>) => number;
  removeGuest: (id: string) => void;
  removeGuests: (ids: string[]) => number;
  importGuests: (items: ImportedGuest[], mode: ImportMode) => { added: number; reassignedIds: number } | null;
  replaceGuests: (guests: Guest[]) => boolean;
  clearGuests: () => void;
}

// Validates the merged result, so an invalid patch (or one with explicit undefined) is a no-op.
function applyPatch(guest: Guest, patch: Partial<NewGuest>): Guest | null {
  const { id, ...rest } = guest;
  const result = newGuestSchema.safeParse({ ...rest, ...patch });
  return result.success ? { ...result.data, id } : null;
}

export const useGuestStore = create<GuestState>()((set, get) => ({
  guests: [],

  addGuest: (g) => {
    const parsed = newGuestSchema.safeParse(g);
    if (!parsed.success) return false;
    const current = get().guests;
    if (current.length >= MAX_GUESTS) return false;
    const id = createUniqueGuestId(new Set(current.map((x) => x.id)));
    set({ guests: [...current, { ...parsed.data, id }] });
    return true;
  },

  updateGuest: (id, patch) => {
    const current = get().guests;
    const target = current.find((g) => g.id === id);
    if (!target) return false;
    const updated = applyPatch(target, patch);
    if (!updated) return false;
    set({ guests: current.map((g) => (g.id === id ? updated : g)) });
    return true;
  },

  updateGuests: (ids, patch) => {
    const idSet = new Set(ids);
    let changed = 0;
    const next = get().guests.map((g) => {
      if (!idSet.has(g.id)) return g;
      const updated = applyPatch(g, patch);
      if (!updated) return g;
      changed += 1;
      return updated;
    });
    if (changed > 0) set({ guests: next });
    return changed;
  },

  removeGuest: (id) => {
    set({ guests: get().guests.filter((g) => g.id !== id) });
  },

  removeGuests: (ids) => {
    const idSet = new Set(ids);
    const current = get().guests;
    const next = current.filter((g) => !idSet.has(g.id));
    const removed = current.length - next.length;
    if (removed > 0) set({ guests: next });
    return removed;
  },

  importGuests: (items, mode) => {
    const valid: ImportedGuest[] = [];
    for (const item of items) {
      const parsed = importedGuestSchema.safeParse(item);
      if (!parsed.success) return null;
      valid.push(parsed.data);
    }
    const base = mode === "replace" ? [] : get().guests;
    if (base.length + valid.length > MAX_GUESTS) return null;
    const { guests: added, reassigned } = assignGuestIds(valid, new Set(base.map((g) => g.id)));
    set({ guests: [...base, ...added] });
    return { added: added.length, reassignedIds: reassigned };
  },

  replaceGuests: (guests) => {
    const parsed = guestListSchema.safeParse(guests);
    if (!parsed.success) return false;
    set({ guests: parsed.data });
    return true;
  },

  clearGuests: () => set({ guests: [] }),
}));