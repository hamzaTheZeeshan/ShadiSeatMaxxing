import { useEffect, useRef } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { useEditorStore } from "../../store/editorStore";
import { useElementSize } from "../../hooks/useElementSize";
import { clamp, fitViewport, screenToWorld } from "../../utils/coords";

export default function HallCanvas() {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const { hall, viewport, setViewport } = useEditorStore();

  // Fit hall into view when the container gets its size
  useEffect(() => {
    if (size.width > 0) setViewport(fitViewport(hall, size));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, hall.width, hall.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width <= 0 || size.height <= 0) return;

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * pixelRatio);
    canvas.height = Math.round(size.height * pixelRatio);
    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.translate(viewport.offsetX, viewport.offsetY);
    context.scale(viewport.scale, viewport.scale);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, hall.width, hall.height);

    context.strokeStyle = "#e5e7eb";
    context.lineWidth = 1 / viewport.scale;
    context.beginPath();
    for (let x = 0; x <= hall.width; x++) {
      context.moveTo(x, 0);
      context.lineTo(x, hall.height);
    }
    for (let y = 0; y <= hall.height; y++) {
      context.moveTo(0, y);
      context.lineTo(hall.width, y);
    }
    context.stroke();

    context.strokeStyle = "#111827";
    context.lineWidth = 2 / viewport.scale;
    context.strokeRect(0, 0, hall.width, hall.height);
  }, [hall.width, hall.height, size.width, size.height, viewport]);

  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const bounds = e.currentTarget.getBoundingClientRect();
    const pointer = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const scale = clamp(viewport.scale * factor, 5, 200);
    const world = screenToWorld(pointer, viewport);
    setViewport({
      scale,
      offsetX: pointer.x - world.x * scale,
      offsetY: pointer.y - world.y * scale,
    });
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: viewport.offsetX,
      offsetY: viewport.offsetY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setViewport({
      ...viewport,
      offsetX: drag.offsetX + e.clientX - drag.x,
      offsetY: drag.offsetY + e.clientY - drag.y,
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, background: "#f9fafb" }}>
      {size.width > 0 && (
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          style={{ display: "block", touchAction: "none", cursor: "grab" }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}
    </div>
  );
}