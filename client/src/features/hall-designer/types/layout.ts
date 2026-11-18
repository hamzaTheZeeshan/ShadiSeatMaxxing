export type HallObjectType =
  | "wall" | "table" | "entrance" | "exit"
  | "stage" | "dance_floor" | "restricted_area" | "service_area";

export interface Hall {
  id: string;
  name: string;
  width: number;   // metres
  height: number;  // metres
  unit: "m";
}

interface BaseObject {
  id: string;
  x: number;       // metres, top-left origin, y down
  y: number;
  rotation: number;
}

export interface TableObject extends BaseObject {
  type: "table";
  shape: "round" | "square" | "rectangular";
  radius?: number;
  width?: number;
  height?: number;
  capacity: number;
}

export interface RectObject extends BaseObject {
  type: "stage" | "dance_floor" | "restricted_area" | "service_area";
  width: number;
  height: number;
}

export interface OpeningObject extends BaseObject {
  type: "entrance" | "exit";
  width: number;
}

export type HallObject = TableObject | RectObject | OpeningObject;
// walls get added in Step 2/3

export interface HallLayout {
  schema_version: 1;
  hall: Hall;
  objects: HallObject[];
}

export interface Viewport {
  scale: number;    // pixels per metre
  offsetX: number;  // pixels
  offsetY: number;
}