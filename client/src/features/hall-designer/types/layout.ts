export type HallObjectType =
  | "wall" | "table" | "entrance" | "exit"
  | "stage" | "dance_floor" | "restricted_area" | "service_area";

export interface Hall {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: "m";
}

interface BaseObject {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

export interface RoundTableObject extends BaseObject {
  type: "table";
  shape: "round";
  radius: number;
  capacity: number;
}

export interface RectTableObject extends BaseObject {
  type: "table";
  shape: "rectangular" | "square";
  width: number;
  height: number;
  capacity: number;
}

export type TableObject = RoundTableObject | RectTableObject;

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

export interface HallLayout {
  schema_version: 1;
  hall: Hall;
  objects: HallObject[];
}

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export type CreationTool =
  | "table_round" | "table_rect" | "table_square"
  | "stage" | "dance_floor" | "restricted_area" | "service_area"
  | "entrance" | "exit";