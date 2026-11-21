import { Fragment, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  AGE_BANDS,
  DIETARY_OPTIONS,
  GENDERS,
  MOBILITY_LEVELS,
  ROLES,
  SIDES,
  VIP_LEVELS,
  newGuestSchema,
  optionLabel,
  parseOption,
} from "../types/guestSchema";
import type { AgeBand, EnumOption, Gender, Guest, NewGuest, Side } from "../types/guestSchema";

interface GuestListProps {
  guests: Guest[];
  selectedIds: Set<string>;
  onSelectedChange: (ids: Set<string>) => void;
  onUpdate: (id: string, patch: Partial<NewGuest>) => boolean;
  onRemove: (id: string) => void;
}

type Filter<T extends string> = T | "all";

const PAGE_SIZE = 100;
const COLUMN_COUNT = 11;

// Neo-brutalist theme, same palette as the home page.
const INK = "#111111";
const MINT = "#a8d5b5";
const MUTED = "#4b4b4b";

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    background: "#ffffff",
    border: `2px solid ${INK}`,
    boxShadow: `4px 4px 0 ${INK}`,
    accentColor: INK, // inherited by every checkbox inside
  } satisfies CSSProperties,
  controls: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } satisfies CSSProperties,
  input: {
    padding: "6px 8px",
    fontSize: 12,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: "#fffdf6",
    color: INK,
    fontFamily: "inherit",
    boxSizing: "border-box",
  } satisfies CSSProperties,
  cellInput: { width: "100%", minWidth: 80 } satisfies CSSProperties,
  count: { fontSize: 12, fontWeight: 600, color: MUTED } satisfies CSSProperties,
  tableWrap: { overflowX: "auto", border: `2px solid ${INK}` } satisfies CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 } satisfies CSSProperties,
  th: {
    textAlign: "left",
    padding: "8px 8px",
    background: MINT,
    borderBottom: `2px solid ${INK}`,
    color: INK,
    fontWeight: 700,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  td: {
    padding: "6px 8px",
    borderBottom: "1px solid rgba(17, 17, 17, 0.2)",
    verticalAlign: "middle",
  } satisfies CSSProperties,
  button: {
    padding: "4px 10px",
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 700,
    border: `2px solid ${INK}`,
    borderRadius: 0,
    background: "#ffffff",
    color: INK,
    cursor: "pointer",
  } satisfies CSSProperties,
  empty: { margin: 0, padding: "16px 0", fontSize: 13, color: MUTED, textAlign: "center" } satisfies CSSProperties,
  error: { margin: "4px 0 0", fontSize: 11, fontWeight: 600, color: "#b91c1c" } satisfies CSSProperties,
  pager: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: INK } satisfies CSSProperties,
};

function parseFilter<T extends string>(options: ReadonlyArray<EnumOption<T>>, value: string): Filter<T> {
  return parseOption(options, value) ?? "all";
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: Filter<T>;
  options: ReadonlyArray<EnumOption<T>>;
  onChange: (value: Filter<T>) => void;
}

function FilterSelect<T extends string>({ label, value, options, onChange }: FilterSelectProps<T>) {
  return (
    <select
      aria-label={label}
      value={value}
      style={styles.input}
      onChange={(e) => onChange(parseFilter(options, e.target.value))}
    >
      <option value="all">{`All (${label.toLowerCase()})`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

interface CellSelectProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<EnumOption<T>>;
  onChange: (value: T) => void;
}

function CellSelect<T extends string>({ label, value, options, onChange }: CellSelectProps<T>) {
  return (
    <select
      aria-label={label}
      value={value}
      style={{ ...styles.input, ...styles.cellInput }}
      onChange={(e) => {
        const next = parseOption(options, e.target.value);
        if (next !== undefined) onChange(next);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function toDraft(g: Guest): NewGuest {
  return {
    name: g.name,
    household: g.household,
    side: g.side,
    gender: g.gender,
    age_band: g.age_band,
    role: g.role,
    vip: g.vip,
    mobility: g.mobility,
    dietary: g.dietary,
    notes: g.notes,
  };
}

export default function GuestList({ guests, selectedIds, onSelectedChange, onUpdate, onRemove }: GuestListProps) {
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<Filter<Side>>("all");
  const [gender, setGender] = useState<Filter<Gender>>("all");
  const [ageBand, setAgeBand] = useState<Filter<AgeBand>>("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<NewGuest | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      if (side !== "all" && g.side !== side) return false;
      if (gender !== "all" && g.gender !== gender) return false;
      if (ageBand !== "all" && g.age_band !== ageBand) return false;
      if (attentionOnly && g.vip === "none" && g.mobility === "none" && g.dietary === "none") return false;
      if (
        q !== "" &&
        !(g.name.toLowerCase().includes(q) || g.household.toLowerCase().includes(q) || g.notes.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [guests, query, side, gender, ageBand, attentionOnly]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const allSelected = filtered.length > 0 && filtered.every((g) => selectedIds.has(g.id));
  const someSelected = !allSelected && filtered.some((g) => selectedIds.has(g.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) for (const g of filtered) next.delete(g.id);
    else for (const g of filtered) next.add(g.id);
    onSelectedChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const startEdit = (g: Guest) => {
    setEditingId(g.id);
    setEditDraft(toDraft(g));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    setEditError(null);
  };

  const saveEdit = (id: string) => {
    if (!editDraft) return;
    const result = newGuestSchema.safeParse(editDraft);
    if (!result.success) {
      setEditError(result.error.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`).join(" "));
      return;
    }
    if (onUpdate(id, result.data)) cancelEdit();
    else setEditError("Could not save changes.");
  };

  const patchDraft = (patch: Partial<NewGuest>) => setEditDraft((d) => (d ? { ...d, ...patch } : d));
  const filterActive = filtered.length !== guests.length;

  return (
    <section style={styles.wrap} aria-label="Guest list">
      <div style={styles.controls}>
        <input
          type="search"
          aria-label="Search guests"
          placeholder="Search name, household, notes"
          value={query}
          style={{ ...styles.input, minWidth: 220 }}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <FilterSelect
          label="Side"
          value={side}
          options={SIDES}
          onChange={(v) => {
            setSide(v);
            setPage(0);
          }}
        />
        <FilterSelect
          label="Gender"
          value={gender}
          options={GENDERS}
          onChange={(v) => {
            setGender(v);
            setPage(0);
          }}
        />
        <FilterSelect
          label="Age band"
          value={ageBand}
          options={AGE_BANDS}
          onChange={(v) => {
            setAgeBand(v);
            setPage(0);
          }}
        />
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={attentionOnly}
            onChange={(e) => {
              setAttentionOnly(e.target.checked);
              setPage(0);
            }}
          />
          Attention only
        </label>
        <span style={styles.count}>
          {filterActive ? `${filtered.length} of ${guests.length} guests` : `${guests.length} guests`}
        </span>
      </div>

      {guests.length === 0 ? (
        <p style={styles.empty}>No guests yet. Add one above or import a list.</p>
      ) : filtered.length === 0 ? (
        <p style={styles.empty}>No guests match the current search and filters.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  <input
                    type="checkbox"
                    aria-label="Select all filtered guests"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Household</th>
                <th style={styles.th}>Side</th>
                <th style={styles.th}>Gender</th>
                <th style={styles.th}>Age band</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>VIP</th>
                <th style={styles.th}>Mobility</th>
                <th style={styles.th}>Dietary</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) =>
                editingId === g.id && editDraft ? (
                  <Fragment key={g.id}>
                    <tr>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${g.name}`}
                          checked={selectedIds.has(g.id)}
                          onChange={() => toggleOne(g.id)}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          type="text"
                          aria-label="Name"
                          value={editDraft.name}
                          style={{ ...styles.input, ...styles.cellInput }}
                          onChange={(e) => patchDraft({ name: e.target.value })}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          type="text"
                          aria-label="Household"
                          value={editDraft.household}
                          style={{ ...styles.input, ...styles.cellInput }}
                          onChange={(e) => patchDraft({ household: e.target.value })}
                        />
                      </td>
                      <td style={styles.td}>
                        <CellSelect label="Side" value={editDraft.side} options={SIDES} onChange={(v) => patchDraft({ side: v })} />
                      </td>
                      <td style={styles.td}>
                        <CellSelect label="Gender" value={editDraft.gender} options={GENDERS} onChange={(v) => patchDraft({ gender: v })} />
                      </td>
                      <td style={styles.td}>
                        <CellSelect label="Age band" value={editDraft.age_band} options={AGE_BANDS} onChange={(v) => patchDraft({ age_band: v })} />
                      </td>
                      <td style={styles.td}>
                        <CellSelect label="Role" value={editDraft.role} options={ROLES} onChange={(v) => patchDraft({ role: v })} />
                      </td>
                      <td style={styles.td}>
                        <CellSelect label="VIP" value={editDraft.vip} options={VIP_LEVELS} onChange={(v) => patchDraft({ vip: v })} />
                      </td>
                      <td style={styles.td}>
                        <CellSelect label="Mobility" value={editDraft.mobility} options={MOBILITY_LEVELS} onChange={(v) => patchDraft({ mobility: v })} />
                      </td>
                      <td style={styles.td}>
                        <CellSelect label="Dietary" value={editDraft.dietary} options={DIETARY_OPTIONS} onChange={(v) => patchDraft({ dietary: v })} />
                      </td>
                      <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                        <button type="button" style={styles.button} onClick={() => saveEdit(g.id)}>
                          Save
                        </button>{" "}
                        <button type="button" style={styles.button} onClick={cancelEdit}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td style={styles.td} />
                      <td style={styles.td} colSpan={COLUMN_COUNT - 1}>
                        <input
                          type="text"
                          aria-label="Notes"
                          placeholder="Notes"
                          value={editDraft.notes}
                          style={{ ...styles.input, width: "100%" }}
                          onChange={(e) => patchDraft({ notes: e.target.value })}
                        />
                        {editError ? (
                          <p role="alert" style={styles.error}>
                            {editError}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  </Fragment>
                ) : (
                  <tr key={g.id}>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${g.name}`}
                        checked={selectedIds.has(g.id)}
                        onChange={() => toggleOne(g.id)}
                      />
                    </td>
                    <td style={styles.td} title={g.notes === "" ? undefined : g.notes}>
                      {g.name}
                    </td>
                    <td style={styles.td}>{g.household}</td>
                    <td style={styles.td}>{optionLabel(SIDES, g.side)}</td>
                    <td style={styles.td}>{optionLabel(GENDERS, g.gender)}</td>
                    <td style={styles.td}>{optionLabel(AGE_BANDS, g.age_band)}</td>
                    <td style={styles.td}>{optionLabel(ROLES, g.role)}</td>
                    <td style={styles.td}>{optionLabel(VIP_LEVELS, g.vip)}</td>
                    <td style={styles.td}>{optionLabel(MOBILITY_LEVELS, g.mobility)}</td>
                    <td style={styles.td}>{optionLabel(DIETARY_OPTIONS, g.dietary)}</td>
                    <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                      <button type="button" style={styles.button} onClick={() => startEdit(g)}>
                        Edit
                      </button>{" "}
                      <button type="button" style={styles.button} onClick={() => onRemove(g.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > PAGE_SIZE ? (
        <div style={styles.pager}>
          <button type="button" style={styles.button} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            Prev
          </button>
          <span>
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            type="button"
            style={styles.button}
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}