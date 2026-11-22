import type { Guest } from "../../guests/types/guestSchema";
import type { HallObject, SofaObject, TableObject } from "../../hall-designer/types/layout";
import type { SeatingResult } from "../types/seatingResult";

export type SeatingObject = TableObject | SofaObject;

export interface SeatSlot {
  index: number; // 0-based, as returned by the solver
  x: number; // local coordinates (metres), relative to the object's centre, before rotation
  y: number;
  radius: number;
  guest: Guest | null;
}

export interface SeatObject {
  object: SeatingObject;
  label: string; // T1, T2, S1...
  kind: "table" | "sofa";
  capacity: number;
  slots: SeatSlot[];
}

export interface Placement {
  seatObject: SeatObject;
  slot: SeatSlot;
}

export interface SeatingModel {
  seatObjects: SeatObject[];
  byId: Map<string, SeatObject>;
  guestById: Map<string, Guest>;
  placementByGuest: Map<string, Placement>;
  unassignedGuests: Guest[];
  hasStage: boolean;
  hasOpening: boolean;
  anomalies: string[];
}

const CHAIR_GAP = 0.45;
const MAX_SEAT_RADIUS = 0.28;

export function isSeatingObject(o: HallObject): o is SeatingObject {
  return o.type === "table" || o.type === "sofa";
}

interface SlotGeometry {
  x: number;
  y: number;
  radius: number;
}

function slotGeometry(object: SeatingObject): SlotGeometry[] {
  const n = object.capacity;
  const out: SlotGeometry[] = [];
  if (n <= 0) return out;

  if (object.type === "sofa") {
    const cushionW = object.width / n;
    const radius = Math.max(0.08, Math.min(0.25, cushionW / 2.5, object.height * 0.3));
    const y = object.height * 0.15; // below the backrest strip
    for (let i = 0; i < n; i++) out.push({ x: -object.width / 2 + (i + 0.5) * cushionW, y, radius });
    return out;
  }

  if (object.shape === "round") {
    const ring = object.radius + CHAIR_GAP;
    const radius = Math.max(0.08, Math.min(MAX_SEAT_RADIUS, (2 * Math.PI * ring) / n / 2.4));
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n - Math.PI / 2;
      out.push({ x: Math.cos(a) * ring, y: Math.sin(a) * ring, radius });
    }
    return out;
  }

  const { width: w, height: h } = object;
  const perimeter = 2 * (w + h);
  const radius = Math.max(0.08, Math.min(MAX_SEAT_RADIUS, perimeter / n / 2.4));
  for (let i = 0; i < n; i++) {
    let d = ((i + 0.5) * perimeter) / n;
    if (d < w) {
      out.push({ x: -w / 2 + d, y: -h / 2 - CHAIR_GAP, radius });
    } else if ((d -= w) < h) {
      out.push({ x: w / 2 + CHAIR_GAP, y: -h / 2 + d, radius });
    } else if ((d -= h) < w) {
      out.push({ x: w / 2 - d, y: h / 2 + CHAIR_GAP, radius });
    } else {
      d -= w;
      out.push({ x: -w / 2 - CHAIR_GAP, y: h / 2 - d, radius });
    }
  }
  return out;
}

export function buildSeatingModel(
  objects: readonly HallObject[],
  guests: readonly Guest[],
  result: SeatingResult | null,
): SeatingModel {
  const seatObjects: SeatObject[] = [];
  const byId = new Map<string, SeatObject>();
  let tableNo = 0;
  let sofaNo = 0;
  let hasStage = false;
  let hasOpening = false;

  for (const o of objects) {
    if (o.type === "stage") hasStage = true;
    else if (o.type === "entrance" || o.type === "exit") hasOpening = true;
    if (!isSeatingObject(o)) continue;
    const kind = o.type === "sofa" ? "sofa" : "table";
    const label = kind === "table" ? `T${++tableNo}` : `S${++sofaNo}`;
    const slots: SeatSlot[] = slotGeometry(o).map((g, index) => ({ index, ...g, guest: null }));
    const seatObject: SeatObject = { object: o, label, kind, capacity: o.capacity, slots };
    seatObjects.push(seatObject);
    byId.set(o.id, seatObject);
  }

  const guestById = new Map<string, Guest>(guests.map((g) => [g.id, g]));
  const placementByGuest = new Map<string, Placement>();
  const anomalies: string[] = [];

  if (result) {
    for (const a of result.assignments) {
      const seatObject = byId.get(a.table_id);
      const guest = guestById.get(a.guest_id);
      if (!seatObject || !guest) {
        anomalies.push(
          `Assignment of ${a.guest_id} to ${a.table_id} refers to a ${!guest ? "guest" : "table or sofa"} that no longer exists.`,
        );
        continue;
      }
      if (placementByGuest.has(guest.id)) {
        anomalies.push(`Guest '${guest.name}' appears in more than one assignment; the first one was kept.`);
        continue;
      }
      const preferred = seatObject.slots[a.seat_index];
      const slot =
        preferred && preferred.guest === null
          ? preferred
          : seatObject.slots.find((s) => s.guest === null);
      if (!slot) {
        anomalies.push(`${seatObject.label} has no free seat for '${guest.name}'.`);
        continue;
      }
      slot.guest = guest;
      placementByGuest.set(guest.id, { seatObject, slot });
    }
  }

  const unassignedGuests = guests.filter((g) => !placementByGuest.has(g.id));
  return { seatObjects, byId, guestById, placementByGuest, unassignedGuests, hasStage, hasOpening, anomalies };
}