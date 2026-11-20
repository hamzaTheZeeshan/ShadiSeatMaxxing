import type { HallObject } from "../../types/layout";
import type { HallPreset } from "../../utils/presetLayouts";
import { OPENING_THICKNESS } from "../../utils/defaults";

const FILL: Record<string, string> = {
  sofa: "#f9a8d4",
  stage: "#c4b5fd",
  dance_floor: "#fde68a",
  restricted_area: "#fecaca",
  service_area: "#bae6fd",
  entrance: "#16a34a",
  exit: "#dc2626",
};

function renderObject(o: HallObject) {
  if (o.type === "table" && o.shape === "round") {
    return <circle key={o.id} cx={o.x} cy={o.y} r={o.radius} fill="#f9fafb" stroke="#6b7280" strokeWidth={0.12} />;
  }
  const w = o.width;
  const h = "height" in o ? o.height : OPENING_THICKNESS * 2;
  const isTable = o.type === "table";
  const isSofa = o.type === "sofa";
  return (
    <rect
      key={o.id}
      x={o.x - w / 2}
      y={o.y - h / 2}
      width={w}
      height={h}
      transform={`rotate(${o.rotation} ${o.x} ${o.y})`}
      fill={isTable ? "#f9fafb" : FILL[o.type]}
      stroke={isTable ? "#6b7280" : isSofa ? "#9d174d" : "none"}
      strokeWidth={0.12}
    />
  );
}

export default function PresetPreview({ preset }: { preset: HallPreset }) {
  const { hall, objects } = preset.layout;
  const pad = 1;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${hall.width + pad * 2} ${hall.height + pad * 2}`}
      style={{ width: "100%", height: 120, display: "block", background: "#f3f4f6", borderRadius: 6 }}
      role="img"
      aria-label={`Preview of ${preset.name}`}
    >
      <rect x={0} y={0} width={hall.width} height={hall.height} fill="#ffffff" stroke="#374151" strokeWidth={0.25} />
      {objects.map(renderObject)}
    </svg>
  );
}