import { z } from "zod";
import type { Hall, HallLayout, HallObject, RectObject } from "./layout";

// Note: nested discriminated unions (type -> shape) require zod 4.
// Intentionally does NOT import utils/defaults.ts (avoids import cycles).

const isFiniteNumber = (n: number): boolean => Number.isFinite(n);
const FINITE_MESSAGE = "Must be a finite number";

const coordinate = z.number().refine(isFiniteNumber, FINITE_MESSAGE);
const dimension = z.number().positive().refine(isFiniteNumber, FINITE_MESSAGE);
const capacity = z.number().int().min(1).max(30);
const id = z.string().min(1);

const baseShape = {
  id,
  x: coordinate,
  y: coordinate,
  rotation: coordinate,
};

export const hallSchema: z.ZodType<Hall> = z.object({
  id,
  name: z.string(),
  width: dimension,
  height: dimension,
  unit: z.literal("m"),
});

const roundTableSchema = z.object({
  ...baseShape,
  type: z.literal("table"),
  shape: z.literal("round"),
  radius: dimension,
  capacity,
});

const rectTableSchema = z.object({
  ...baseShape,
  type: z.literal("table"),
  shape: z.enum(["rectangular", "square"]),
  width: dimension,
  height: dimension,
  capacity,
});

const tableSchema = z.discriminatedUnion("shape", [
  roundTableSchema,
  rectTableSchema,
]);

const rectObjectSchema = <T extends RectObject["type"]>(type: T) =>
  z.object({
    ...baseShape,
    type: z.literal(type),
    width: dimension,
    height: dimension,
  });

const openingObjectSchema = <T extends "entrance" | "exit">(type: T) =>
  z.object({
    ...baseShape,
    type: z.literal(type),
    width: dimension,
  });

export const hallObjectSchema: z.ZodType<HallObject> = z.discriminatedUnion(
  "type",
  [
    tableSchema,
    rectObjectSchema("stage"),
    rectObjectSchema("dance_floor"),
    rectObjectSchema("restricted_area"),
    rectObjectSchema("service_area"),
    openingObjectSchema("entrance"),
    openingObjectSchema("exit"),
  ],
);

export const hallLayoutSchema: z.ZodType<HallLayout> = z.object({
  schema_version: z.literal(1),
  hall: hallSchema,
  objects: z.array(hallObjectSchema),
});