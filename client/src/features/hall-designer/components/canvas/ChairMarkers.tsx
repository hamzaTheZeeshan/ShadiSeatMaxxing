import { memo } from "react";
import { Circle } from "react-konva";
import type { TableObject } from "../../types/layout";
import { CHAIR_RADIUS, generateChairs } from "../../utils/chairs";

const INK = "#111111";
const CHAIR_FILL = "#f6b8f6";

interface ChairMarkersProps {
  table: TableObject;
}

// Visual only: derived from the table every render, never stored, never interactive.
function ChairMarkers({ table }: ChairMarkersProps) {
  const chairs = generateChairs(table);
  return (
    <>
      {chairs.map((chair, i) => (
        <Circle
          key={i}
          x={chair.x}
          y={chair.y}
          radius={CHAIR_RADIUS}
          fill={CHAIR_FILL}
          stroke={INK}
          strokeWidth={2}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
    </>
  );
}

export default memo(ChairMarkers);