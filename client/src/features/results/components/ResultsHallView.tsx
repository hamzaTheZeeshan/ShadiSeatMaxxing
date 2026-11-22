import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Rect, Stage, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Hall, HallObject } from "../../hall-designer/types/layout";
import { OPENING_THICKNESS } from "../../hall-designer/utils/defaults";
import type { ConstraintContext } from "../utils/constraintReport";
import type { SeatingModel } from "../utils/seatingModel";
import SeatTooltip from "./SeatTooltip";
import { badgeStyle, BORDER, MUTED } from "../ui";

type KEvent = KonvaEventObject<Event>;

interface Target {
  objectId: string;
  slotIndex: number | null;
}
interface PinnedTarget extends Target {
  x: number;
  y: number;
}
interface Handlers {
  onMouseEnter: (e: KEvent) => void;
  onMouseMove: (e: KEvent) => void;
  onMouseLeave: (e: KEvent) => void;
  onClick: (e: KEvent) => void;
  onTap: (e: KEvent) => void;
}
type Bind = (objectId: string, slotIndex: number | null) => Handlers;

const OBJECT_STYLE: Record<HallObject["type"], { fill: string; stroke: string }> = {
  table: { fill: "#ffffff", stroke: "#111111" },
  sofa: { fill: "#f6b8f6", stroke: "#111111" },
  stage: { fill: "#5bb8ff", stroke: "#111111" },
  dance_floor: { fill: "rgba(255, 208, 168, 0.7)", stroke: "#111111" },
  restricted_area: { fill: "rgba(255, 154, 154, 0.45)", stroke: "#b91c1c" },
  service_area: { fill: "rgba(91, 184, 255, 0.25)", stroke: "#111111" },
  entrance: { fill: "#a8d5b5", stroke: "#111111" },
  exit: { fill: "#ff9a6b", stroke: "#111111" },
};

const SIDE_FILL = { bride: "#f6b8f6", groom: "#5bb8ff", other: "#a8d5b5" } as const;
const EMPTY_FILL = "#ffffff";
const PAD = 16;
const TIP_W = 320;

function ObjectBody({ object, bind }: { object: HallObject; bind: Bind }) {
  const { fill, stroke } = OBJECT_STYLE[object.type];
  const common = { fill, stroke, strokeWidth: 1.5, strokeScaleEnabled: false } as const;
  switch (object.type) {
    case "table": {
      const events = bind(object.id, null);
      return object.shape === "round" ? (
        <Circle radius={object.radius} {...common} {...events} />
      ) : (
        <Rect x={-object.width / 2} y={-object.height / 2} width={object.width} height={object.height} {...common} {...events} />
      );
    }
    case "sofa": {
      const events = bind(object.id, null);
      return (
        <>
          <Rect x={-object.width / 2} y={-object.height / 2} width={object.width} height={object.height} cornerRadius={0.15} {...common} {...events} />
          <Rect x={-object.width / 2} y={-object.height / 2} width={object.width} height={object.height * 0.3} cornerRadius={0.15} fill="#d58bd5" listening={false} />
        </>
      );
    }
    case "entrance":
    case "exit":
      return <Rect x={-object.width / 2} y={-OPENING_THICKNESS / 2} width={object.width} height={OPENING_THICKNESS} {...common} />;
    default:
      return <Rect x={-object.width / 2} y={-object.height / 2} width={object.width} height={object.height} {...common} />;
  }
}

function labelLines(object: HallObject, model: SeatingModel): { lines: string[]; color: string; dy: number } {
  const dark = "#111111";
  const seatObject = model.byId.get(object.id);
  if (seatObject) {
    const filled = seatObject.slots.filter((s) => s.guest !== null).length;
    return { lines: [seatObject.label, `${filled}/${seatObject.capacity}`], color: dark, dy: 0 };
  }
  switch (object.type) {
    case "stage":
      return { lines: ["Stage"], color: "#111111", dy: 0 };
    case "dance_floor":
      return { lines: ["Dance Floor"], color: dark, dy: 0 };
    case "restricted_area":
      return { lines: ["Restricted"], color: dark, dy: 0 };
    case "service_area":
      return { lines: ["Service"], color: dark, dy: 0 };
    case "entrance":
      return { lines: ["Entrance"], color: dark, dy: -0.45 };
    case "exit":
      return { lines: ["Exit"], color: dark, dy: -0.45 };
    default:
      return { lines: [], color: dark, dy: 0 };
  }
}

interface Props {
  hall: Hall;
  objects: readonly HallObject[];
  model: SeatingModel;
  ctx: ConstraintContext;
  highlightGuestId: string | null;
}

export default function ResultsHallView({ hall, objects, model, ctx, highlightGuestId }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<Target | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [pinned, setPinned] = useState<PinnedTarget | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = Math.max(1, (width - PAD * 2) / hall.width);
  const height = hall.height * scale + PAD * 2;

  const brokenGuests = useMemo(() => {
    const map = new Map<string, "hard" | "soft">();
    for (const b of ctx.broken) {
      for (const id of b.guest_ids) {
        if (map.get(id) !== "hard") map.set(id, b.type);
      }
    }
    return map;
  }, [ctx.broken]);

  // Memoised so pointer-move re-renders (tooltip position) do not re-render the whole canvas.
  const content = useMemo(() => {
    const pointerOf = (e: KEvent) => e.target.getStage()?.getPointerPosition() ?? null;
    const cursor = (e: KEvent, value: string) => {
      const c = e.target.getStage()?.container();
      if (c) c.style.cursor = value;
    };
    const bind: Bind = (objectId, slotIndex) => {
      const toggle = (e: KEvent) => {
        const p = pointerOf(e);
        if (!p) return;
        setPinned((prev) =>
          prev && prev.objectId === objectId && prev.slotIndex === slotIndex ? null : { objectId, slotIndex, x: p.x, y: p.y },
        );
      };
      return {
        onMouseEnter: (e) => {
          cursor(e, "pointer");
          const p = pointerOf(e);
          if (p) setPointer({ x: p.x, y: p.y });
          setHover({ objectId, slotIndex });
        },
        onMouseMove: (e) => {
          const p = pointerOf(e);
          if (p) setPointer({ x: p.x, y: p.y });
        },
        onMouseLeave: (e) => {
          cursor(e, "default");
          setHover(null);
        },
        onClick: toggle,
        onTap: toggle,
      };
    };

    return (
      <>
        <Rect x={0} y={0} width={hall.width} height={hall.height} fill="#ffffff" stroke="#111111" strokeWidth={2} strokeScaleEnabled={false} />
        {objects.map((o) => {
          const seatObject = model.byId.get(o.id);
          return (
            <Group key={o.id} x={o.x} y={o.y} rotation={o.rotation}>
              <ObjectBody object={o} bind={bind} />
              {seatObject?.slots.map((slot) => {
                const guest = slot.guest;
                const issue = guest ? brokenGuests.get(guest.id) : undefined;
                const stroke = issue === "hard" ? "#dc2626" : issue === "soft" ? "#d97706" : "#111111";
                return (
                  <Group key={slot.index}>
                    {guest && guest.id === highlightGuestId ? (
                      <Circle x={slot.x} y={slot.y} radius={slot.radius * 1.7} stroke="#eab308" strokeWidth={3} strokeScaleEnabled={false} listening={false} />
                    ) : null}
                    <Circle
                      x={slot.x}
                      y={slot.y}
                      radius={slot.radius}
                      fill={guest ? SIDE_FILL[guest.side] : EMPTY_FILL}
                      stroke={guest ? stroke : "#111111"}
                      strokeWidth={issue ? 2.5 : 1.25}
                      strokeScaleEnabled={false}
                      {...bind(o.id, slot.index)}
                    />
                  </Group>
                );
              })}
            </Group>
          );
        })}
        {objects.map((o) => {
          const { lines, color, dy } = labelLines(o, model);
          if (lines.length === 0) return null;
          const h = lines.length * 0.5 * 1.2;
          return (
            <Text
              key={`label_${o.id}`}
              x={o.x}
              y={o.y + dy}
              width={8}
              height={h}
              offsetX={4}
              offsetY={h / 2}
              text={lines.join("\n")}
              fontSize={0.5}
              lineHeight={1.2}
              align="center"
              verticalAlign="middle"
              wrap="none"
              fill={color}
              listening={false}
            />
          );
        })}
      </>
    );
  }, [hall.width, hall.height, objects, model, brokenGuests, highlightGuestId]);

  const active: PinnedTarget | null = pinned ?? (hover ? { ...hover, x: pointer.x, y: pointer.y } : null);
  const activeObject = active ? model.byId.get(active.objectId) : undefined;
  const activeSlot = active && activeObject && active.slotIndex !== null ? (activeObject.slots[active.slotIndex] ?? null) : null;

  const flipX = active ? active.x + 16 + TIP_W > width : false;
  const flipY = active ? active.y > height / 2 : false;

  return (
    <div>
      <div ref={wrapRef} style={{ position: "relative", width: "100%", border: `2px solid ${BORDER}`, borderRadius: 0, overflow: "visible", background: "#ffffff" }}>
        <Stage
          width={width}
          height={height}
          onClick={(e) => {
            if (e.target === e.target.getStage()) setPinned(null);
          }}
        >
          <Layer x={PAD} y={PAD} scaleX={scale} scaleY={scale}>
            {content}
          </Layer>
        </Stage>
        {active && activeObject ? (
          <div
            style={{
              position: "absolute",
              left: Math.max(0, flipX ? active.x - 16 - TIP_W : active.x + 16),
              top: flipY ? active.y - 16 : active.y + 16,
              transform: flipY ? "translateY(-100%)" : undefined,
              zIndex: 10,
              pointerEvents: pinned ? "auto" : "none",
            }}
          >
            <SeatTooltip seatObject={activeObject} slot={activeSlot} ctx={ctx} pinned={pinned !== null} onClose={() => setPinned(null)} />
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, fontSize: 12, color: MUTED, alignItems: "center" }}>
        <span style={badgeStyle("neutral")}>Hover a seat for details · click to pin</span>
        <Legend color={SIDE_FILL.bride} label="Bride side" />
        <Legend color={SIDE_FILL.groom} label="Groom side" />
        <Legend color={SIDE_FILL.other} label="Other" />
        <Legend color={EMPTY_FILL} label="Empty seat" border="#111111" />
        <Legend color="#ffffff" label="Hard rule broken" border="#dc2626" />
        <Legend color="#ffffff" label="Soft preference missed" border="#d97706" />
      </div>
    </div>
  );
}

function Legend({ color, label, border = "#111111" }: { color: string; label: string; border?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, border: `2px solid ${border}` }} />
      {label}
    </span>
  );
}