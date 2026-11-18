import { memo } from "react";
import { Circle } from "react-konva";
import type { TableObject } from "../../types/layout";
import { CHAIR_RADIUS, generateChairs } from "../../utils/chairs";

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
          fill="#e5e7eb"
          stroke="#6b7280"
          strokeWidth={1}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
    </>
  );
}

export default memo(ChairMarkers);