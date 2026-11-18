import { memo, useEffect, useRef } from "react";
import { Circle, Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { HallObject } from "../../types/layout";
import { useEditorStore } from "../../store/editorStore";
import type { Tool } from "../../store/editorStore";
import { OPENING_THICKNESS } from "../../utils/defaults";
import { snapPoint } from "../../utils/snap";
import ChairMarkers from "./ChairMarkers";

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

const SELECTED_STROKE = "#2563eb";
const STROKE_WIDTH = 1.5;
const SELECTED_STROKE_WIDTH = 3;

interface Style {
  fill: string;
  stroke: string;
}

function styleFor(object: HallObject): Style {
  switch (object.type) {
    case "table":
      return { fill: "#ffffff", stroke: "#1f2937" };
    case "stage":
      return { fill: "#4c1d95", stroke: "#2e1065" };
    case "dance_floor":
      return { fill: "rgba(250, 204, 21, 0.45)", stroke: "#ca8a04" };
    case "restricted_area":
      return { fill: "rgba(220, 38, 38, 0.25)", stroke: "#dc2626" };
    case "service_area":
      return { fill: "rgba(59, 130, 246, 0.2)", stroke: "#64748b" };
    case "entrance":
      return { fill: "#16a34a", stroke: "#166534" };
    case "exit":
      return { fill: "#f97316", stroke: "#c2410c" };
    default:
      return assertNever(object);
  }
}

// Size (metres) of the object's BODY in local coordinates, excluding chairs and labels.
function bodySize(object: HallObject): { width: number; height: number } {
  switch (object.type) {
    case "table":
      switch (object.shape) {
        case "round":
          return { width: object.radius * 2, height: object.radius * 2 };
        case "rectangular":
        case "square":
          return { width: object.width, height: object.height };
        default:
          return assertNever(object);
      }
    case "stage":
    case "dance_floor":
    case "restricted_area":
    case "service_area":
      return { width: object.width, height: object.height };
    case "entrance":
    case "exit":
      return { width: object.width, height: OPENING_THICKNESS };
    default:
      return assertNever(object);
  }
}

interface ObjectBodyProps {
  object: HallObject;
  stroke: string;
  strokeWidth: number;
}

function ObjectBody({ object, stroke, strokeWidth }: ObjectBodyProps) {
  const { fill } = styleFor(object);
  switch (object.type) {
    case "table":
      switch (object.shape) {
        case "round":
          return (
            <>
              <ChairMarkers table={object} />
              <Circle radius={object.radius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeScaleEnabled={false} />
            </>
          );
        case "rectangular":
        case "square":
          return (
            <>
              <ChairMarkers table={object} />
              <Rect
                x={-object.width / 2}
                y={-object.height / 2}
                width={object.width}
                height={object.height}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeScaleEnabled={false}
              />
            </>
          );
        default:
          return assertNever(object);
      }
    case "stage":
    case "dance_floor":
    case "restricted_area":
    case "service_area":
      return (
        <Rect
          x={-object.width / 2}
          y={-object.height / 2}
          width={object.width}
          height={object.height}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeScaleEnabled={false}
        />
      );
    case "entrance":
    case "exit":
      return (
        <Rect
          x={-object.width / 2}
          y={-OPENING_THICKNESS / 2}
          width={object.width}
          height={OPENING_THICKNESS}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeScaleEnabled={false}
          hitStrokeWidth={12}
        />
      );
    default:
      return assertNever(object);
  }
}

interface HallObjectShapeProps {
  object: HallObject;
  selected: boolean;
  tool: Tool;
}

function HallObjectShape({ object, selected, tool }: HallObjectShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const { width: bodyWidth, height: bodyHeight } = bodySize(object);

  // Make the Transformer hug the body only: report the body rect for local (skipTransform) bounds queries.
  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    const original = node.getClientRect.bind(node);
    const rect = { x: -bodyWidth / 2, y: -bodyHeight / 2, width: bodyWidth, height: bodyHeight };
    node.getClientRect = (config) => (config?.skipTransform ? rect : original(config));
    return () => {
      delete (node as unknown as Record<string, unknown>).getClientRect;
    };
  }, [bodyWidth, bodyHeight]);

  const isSelectTool = tool === "select";

  const handleSelect = (e: KonvaEventObject<Event>) => {
    if (!isSelectTool) return; // creation tools place objects via the stage click handler
    e.cancelBubble = true; // do not reach the stage's "deselect" handler
    useEditorStore.getState().select(object.id);
  };

  const handleDragMove = (e: KonvaEventObject<Event>) => {
    const node = e.currentTarget;
    const { snapEnabled, gridSize, updateObject } = useEditorStore.getState();
    let p = { x: node.x(), y: node.y() };
    if (snapEnabled) {
      p = snapPoint(p, gridSize);
      node.position(p);
    }
    updateObject(object.id, p);
  };

  const handleDragEnd = (e: KonvaEventObject<Event>) => {
    const node = e.currentTarget;
    const { snapEnabled, gridSize, commitObjectUpdate } = useEditorStore.getState();
    let p = { x: node.x(), y: node.y() };
    if (snapEnabled) {
      p = snapPoint(p, gridSize);
      node.position(p);
    }
    commitObjectUpdate(object.id, p);
  };

  return (
    <Group
      ref={groupRef}
      id={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation}
      draggable={isSelectTool}
      onMouseDown={handleSelect}
      onTap={handleSelect}
      onClick={handleSelect}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <ObjectBody
        object={object}
        stroke={selected ? SELECTED_STROKE : styleFor(object).stroke}
        strokeWidth={selected ? SELECTED_STROKE_WIDTH : STROKE_WIDTH}
      />
    </Group>
  );
}

export default memo(HallObjectShape);

const LABEL_FONT_SIZE = 0.5;
const LABEL_LINE_HEIGHT = 1.2;
const LABEL_WIDTH = 8;

interface LabelInfo {
  lines: string[];
  color: string;
  dy: number;
}

function labelInfo(object: HallObject, tableNumber: number | null): LabelInfo {
  const dark = "#111827";
  switch (object.type) {
    case "table":
      return {
        lines: [
          tableNumber === null ? "T?" : `T${tableNumber}`,
          `${object.capacity} ${object.capacity === 1 ? "seat" : "seats"}`,
        ],
        color: dark,
        dy: 0,
      };
    case "stage":
      return { lines: ["Stage"], color: "#ffffff", dy: 0 };
    case "dance_floor":
      return { lines: ["Dance Floor"], color: dark, dy: 0 };
    case "restricted_area":
      return { lines: ["Restricted"], color: dark, dy: 0 };
    case "service_area":
      return { lines: ["Service"], color: dark, dy: 0 };
    case "entrance":
      return { lines: ["Entrance"], color: dark, dy: -0.45 }; // above the thin bar
    case "exit":
      return { lines: ["Exit"], color: dark, dy: -0.45 };
    default:
      return assertNever(object);
  }
}

interface HallObjectLabelProps {
  object: HallObject;
  tableNumber: number | null;
}

// Drawn in a separate pass at the object's center with no rotation, so text is always upright
// (equivalent to counter-rotating by -rotation about the group origin).
export const HallObjectLabel = memo(function HallObjectLabel({ object, tableNumber }: HallObjectLabelProps) {
  const { lines, color, dy } = labelInfo(object, tableNumber);
  const height = lines.length * LABEL_FONT_SIZE * LABEL_LINE_HEIGHT;
  return (
    <Text
      x={object.x}
      y={object.y + dy}
      width={LABEL_WIDTH}
      height={height}
      offsetX={LABEL_WIDTH / 2}
      offsetY={height / 2}
      text={lines.join("\n")}
      fontSize={LABEL_FONT_SIZE}
      lineHeight={LABEL_LINE_HEIGHT}
      align="center"
      verticalAlign="middle"
      wrap="none"
      fill={color}
      listening={false}
    />
  );
});