import { memo, useMemo } from "react";
import { Group, Layer } from "react-konva";
import type { HallObject } from "../../types/layout";
import { useEditorStore } from "../../store/editorStore";
import { useValidation } from "../../hooks/useValidation";
import HallObjectShape, { HallObjectLabel } from "./HallObjectShape";
import SelectionTransformer from "./SelectionTransformer";

// Back-to-front passes. Every HallObject type appears in exactly one pass.
const PASSES: ReadonlyArray<ReadonlyArray<HallObject["type"]>> = [
  ["restricted_area"],
  ["service_area"],
  ["dance_floor"],
  ["stage"],
  ["table"],
  ["entrance", "exit"],
];

function ObjectLayer() {
  const objects = useEditorStore((s) => s.objects);
  const selectedId = useEditorStore((s) => s.selectedId);
  const tool = useEditorStore((s) => s.tool);
  const { byObjectId } = useValidation();

  // New array; the store array is never mutated or re-sorted.
  const ordered = useMemo(
    () => PASSES.flatMap((types) => objects.filter((o) => types.includes(o.type))),
    [objects],
  );

  // Table numbers follow order of appearance among tables in objects[].
  const tableNumbers = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const o of objects) {
      if (o.type === "table") {
        n += 1;
        map.set(o.id, n);
      }
    }
    return map;
  }, [objects]);

  return (
    <Layer>
      {ordered.map((o) => (
        <HallObjectShape key={o.id} object={o} selected={o.id === selectedId} tool={tool} issue={byObjectId.get(o.id)} />
      ))}
      <Group listening={false}>
        {ordered.map((o) => (
          <HallObjectLabel key={o.id} object={o} tableNumber={tableNumbers.get(o.id) ?? null} />
        ))}
      </Group>
      <SelectionTransformer />
    </Layer>
  );
}

export default memo(ObjectLayer);