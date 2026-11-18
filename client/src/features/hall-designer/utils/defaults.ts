import type {
  CreationTool,
  HallObject,
  HallObjectType,
} from "../types/layout";
import type { Point } from "./coords";

export const MIN_SIZE = 0.3;
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 30;
export const OPENING_THICKNESS = 0.3;

// crypto.randomUUID only exists in secure contexts (HTTPS / localhost);
// getRandomValues also works over plain HTTP (e.g. LAN dev server).
function randomHex8(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createId(type: HallObjectType): string {
  return `${type}_${randomHex8()}`;
}

export function createObject(tool: CreationTool, center: Point): HallObject {
  const base = (type: HallObjectType) => ({
    id: createId(type),
    x: center.x,
    y: center.y,
    rotation: 0,
  });

  switch (tool) {
    case "table_round":
      return {
        ...base("table"),
        type: "table",
        shape: "round",
        radius: 1.2,
        capacity: 8,
      };
    case "table_rect":
      return {
        ...base("table"),
        type: "table",
        shape: "rectangular",
        width: 2.4,
        height: 1.2,
        capacity: 8,
      };
    case "table_square":
      return {
        ...base("table"),
        type: "table",
        shape: "square",
        width: 1.5,
        height: 1.5,
        capacity: 4,
      };
    case "stage":
      return { ...base("stage"), type: "stage", width: 12, height: 4 };
    case "dance_floor":
      return {
        ...base("dance_floor"),
        type: "dance_floor",
        width: 6,
        height: 6,
      };
    case "restricted_area":
      return {
        ...base("restricted_area"),
        type: "restricted_area",
        width: 4,
        height: 4,
      };
    case "service_area":
      return {
        ...base("service_area"),
        type: "service_area",
        width: 4,
        height: 3,
      };
    case "entrance":
      return { ...base("entrance"), type: "entrance", width: 3 };
    case "exit":
      return { ...base("exit"), type: "exit", width: 3 };
    default: {
      const unreachable: never = tool;
      throw new Error(`Unhandled creation tool: ${String(unreachable)}`);
    }
  }
}