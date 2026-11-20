export interface LayoutObjectLike {
  id: string;
  type: string;
  capacity?: number;
}

export interface TableSummary {
  id: string;
  label: string;
  capacity: number;
}

export interface SofaSummary {
  id: string;
  label: string;
  capacity: number;
}

export interface LayoutSummary {
  tables: TableSummary[];
  sofas: SofaSummary[];
  hasStage: boolean;
  hasEntrance: boolean;
}

// Labels count every table in objects[] (T<index + 1>), so they match the designer even if a table is skipped.
// Sofas are numbered the same way (S<index + 1>).
export function summarizeLayout(objects: ReadonlyArray<LayoutObjectLike>): LayoutSummary {
  const tables: TableSummary[] = [];
  const sofas: SofaSummary[] = [];
  let tableNumber = 0;
  let sofaNumber = 0;
  let hasStage = false;
  let hasEntrance = false;
  for (const obj of objects) {
    if (obj.type === "table") {
      tableNumber += 1;
      const capacity = obj.capacity;
      if (typeof capacity === "number" && Number.isFinite(capacity)) {
        tables.push({ id: obj.id, label: `T${tableNumber}`, capacity });
      }
    } else if (obj.type === "sofa") {
      sofaNumber += 1;
      const capacity = obj.capacity;
      if (typeof capacity === "number" && Number.isFinite(capacity)) {
        sofas.push({ id: obj.id, label: `S${sofaNumber}`, capacity });
      }
    } else if (obj.type === "stage") {
      hasStage = true;
    } else if (obj.type === "entrance" || obj.type === "exit") {
      hasEntrance = true;
    }
  }
  return { tables, sofas, hasStage, hasEntrance };
}