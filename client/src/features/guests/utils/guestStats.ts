import type { AgeBand, Gender, Guest, Side } from "../types/guestSchema";

export interface GuestStats {
  total: number;
  byHousehold: { household: string; count: number }[];
  bySide: Record<Side, number>;
  byGender: Record<Gender, number>;
  byAgeBand: Record<AgeBand, number>;
  vipCount: number;
  mobilityCount: number;
  dietaryCount: number;
  totalSeats: number;
  seatDelta: number;
  status: "no_tables" | "over_capacity" | "ok";
}

export function totalTableSeats(objects: ReadonlyArray<{ type: string; capacity?: number }>): number {
  let seats = 0;
  for (const o of objects) {
    if (o.type === "table" && typeof o.capacity === "number" && Number.isFinite(o.capacity)) seats += o.capacity;
  }
  return seats;
}

export function computeGuestStats(guests: Guest[], totalSeats: number): GuestStats {
  const bySide: Record<Side, number> = { bride: 0, groom: 0, other: 0 };
  const byGender: Record<Gender, number> = { male: 0, female: 0, unspecified: 0 };
  const byAgeBand: Record<AgeBand, number> = { infant: 0, child: 0, teen: 0, adult: 0, senior: 0 };
  const households = new Map<string, number>();
  let vipCount = 0;
  let mobilityCount = 0;
  let dietaryCount = 0;

  for (const g of guests) {
    bySide[g.side] += 1;
    byGender[g.gender] += 1;
    byAgeBand[g.age_band] += 1;
    if (g.household !== "") households.set(g.household, (households.get(g.household) ?? 0) + 1);
    if (g.vip !== "none") vipCount += 1;
    if (g.mobility !== "none") mobilityCount += 1;
    if (g.dietary !== "none") dietaryCount += 1;
  }

  const byHousehold = [...households.entries()]
    .map(([household, count]) => ({ household, count }))
    .sort((a, b) => b.count - a.count || a.household.localeCompare(b.household))
    .slice(0, 10);

  const total = guests.length;
  const status: GuestStats["status"] = totalSeats <= 0 ? "no_tables" : total > totalSeats ? "over_capacity" : "ok";

  return {
    total,
    byHousehold,
    bySide,
    byGender,
    byAgeBand,
    vipCount,
    mobilityCount,
    dietaryCount,
    totalSeats,
    seatDelta: totalSeats - total,
    status,
  };
}