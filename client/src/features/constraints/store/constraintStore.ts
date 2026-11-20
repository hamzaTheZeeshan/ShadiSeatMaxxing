import { create } from "zustand";
import {
  DEFAULT_SETTINGS,
  DEFAULT_ZONE,
  MAX_RULES,
  constraintDataSchema,
  createUniqueRuleId,
  newRuleSchema,
  settingsSchema,
  zoneSchema,
} from "../types/constraintSchema";
import type { ConstraintData, NewRule, Rule, Settings, Zone } from "../types/constraintSchema";

interface ConstraintState {
  settings: Settings;
  zones: Record<string, Zone>;
  rules: Rule[];
  setSettings(patch: Partial<Settings>): boolean;
  setZone(tableId: string, zone: Zone): void;
  setZones(tableIds: string[], zone: Zone): void;
  pruneZones(validTableIds: string[]): void;
  addRule(rule: NewRule): boolean;
  updateRule(id: string, patch: Partial<NewRule>): boolean;
  removeRule(id: string): void;
  removeRulesForGuests(guestIds: string[]): number;
  importRules(rules: NewRule[]): { added: number } | null;
  replaceAll(data: ConstraintData): boolean;
  clearRules(): void;
}

function applyZone(zones: Record<string, Zone>, tableId: string, zone: Zone): void {
  if (zone === DEFAULT_ZONE) delete zones[tableId];
  else zones[tableId] = zone;
}

export const useConstraintStore = create<ConstraintState>()((set, get) => ({
  settings: structuredClone(DEFAULT_SETTINGS),
  zones: {},
  rules: [],

  setSettings: (patch) => {
    const parsed = settingsSchema.safeParse({ ...get().settings, ...patch });
    if (!parsed.success) return false;
    set({ settings: parsed.data });
    return true;
  },

  setZone: (tableId, zone) => {
    const parsedZone = zoneSchema.safeParse(zone);
    if (!parsedZone.success || typeof tableId !== "string" || tableId === "") return;
    const next = { ...get().zones };
    applyZone(next, tableId, parsedZone.data);
    set({ zones: next });
  },

  setZones: (tableIds, zone) => {
    const parsedZone = zoneSchema.safeParse(zone);
    if (!parsedZone.success) return;
    const ids = tableIds.filter((id) => typeof id === "string" && id !== "");
    if (ids.length === 0) return;
    const next = { ...get().zones };
    for (const id of ids) applyZone(next, id, parsedZone.data);
    set({ zones: next });
  },

  pruneZones: (validTableIds) => {
    const valid = new Set(validTableIds);
    const current = get().zones;
    const keys = Object.keys(current);
    const kept = keys.filter((key) => valid.has(key));
    if (kept.length === keys.length) return;
    const next: Record<string, Zone> = {};
    for (const key of kept) {
      const zone = current[key];
      if (zone !== undefined) next[key] = zone;
    }
    set({ zones: next });
  },

  addRule: (rule) => {
    const parsed = newRuleSchema.safeParse(rule);
    if (!parsed.success) return false;
    const current = get().rules;
    if (current.length >= MAX_RULES) return false;
    const id = createUniqueRuleId(new Set(current.map((r) => r.id)));
    set({ rules: [...current, { ...parsed.data, id }] });
    return true;
  },

  updateRule: (id, patch) => {
    const current = get().rules;
    const target = current.find((r) => r.id === id);
    if (!target) return false;
    const base: NewRule = {
      kind: target.kind,
      strength: target.strength,
      weight: target.weight,
      guest_ids: target.guest_ids,
      note: target.note,
    };
    const parsed = newRuleSchema.safeParse({ ...base, ...patch });
    if (!parsed.success) return false;
    set({ rules: current.map((r) => (r.id === id ? { ...parsed.data, id } : r)) });
    return true;
  },

  removeRule: (id) => {
    const current = get().rules;
    const next = current.filter((r) => r.id !== id);
    if (next.length !== current.length) set({ rules: next });
  },

  removeRulesForGuests: (guestIds) => {
    const idSet = new Set(guestIds);
    const current = get().rules;
    const next = current.filter((r) => !r.guest_ids.some((gid) => idSet.has(gid)));
    const removed = current.length - next.length;
    if (removed > 0) set({ rules: next });
    return removed;
  },

  importRules: (incoming) => {
    const valid: NewRule[] = [];
    for (const item of incoming) {
      const parsed = newRuleSchema.safeParse(item);
      if (!parsed.success) return null;
      valid.push(parsed.data);
    }
    const current = get().rules;
    if (current.length + valid.length > MAX_RULES) return null;
    const taken = new Set(current.map((r) => r.id));
    const added: Rule[] = [];
    for (const rule of valid) {
      const id = createUniqueRuleId(taken);
      taken.add(id);
      added.push({ ...rule, id });
    }
    set({ rules: [...current, ...added] });
    return { added: added.length };
  },

  replaceAll: (data) => {
    const parsed = constraintDataSchema.safeParse(data);
    if (!parsed.success) return false;
    set({ settings: parsed.data.settings, zones: parsed.data.zones, rules: parsed.data.rules });
    return true;
  },

  clearRules: () => set({ rules: [] }),
}));