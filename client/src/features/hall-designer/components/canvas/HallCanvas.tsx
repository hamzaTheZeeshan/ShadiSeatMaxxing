import { useEffect, useRef } from "react";
import { Layer, Rect, Shape, Stage } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useElementSize } from "../../hooks/useElementSize";
import { useEditorStore } from "../../store/editorStore";
import { clamp, fitViewport, screenToWorld } from "../../utils/coords";
import { createObject } from "../../utils/defaults";
import { snapPoint } from "../../utils/snap";
import ObjectLayer from "./ObjectLayer";

const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 5;
const MAX_SCALE = 200;
const MIN_GRID_PX = 8;
const PAN_THRESHOLD_PX = 3;

interface PanStart {
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

export default function HallCanvas() {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const viewport = useEditorStore((s) => s.viewport);
  const tool = useEditorStore((s) => s.tool);
  const gridSize = useEditorStore((s) => s.gridSize);
  const hallWidth = useEditorStore((s) => s.hall.width);
  const hallHeight = useEditorStore((s) => s.hall.height);

  const panRef = useRef<PanStart | null>(null);
  const didPanRef = useRef(false);

  // Fit to view whenever the container or the hall dimensions change.
  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    useEditorStore
      .getState()
      .setViewport(fitViewport({ width: hallWidth, height: hallHeight }, { width: size.width, height: size.height }));
  }, [size.width, size.height, hallWidth, hallHeight]);

  useEffect(() => {
    const endPan = () => {
      panRef.current = null;
    };
    window.addEventListener("mouseup", endPan);
    window.addEventListener("touchend", endPan);
    return () => {
      window.removeEventListener("mouseup", endPan);
      window.removeEventListener("touchend", endPan);
    };
  }, []);

  const handlePointerDown = (e: KonvaEventObject<Event>) => {
    didPanRef.current = false;
    const stage = e.target.getStage();
    if (!stage || e.target !== stage) return; // only empty space pans
    if (e.evt instanceof MouseEvent && e.evt.button !== 0) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const vp = useEditorStore.getState().viewport;
    panRef.current = { startX: pos.x, startY: pos.y, offsetX: vp.offsetX, offsetY: vp.offsetY };
  };

  const handlePointerMove = (e: KonvaEventObject<Event>) => {
    const pan = panRef.current;
    if (!pan) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const dx = pos.x - pan.startX;
    const dy = pos.y - pan.startY;
    if (!didPanRef.current && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;
    didPanRef.current = true;
    const { viewport: vp, setViewport } = useEditorStore.getState();
    setViewport({ scale: vp.scale, offsetX: pan.offsetX + dx, offsetY: pan.offsetY + dy });
  };

  const handleClick = (e: KonvaEventObject<Event>) => {
    if (didPanRef.current) return; // end of a pan drag, not a click
    const stage = e.target.getStage();
    if (!stage) return;
    const state = useEditorStore.getState();
    const { tool: currentTool } = state;
    if (currentTool === "select") {
      if (e.target === stage) state.select(null);
      return;
    }
    const pos = stage.getPointerPosition();
    if (!pos) return;
    let center = screenToWorld(pos, state.viewport);
    if (state.snapEnabled) center = snapPoint(center, state.gridSize);
    state.addObject(createObject(currentTool, center)); // selects it and resets the tool
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const { viewport: vp, setViewport } = useEditorStore.getState();
    const factor = e.evt.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const scale = clamp(vp.scale * factor, MIN_SCALE, MAX_SCALE);
    if (scale === vp.scale) return;
    const world = screenToWorld(pos, vp);
    setViewport({ scale, offsetX: pos.x - world.x * scale, offsetY: pos.y - world.y * scale });
  };

  // Grid at gridSize spacing; fall back to 1 m lines when it would be denser than MIN_GRID_PX on screen.
  const step = gridSize * viewport.scale >= MIN_GRID_PX ? gridSize : 1;

  return (
    <div
      ref={ref}
      style={{ flex: 1, minHeight: 0, background: "#f9fafb", cursor: tool === "select" ? "grab" : "crosshair" }}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
          onClick={handleClick}
          onTap={handleClick}
          onWheel={handleWheel}
        >
          <Layer listening={false}>
            <Rect x={0} y={0} width={hallWidth} height={hallHeight} fill="#ffffff" />
            <Shape
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeScaleEnabled={false}
              sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                const nx = Math.floor(hallWidth / step + 1e-9);
                const ny = Math.floor(hallHeight / step + 1e-9);
                for (let i = 0; i <= nx; i++) {
                  const x = i * step;
                  ctx.moveTo(x, 0);
                  ctx.lineTo(x, hallHeight);
                }
                for (let j = 0; j <= ny; j++) {
                  const y = j * step;
                  ctx.moveTo(0, y);
                  ctx.lineTo(hallWidth, y);
                }
                ctx.strokeShape(shape);
              }}
            />
            <Rect
              x={0}
              y={0}
              width={hallWidth}
              height={hallHeight}
              stroke="#111827"
              strokeWidth={2}
              strokeScaleEnabled={false}
            />
          </Layer>
          <ObjectLayer />
        </Stage>
      )}
    </div>
  );
}