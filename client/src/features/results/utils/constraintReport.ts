import { RULE_KINDS, RULE_STRENGTHS, ZONES, zoneForTable } from "../../constraints/types/constraintSchema";
import type { Rule, Settings, Zone } from "../../constraints/types/constraintSchema";
import { AGE_BANDS, VIP_LEVELS, MOBILITY_LEVELS, optionLabel } from "../../guests/types/guestSchema";
import type { Guest } from "../../guests/types/guestSchema";
import type { BrokenConstraint } from "../types/seatingResult";
import type { SeatingModel, SeatObject } from "./seatingModel";

export interface ConstraintContext {
  settings: Settings;
  zones: Readonly<Record<string, Zone>>;
  rules: readonly Rule[];
  broken: readonly BrokenConstraint[];
  model: SeatingModel;
}

export type CheckStatus = "satisfied" | "broken" | "info";

export interface CheckItem {
  id: string;
  title: string;
  status: CheckStatus;
  severity: "hard" | "soft" | null;
  detail: string;
}

export function cleanMessage(message: string): string {
  return message.replace(/^Broken (?:constraint|soft preference):\s*/, "");
}

function findBroken(
  ctx: ConstraintContext,
  code: string,
  guestId: string,
  ruleId?: string,
): BrokenConstraint | undefined {
  return ctx.broken.find(
    (b) => b.code === code && (ruleId !== undefined ? b.rule_id === ruleId : b.guest_ids.includes(guestId)),
  );
}

export function zoneLabel(ctx: ConstraintContext, seatObject: SeatObject): string {
  return optionLabel(ZONES, zoneForTable(ctx.zones, seatObject.object.id));
}

export function objectBroken(ctx: ConstraintContext, seatObject: SeatObject): BrokenConstraint[] {
  return ctx.broken.filter((b) => b.seat_ids.includes(seatObject.object.id));
}

export interface Composition {
  bride: number;
  groom: number;
  other: number;
  ageBands: string[];
}

export function composition(seatObject: SeatObject): Composition {
  const out: Composition = { bride: 0, groom: 0, other: 0, ageBands: [] };
  const bands = new Map<string, number>();
  for (const slot of seatObject.slots) {
    const g = slot.guest;
    if (!g) continue;
    out[g.side] += 1;
    bands.set(g.age_band, (bands.get(g.age_band) ?? 0) + 1);
  }
  out.ageBands = [...bands.entries()].map(([band, n]) => {
    const label = AGE_BANDS.find((o) => o.value === band)?.label ?? band;
    return `${label} ×${n}`;
  });
  return out;
}

export function guestChecks(ctx: ConstraintContext, guest: Guest, seatObject: SeatObject): CheckItem[] {
  const { settings, model } = ctx;
  const items: CheckItem[] = [];
  const nameOf = (id: string) => model.guestById.get(id)?.name ?? id;
  const whereOf = (id: string) => model.placementByGuest.get(id)?.seatObject.label ?? "unseated";

  const check = (
    id: string,
    title: string,
    severity: "hard" | "soft",
    broken: BrokenConstraint | undefined,
    okDetail: string,
  ) => {
    items.push({
      id,
      title,
      severity,
      status: broken ? "broken" : "satisfied",
      detail: broken ? cleanMessage(broken.message) : okDetail,
    });
  };
  const info = (id: string, title: string, detail: string) => {
    items.push({ id, title, severity: null, status: "info", detail });
  };

  // Households together
  const household = guest.household.trim();
  if (settings.households_together && household) {
    const members = [...model.guestById.values()].filter((g) => g.household.trim() === household);
    if (members.length >= 2) {
      check(
        "household",
        `Household '${household}' together`,
        "hard",
        findBroken(ctx, "households_together", guest.id),
        `${members.length} members seated at ${seatObject.label}`,
      );
    }
  }

  // Gender zones
  if (settings.enforce_gender_zones) {
    check(
      "zones",
      "Gender zones",
      "hard",
      findBroken(ctx, "enforce_gender_zones", guest.id),
      `${zoneLabel(ctx, seatObject)} zone accepts ${guest.gender} guests`,
    );
  }

  // Sofas for seniors only
  if (settings.sofas_for_seniors_only && seatObject.kind === "sofa") {
    check(
      "sofa",
      "Sofas for seniors only",
      "hard",
      findBroken(ctx, "sofas_for_seniors_only", guest.id),
      "Senior guest on a sofa",
    );
  }

  // Custom rules involving this guest
  for (const rule of ctx.rules) {
    if (!rule.guest_ids.includes(guest.id)) continue;
    const others = rule.guest_ids
      .filter((id) => id !== guest.id)
      .map((id) => `${nameOf(id)} (${whereOf(id)})`)
      .join(", ");
    const kind = optionLabel(RULE_KINDS, rule.kind);
    const strength = optionLabel(RULE_STRENGTHS, rule.strength);
    check(
      `rule_${rule.id}`,
      `${kind} · ${strength}${rule.note ? ` — ${rule.note}` : ""}`,
      rule.strength === "must" ? "hard" : "soft",
      findBroken(ctx, `${rule.strength}_${rule.kind}`, guest.id, rule.id),
      `${rule.kind === "together" ? "Together with" : "Apart from"} ${others || "—"}`,
    );
  }

  // Proximity preferences
  if (settings.vip_near_stage && guest.vip !== "none") {
    const title = `${optionLabel(VIP_LEVELS, guest.vip)} near stage`;
    if (!model.hasStage) info("vip", title, "Skipped: the hall has no stage");
    else {
      check("vip", title, "soft", findBroken(ctx, "vip_near_stage", guest.id), `Within ${settings.vip_max_distance_m} m of the stage`);
    }
  }
  if (settings.accessible_near_entrance && guest.mobility !== "none") {
    const title = `Accessible (${optionLabel(MOBILITY_LEVELS, guest.mobility)}) near entrance`;
    if (!model.hasOpening) info("access", title, "Skipped: the hall has no entrance or exit");
    else {
      check(
        "access",
        title,
        "soft",
        findBroken(ctx, "accessible_near_entrance", guest.id),
        `Within ${settings.accessible_max_distance_m} m of an entrance`,
      );
    }
  }

  // Weighted preferences (no pass/fail limit)
  if (guest.age_band === "senior") {
    if (settings.weights.elders_near_exits > 0) {
      info("elders_exits", "Elders near exits", `Weighted preference (weight ${settings.weights.elders_near_exits}/10)`);
    }
    if (settings.weights.seniors_near_stage > 0) {
      info("seniors_stage", "Seniors near stage", `Weighted preference (weight ${settings.weights.seniors_near_stage}/10)`);
    }
  }

  // Enabled in settings but not modelled by the current solver
  if (guest.age_band === "infant" || guest.age_band === "child") {
    if (settings.children_with_guardian) {
      info("guardian", "Children with guardian", "Enabled in settings, but not enforced by the current solver");
    }
    if (settings.kids_table) {
      info("kids_table", "Kids table", "Enabled in settings, but not enforced by the current solver");
    }
  }

  return items;
}