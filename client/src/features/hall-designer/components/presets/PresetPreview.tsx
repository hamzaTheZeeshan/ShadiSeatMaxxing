import type { HallObject } from "../../types/layout";
import type { HallPreset } from "../../utils/presetLayouts";
import { OPENING_THICKNESS } from "../../utils/defaults";

// Neo-brutalist theme, same palette as the home page and the canvas.
const INK = "#111111";
const CREAM = "#fff4dc";

const FILL: Record<string, string> = {
  sofa: "#f6b8f6",
  stage: INK,
  dance_floor: "#f8c335",
  restricted_area: "#ff9a9a",
  service_area: "#a8d5b5",
  entrance: "#a8d5b5",
  exit: "#ff9a6b",
};

function renderObject(o: HallObject) {
  if (o.type === "table" && o.shape === "round") {
    return <circle key={o.id} cx={o.x} cy={o.y} r={o.radius} fill="#ffffff" stroke={INK} strokeWidth={0.18} />;
  }
  const w = o.width;
  const h = "height" in o ? o.height : OPENING_THICKNESS * 2;
  const isTable = o.type === "table";
  return (
    <rect
      key={o.id}
      x={o.x - w / 2}
      y={o.y - h / 2}
      width={w}
      height={h}
      transform={`rotate(${o.rotation} ${o.x} ${o.y})`}
      fill={isTable ? "#ffffff" : FILL[o.type]}
      stroke={INK}
      strokeWidth={0.18}
    />
  );
}

export default function PresetPreview({ preset }: { preset: HallPreset }) {
  const { hall, objects } = preset.layout;
  const pad = 1;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${hall.width + pad * 2} ${hall.height + pad * 2}`}
      style={{
        width: "100%",
        height: 120,
        display: "block",
        background: CREAM,
        border: `2px solid ${INK}`,
        boxSizing: "border-box",
      }}
      role="img"
      aria-label={`Preview of ${preset.name}`}
    >
      <rect x={0} y={0} width={hall.width} height={hall.height} fill="#ffffff" stroke={INK} strokeWidth={0.3} />
      {objects.map(renderObject)}
    </svg>
  );
}