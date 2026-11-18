import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";
import type Konva from "konva";
import type { HallObject } from "../../types/layout";
import { useEditorStore } from "../../store/editorStore";
import type { ObjectPatch } from "../../store/editorStore";
import { MIN_SIZE } from "../../utils/defaults";
import { ROTATION_STEP, normalizeRotation, snapRotation } from "../../utils/snap";

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const CORNER_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const ALL_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-right",
  "middle-left",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
const SIDE_ANCHORS = ["middle-left", "middle-right"];
const ROTATION_SNAPS = Array.from({ length: Math.round(360 / ROTATION_STEP) }, (_, i) => i * ROTATION_STEP);

interface Config {
  anchors: string[];
  keepRatio: boolean;
  minWidth: number; // metres
  minHeight: number | null; // metres; null = height is not resizable, do not check
}

function configFor(object: HallObject): Config {
  switch (object.type) {
    case "table":
      switch (object.shape) {
        case "round":
          return { anchors: CORNER_ANCHORS, keepRatio: true, minWidth: 2 * MIN_SIZE, minHeight: 2 * MIN_SIZE };
        case "rectangular":
        case "square":
          return { anchors: ALL_ANCHORS, keepRatio: false, minWidth: MIN_SIZE, minHeight: MIN_SIZE };
        default:
          return assertNever(object);
      }
    case "stage":
    case "dance_floor":
    case "restricted_area":
    case "service_area":
      return { anchors: ALL_ANCHORS, keepRatio: false, minWidth: MIN_SIZE, minHeight: MIN_SIZE };
    case "entrance":
    case "exit":
      return { anchors: SIDE_ANCHORS, keepRatio: false, minWidth: MIN_SIZE, minHeight: null };
    default:
      return assertNever(object);
  }
}

// Size in metres after applying the node's scale. Capacity is never touched.
function resizePatch(object: HallObject, sx: number, sy: number): ObjectPatch {
  switch (object.type) {
    case "table":
      switch (object.shape) {
        case "round":
          return { radius: Math.max(MIN_SIZE, r6(object.radius * Math.max(sx, sy))) };
        case "rectangular":
        case "square":
          return {
            width: Math.max(MIN_SIZE, r6(object.width * sx)),
            height: Math.max(MIN_SIZE, r6(object.height * sy)),
          };
        default:
          return assertNever(object);
      }
    case "stage":
    case "dance_floor":
    case "restricted_area":
    case "service_area":
      return {
        width: Math.max(MIN_SIZE, r6(object.width * sx)),
        height: Math.max(MIN_SIZE, r6(object.height * sy)),
      };
    case "entrance":
    case "exit":
      return { width: Math.max(MIN_SIZE, r6(object.width * sx)) };
    default:
      return assertNever(object);
  }
}

function r6(n: number): number {
  return Math.round(n * 1e6) / 1e6 + 0;
}

// Changes whenever the body size changes, so the transformer box can be refreshed.
function sizeKeyOf(o: HallObject): string {
  const radius = "radius" in o ? o.radius : "";
  const width = "width" in o ? o.width : "";
  const height = "height" in o ? o.height : "";
  const shape = "shape" in o ? o.shape : "";
  return `${o.type}|${shape}|${radius}|${width}|${height}`;
}

export default function SelectionTransformer() {
  const trRef = useRef<Konva.Transformer>(null);
  const tool = useEditorStore((s) => s.tool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const selected = useEditorStore((s) => s.objects.find((o) => o.id === s.selectedId));

  const active = tool === "select" && selected !== undefined;
  const selectedId = selected?.id ?? null;
  const sizeKey = selected ? sizeKeyOf(selected) : "";
  const config = selected ? configFor(selected) : null;

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const stage = tr.getStage();
    const node = active && selectedId !== null && stage ? stage.findOne(`#${selectedId}`) : undefined;
    tr.nodes(node ? [node] : []);
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  }, [active, selectedId, sizeKey]);

  const boundBoxFunc = (oldBox: Box, newBox: Box): Box => {
    if (!config) return newBox;
    const scale = useEditorStore.getState().viewport.scale;
    const eps = 1e-6;
    if (newBox.width < config.minWidth * scale - eps) return oldBox;
    if (config.minHeight !== null && newBox.height < config.minHeight * scale - eps) return oldBox;
    return newBox;
  };

  const handleTransformEnd = () => {
    const tr = trRef.current;
    const node = tr?.nodes()[0];
    if (!tr || !node) return;
    const state = useEditorStore.getState();
    const object = state.objects.find((o) => o.id === node.id());
    if (!object) return;

    const sx = Math.abs(node.scaleX());
    const sy = Math.abs(node.scaleY());
    let rotation = normalizeRotation(r6(node.rotation()));
    if (state.snapEnabled) rotation = snapRotation(rotation);

    // Resizing from one side moves the center: node.x()/y() are the new center.
    const patch: ObjectPatch = {
      x: r6(node.x()),
      y: r6(node.y()),
      rotation,
      ...resizePatch(object, sx, sy),
    };

    node.scale({ x: 1, y: 1 });
    state.commitObjectUpdate(object.id, patch);

    // Keep the node consistent with whatever the store ended up with.
    const after = useEditorStore.getState().objects.find((o) => o.id === object.id);
    if (after) {
      node.position({ x: after.x, y: after.y });
      node.rotation(after.rotation);
    }
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  };

  return (
    <Transformer
      ref={trRef}
      rotateEnabled
      flipEnabled={false}
      enabledAnchors={config?.anchors ?? ALL_ANCHORS}
      keepRatio={config?.keepRatio ?? false}
      rotationSnaps={snapEnabled ? ROTATION_SNAPS : []}
      rotationSnapTolerance={ROTATION_STEP / 2}
      boundBoxFunc={boundBoxFunc}
      onTransformEnd={handleTransformEnd}
      borderStroke="#2563eb"
      anchorStroke="#2563eb"
      anchorFill="#ffffff"
      anchorSize={9}
    />
  );
}