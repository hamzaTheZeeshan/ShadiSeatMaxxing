import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import GuestBulkBar from "../features/guests/components/GuestBulkBar";
import GuestForm from "../features/guests/components/GuestForm";
import GuestImport from "../features/guests/components/GuestImport";
import GuestList from "../features/guests/components/GuestList";
import GuestSummary from "../features/guests/components/GuestSummary";
import { useGuestStore } from "../features/guests/store/guestStore";
import type { ImportedGuest, NewGuest } from "../features/guests/types/guestSchema";
import { exportGuestsCsv } from "../features/guests/utils/guestCsv";
import { serializeGuests } from "../features/guests/utils/guestJson";
import { loadGuestsFromStorage, saveGuestsToStorage } from "../features/guests/utils/guestPersistence";
import { computeGuestStats, totalTableSeats } from "../features/guests/utils/guestStats";
import { useEditorStore } from "../features/hall-designer/store/editorStore";

interface Status {
  kind: "success" | "error";
  text: string;
}

const STATUS_TIMEOUT_MS = 4000;

const styles = {
  page: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "32px 16px",
  } satisfies CSSProperties,
  inner: { maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  heading: { margin: 0, fontSize: 28, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  intro: { margin: 0, fontSize: 15, color: "#4b5563" } satisfies CSSProperties,
  importRow: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 } satisfies CSSProperties,
  importMain: { flex: "2 1 520px", minWidth: 0 } satisfies CSSProperties,
  tip: {
    flex: "1 1 260px",
    minWidth: 0,
    boxSizing: "border-box",
    padding: 16,
    fontSize: 14,
    lineHeight: 1.5,
    color: "#1e3a8a",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
  } satisfies CSSProperties,
  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } satisfies CSSProperties,
  button: {
    padding: "8px 14px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
  } satisfies CSSProperties,
  danger: {
    padding: "8px 14px",
    fontSize: 13,
    border: "1px solid #b91c1c",
    borderRadius: 6,
    background: "#ffffff",
    color: "#b91c1c",
    cursor: "pointer",
  } satisfies CSSProperties,
  status: { fontSize: 13, minHeight: 18, whiteSpace: "pre-line" } satisfies CSSProperties,
  back: {
    alignSelf: "flex-start",
    display: "inline-block",
    padding: "8px 16px",
    fontSize: 14,
    borderRadius: 6,
    background: "#111827",
    color: "#ffffff",
    textDecoration: "none",
  } satisfies CSSProperties,
};

function downloadTextFile(content: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function plural(n: number): string {
  return n === 1 ? "guest" : "guests";
}

export default function GuestsPage() {
  const guests = useGuestStore((s) => s.guests);
  const objects = useEditorStore((s) => s.objects);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<Status | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const showStatus = (kind: Status["kind"], text: string) => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setStatus({ kind, text });
    timeoutRef.current = setTimeout(() => {
      setStatus(null);
      timeoutRef.current = null;
    }, STATUS_TIMEOUT_MS);
  };

  const stats = useMemo(() => computeGuestStats(guests, totalTableSeats(objects)), [guests, objects]);

  // Selection never contains ids that no longer exist.
  const selected = useMemo(() => {
    const present = new Set(guests.map((g) => g.id));
    return new Set([...selectedIds].filter((id) => present.has(id)));
  }, [guests, selectedIds]);

  const handleAdd = (g: NewGuest): boolean => useGuestStore.getState().addGuest(g);

  const handleUpdate = (id: string, patch: Partial<NewGuest>): boolean => useGuestStore.getState().updateGuest(id, patch);

  const handleRemove = (id: string) => {
    useGuestStore.getState().removeGuest(id);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleBulkApply = (patch: Partial<NewGuest>) => {
    const changed = useGuestStore.getState().updateGuests([...selected], patch);
    if (changed > 0) showStatus("success", `Updated ${changed} ${plural(changed)}.`);
    else showStatus("error", "Could not apply the changes.");
  };

  const handleBulkRemove = () => {
    const removed = useGuestStore.getState().removeGuests([...selected]);
    setSelectedIds(new Set());
    showStatus("success", `Removed ${removed} ${plural(removed)}.`);
  };

  const handleImport = (items: ImportedGuest[], mode: "append" | "replace") => {
    const outcome = useGuestStore.getState().importGuests(items, mode);
    if (outcome !== null && mode === "replace") setSelectedIds(new Set());
    return outcome;
  };

  const handleExportJson = () => {
    if (guests.length === 0) {
      showStatus("error", "No guests to export.");
      return;
    }
    try {
      downloadTextFile(serializeGuests(guests), "shadi-maxing-guests.json", "application/json");
      showStatus("success", `Exported ${guests.length} ${plural(guests.length)}.`);
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Could not export guests.");
    }
  };

  const handleExportCsv = () => {
    if (guests.length === 0) {
      showStatus("error", "No guests to export.");
      return;
    }
    try {
      // BOM so Excel reads non-ASCII (e.g. Urdu) names as UTF-8; the CSV parser strips it again.
      downloadTextFile(`\uFEFF${exportGuestsCsv(guests)}`, "shadi-maxing-guests.csv", "text/csv;charset=utf-8");
      showStatus("success", `Exported ${guests.length} ${plural(guests.length)}.`);
    } catch (err) {
      showStatus("error", err instanceof Error ? err.message : "Could not export guests.");
    }
  };

  const handleSave = () => {
    const result = saveGuestsToStorage(useGuestStore.getState().guests);
    if (result.ok) showStatus("success", "Guests saved to browser.");
    else showStatus("error", result.error);
  };

  const handleLoad = () => {
    const result = loadGuestsFromStorage();
    if (!result.ok) {
      showStatus("error", result.error); // nothing changes
      return;
    }
    if (useGuestStore.getState().replaceGuests(result.value)) {
      setSelectedIds(new Set());
      showStatus("success", `Loaded ${result.value.length} ${plural(result.value.length)} from browser.`);
    } else {
      showStatus("error", "The saved guest list is not valid.");
    }
  };

  const handleClear = () => {
    if (guests.length === 0) return;
    if (!window.confirm(`Remove all ${guests.length} guests?`)) return;
    useGuestStore.getState().clearGuests();
    setSelectedIds(new Set());
    showStatus("success", "All guests removed.");
  };

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.heading}>Guests</h1>
        <p style={styles.intro}>Add guests one by one, or import a whole list from JSON or CSV.</p>

        <GuestSummary stats={stats} />
        <GuestForm onAdd={handleAdd} />

        <div style={styles.importRow}>
          <div style={styles.importMain}>
            <GuestImport onImport={handleImport} hasGuests={guests.length > 0} />
          </div>
          <aside style={styles.tip} aria-label="Import tip">
            💡 <strong>Tip:</strong> Take a photo of your handwritten guest notes, download our sample JSON format,
            and give both to an AI (ChatGPT/Claude) to instantly format your entire list!
          </aside>
        </div>

        <div style={styles.toolbar}>
          <button type="button" style={styles.button} onClick={handleExportJson}>
            Export JSON
          </button>
          <button type="button" style={styles.button} onClick={handleExportCsv}>
            Export CSV
          </button>
          <button type="button" style={styles.button} onClick={handleSave}>
            Save to browser
          </button>
          <button type="button" style={styles.button} onClick={handleLoad}>
            Load from browser
          </button>
          <button type="button" style={styles.danger} onClick={handleClear}>
            Clear all
          </button>
          <span
            role="status"
            style={{ ...styles.status, color: status?.kind === "error" ? "#b91c1c" : "#15803d" }}
          >
            {status?.text ?? ""}
          </span>
        </div>

        <GuestBulkBar
          selectedCount={selected.size}
          onApply={handleBulkApply}
          onRemove={handleBulkRemove}
          onClear={() => setSelectedIds(new Set())}
        />
        <GuestList
          guests={guests}
          selectedIds={selected}
          onSelectedChange={setSelectedIds}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
        />

        <Link to="/designer" style={styles.back}>
          Back: Hall
        </Link>
      </div>
    </div>
  );
}