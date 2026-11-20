import { memo, useEffect, useRef } from "react";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { HallObject } from "../../types/layout";
import { useEditorStore } from "../../store/editorStore";
import type { Tool } from "../../store/editorStore";
import { OPENING_THICKNESS } from "../../utils/defaults";
import { snapPoint } from "../../utils/snap";
import type { Severity } from "../../utils/validation";
import ChairMarkers from "./ChairMarkers";

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

const SELECTED_STROKE = "#2563eb";
const STROKE_WIDTH = 1.5;
const SELECTED_STROKE_WIDTH = 3;
const ERROR_STROKE = "#dc2626";
const WARNING_STROKE = "#d97706";
const ISSUE_STROKE_WIDTH = 2.5;

// Sofa: plush rose body, darker backrest strip, thin cushion dividers.
const SOFA_BACKREST_FILL = "#db2777";
const SOFA_CUSHION_STROKE = "#9d174d";
const SOFA_BACKREST_RATIO = 0.3;

interface Style {
  fill: string;
  stroke: string;
}

function styleFor(object: HallObject): Style {
  switch (object.type) {
    case "table":
      return { fill: "#ffffff", stroke: "#1f2937" };
    case "sofa":
      return { fill: "#f9a8d4", stroke: "#9d174d" };
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
    case "sofa":
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
    case "sofa": {
      const { width, height, capacity } = object;
      const backrestHeight = height * SOFA_BACKREST_RATIO;
      const radius = Math.min(0.15, height / 4);
      const dividers = Array.from(
        { length: Math.max(capacity - 1, 0) },
        (_, i) => -width / 2 + ((i + 1) * width) / capacity,
      );
      return (
        <>
          <Rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            cornerRadius={radius}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeScaleEnabled={false}
          />
          <Rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={backrestHeight}
            cornerRadius={radius}
            fill={SOFA_BACKREST_FILL}
            listening={false}
          />
          {dividers.map((x) => (
            <Line
              key={x}
              points={[x, -height / 2 + backrestHeight, x, height / 2]}
              stroke={SOFA_CUSHION_STROKE}
              strokeWidth={1}
              strokeScaleEnabled={false}
              listening={false}
            />
          ))}
        </>
      );
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

interface ValidationOutlineProps {
  object: HallObject;
  severity: Severity;
}

// Extra non-listening outline on the body; never affects hit areas or Transformer bounds.
function ValidationOutline({ object, severity }: ValidationOutlineProps) {
  const stroke = severity === "error" ? ERROR_STROKE : WARNING_STROKE;
  const dash = severity === "warning" ? [6, 4] : [];
  if (object.type === "table" && object.shape === "round") {
    return (
      <Circle
        radius={object.radius}
        stroke={stroke}
        strokeWidth={ISSUE_STROKE_WIDTH}
        strokeScaleEnabled={false}
        dash={dash}
        fillEnabled={false}
        listening={false}
      />
    );
  }
  const { width, height } = bodySize(object);
  return (
    <Rect
      x={-width / 2}
      y={-height / 2}
      width={width}
      height={height}
      stroke={stroke}
      strokeWidth={ISSUE_STROKE_WIDTH}
      strokeScaleEnabled={false}
      dash={dash}
      fillEnabled={false}
      listening={false}
    />
  );
}

interface HallObjectShapeProps {
  object: HallObject;
  selected: boolean;
  tool: Tool;
  issue?: Severity;
}

function HallObjectShape({ object, selected, tool, issue }: HallObjectShapeProps) {
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
      {issue !== undefined && <ValidationOutline object={object} severity={issue} />}
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
    case "sofa":
      // Single line: the body is only ~0.9 m tall, so two lines would spill over its edges.
      return { lines: ["Sofa"], color: dark, dy: 0 };
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