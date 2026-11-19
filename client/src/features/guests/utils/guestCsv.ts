import { MAX_GUESTS, MAX_IMPORT_CHARS, guestInputSchema } from "../types/guestSchema";
import type { Guest, GuestParseResult, ImportedGuest } from "../types/guestSchema";

const COLUMNS = ["name", "household", "side", "gender", "age_band", "role", "vip", "mobility", "dietary", "notes"] as const;
type Column = (typeof COLUMNS)[number];

const ALIASES = new Map<string, Column>([
  ["family", "household"],
  ["group", "household"],
  ["age", "age_band"],
]);

function toColumn(header: string): Column | undefined {
  const key = header.trim().toLowerCase();
  return COLUMNS.find((c) => c === key) ?? ALIASES.get(key);
}

interface RawRow {
  line: number;
  cells: string[];
}

// RFC-4180-style tokenizer: quoted fields, doubled quotes, newlines inside quotes. `line` is the file line a record starts on.
function tokenize(input: string): RawRow[] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: RawRow[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  const endRecord = () => {
    cells.push(field);
    if (cells.some((c) => c.trim() !== "")) rows.push({ line: rowLine, cells });
    cells = [];
    field = "";
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
        if (ch === "\n") line += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(field);
      field = "";
    } else if (ch === "\n") {
      endRecord();
      line += 1;
      rowLine = line;
    } else {
      field += ch;
    }
  }
  if (field !== "" || cells.length > 0) endRecord();
  return rows;
}

function legacyVip(cell: string): string {
  const t = cell.trim().toLowerCase();
  if (t === "yes" || t === "true" || t === "1") return "vip";
  if (t === "no" || t === "false" || t === "0") return "none";
  return cell;
}

export function parseGuestCsv(text: string): GuestParseResult {
  if (text.length > MAX_IMPORT_CHARS) return { guests: [], errors: ["File too large (max 2 MB)"] };

  const missingName: GuestParseResult = { guests: [], errors: ["Missing required column: name"] };
  const rows = tokenize(text);
  const header = rows[0];
  if (!header) return missingName;

  const columnIndex = new Map<Column, number>();
  header.cells.forEach((cell, index) => {
    const column = toColumn(cell);
    if (column !== undefined && !columnIndex.has(column)) columnIndex.set(column, index);
  });
  if (!columnIndex.has("name")) return missingName;

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_GUESTS) return { guests: [], errors: [`Too many guests (max ${MAX_GUESTS})`] };

  const guests: ImportedGuest[] = [];
  const errors: string[] = [];

  for (const row of dataRows) {
    const raw: Record<string, unknown> = {};
    for (const [column, index] of columnIndex) {
      const cell = row.cells[index] ?? "";
      raw[column] = column === "vip" ? legacyVip(cell) : cell;
    }
    const parsed = guestInputSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.map(String).join(".");
        errors.push(`Row ${row.line}: ${path === "" ? "" : `${path}: `}${issue.message}`);
      }
      continue;
    }
    guests.push(parsed.data);
  }

  return { guests, errors };
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportGuestsCsv(guests: Guest[]): string {
  const lines = [COLUMNS.join(",")];
  for (const g of guests) {
    lines.push(
      [g.name, g.household, g.side, g.gender, g.age_band, g.role, g.vip, g.mobility, g.dietary, g.notes]
        .map(csvField)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export const CSV_TEMPLATE: string = [
  COLUMNS.join(","),
  "Example Guest 1,Example Family A,bride,female,senior,grandparent,chief_guest,wheelchair,none,Needs step-free access",
  "Example Guest 2,Example Family B,groom,male,adult,friend,none,none,vegetarian,",
  "",
].join("\n");