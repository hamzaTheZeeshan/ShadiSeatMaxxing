import { useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { MAX_GUESTS, MAX_IMPORT_CHARS } from "../types/guestSchema";
import type { GuestParseResult, ImportedGuest } from "../types/guestSchema";
import { parseGuestCsv, CSV_TEMPLATE } from "../utils/guestCsv";
import { GUEST_JSON_TEMPLATE, SAMPLE_200_GUESTS_JSON, parseGuestJson } from "../utils/guestJson";

type ImportMode = "append" | "replace";

interface GuestImportProps {
  onImport: (items: ImportedGuest[], mode: ImportMode) => { added: number; reassignedIds: number } | null;
  hasGuests: boolean;
}

interface ResultState {
  ok: boolean;
  message: string;
  errors: string[];
}

const MAX_SHOWN_ERRORS = 50;

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
  } satisfies CSSProperties,
  heading: { margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } satisfies CSSProperties,
  label: { fontSize: 13, fontWeight: 600, color: "#111827" } satisfies CSSProperties,
  input: {
    padding: "6px 8px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    fontFamily: "inherit",
  } satisfies CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 90,
    boxSizing: "border-box",
    padding: 8,
    fontSize: 13,
    fontFamily: "ui-monospace, monospace",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    resize: "vertical",
  } satisfies CSSProperties,
  button: {
    padding: "6px 12px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
  } satisfies CSSProperties,
  highlightButton: {
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    border: "1px solid #2563eb",
    borderRadius: 6,
    background: "#eff6ff",
    color: "#1d4ed8",
    cursor: "pointer",
  } satisfies CSSProperties,
  errorList: {
    margin: 0,
    padding: "8px 8px 8px 24px",
    maxHeight: 160,
    overflowY: "auto",
    fontSize: 12,
    color: "#b91c1c",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 6,
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

// Unknown extension: try JSON first, fall back to CSV when the text is not JSON at all.
function parseUnknown(text: string): GuestParseResult {
  const json = parseGuestJson(text);
  if (json.errors[0]?.startsWith("Invalid JSON")) return parseGuestCsv(text);
  return json;
}

function countSkipped(errors: string[]): number {
  const keys = new Set<string>();
  for (const line of errors) {
    const match = /^guests\[(\d+)\]/.exec(line) ?? /^Row (\d+):/.exec(line);
    if (match) keys.add(match[0]);
  }
  return keys.size;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export default function GuestImport({ onImport, hasGuests }: GuestImportProps) {
  const [mode, setMode] = useState<ImportMode>("append");
  const [pasteText, setPasteText] = useState("");
  const [result, setResult] = useState<ResultState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveMode: ImportMode = hasGuests ? mode : "append";

  // Returns true when guests were imported.
  const finish = (parsed: GuestParseResult): boolean => {
    if (parsed.guests.length === 0) {
      setResult({
        ok: false,
        message: "No guests were imported.",
        errors: parsed.errors.length > 0 ? parsed.errors : ["No guests found in the input."],
      });
      return false;
    }
    if (effectiveMode === "replace" && !window.confirm("Replace the existing guest list with the imported guests?")) {
      setResult({ ok: false, message: "Import cancelled. Nothing was changed.", errors: [] });
      return false;
    }
    const outcome = onImport(parsed.guests, effectiveMode);
    if (outcome === null) {
      setResult({
        ok: false,
        message: `Import rejected: the list would exceed ${MAX_GUESTS} guests. Nothing was changed.`,
        errors: [],
      });
      return false;
    }
    let message = `Imported ${outcome.added} ${plural(outcome.added, "guest", "guests")}.`;
    if (outcome.reassignedIds > 0) {
      message += ` ${outcome.reassignedIds} ${plural(outcome.reassignedIds, "id was", "ids were")} reassigned.`;
    }
    const skipped = countSkipped(parsed.errors);
    if (skipped > 0) message += ` ${skipped} ${plural(skipped, "entry was", "entries were")} skipped.`;
    setResult({ ok: true, message, errors: parsed.errors });
    return true;
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget; // capture before awaiting
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_CHARS) {
        setResult({ ok: false, message: "File too large (max 2 MB).", errors: [] });
        return;
      }
      const text = await file.text();
      const name = file.name.toLowerCase();
      if (name.endsWith(".json")) finish(parseGuestJson(text));
      else if (name.endsWith(".csv")) finish(parseGuestCsv(text));
      else finish(parseUnknown(text));
    } catch {
      setResult({ ok: false, message: "Could not read the file.", errors: [] });
    } finally {
      input.value = ""; // allow choosing the same file again
    }
  };

  const handlePaste = () => {
    if (pasteText.trim() === "") {
      setResult({ ok: false, message: "Paste some JSON first.", errors: [] });
      return;
    }
    if (finish(parseGuestJson(pasteText))) setPasteText("");
  };

  const shownErrors = result?.errors.slice(0, MAX_SHOWN_ERRORS) ?? [];
  const hiddenErrors = (result?.errors.length ?? 0) - shownErrors.length;

  return (
    <section style={styles.wrap} aria-label="Import guests">
      <h2 style={styles.heading}>Import guests</h2>

      <div style={styles.row}>
        <label style={styles.label} htmlFor="guest-import-mode">
          When importing
        </label>
        <select
          id="guest-import-mode"
          value={effectiveMode}
          disabled={!hasGuests}
          style={styles.input}
          onChange={(e) => setMode(e.target.value === "replace" ? "replace" : "append")}
        >
          <option value="append">Add to existing list</option>
          <option value="replace">Replace existing list</option>
        </select>
      </div>

      <div style={styles.row}>
        <button type="button" style={styles.button} onClick={() => fileInputRef.current?.click()}>
          Choose JSON or CSV file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          style={{ display: "none" }}
          tabIndex={-1}
          aria-label="Import guests file"
          onChange={(e) => {
            void handleFile(e);
          }}
        />
        <button
          type="button"
          style={styles.button}
          onClick={() => downloadTextFile(GUEST_JSON_TEMPLATE, "shadi-maxing-guests-template.json", "application/json")}
        >
          Download JSON template
        </button>
        <button
          type="button"
          style={styles.button}
          onClick={() => downloadTextFile(CSV_TEMPLATE, "shadi-maxing-guests-template.csv", "text/csv")}
        >
          Download CSV template
        </button>
        <button
          type="button"
          style={styles.highlightButton}
          onClick={() =>
            downloadTextFile(SAMPLE_200_GUESTS_JSON, "shadi-maxing-sample-200-guests.json", "application/json")
          }
        >
          Download 200-Guest Sample (for AI Prompting)
        </button>
      </div>

      <div>
        <label style={styles.label} htmlFor="guest-import-paste">
          Paste JSON
        </label>
        <textarea
          id="guest-import-paste"
          value={pasteText}
          style={styles.textarea}
          placeholder='[{"name": "Example Guest"}]'
          onChange={(e) => setPasteText(e.target.value)}
        />
        <button type="button" style={styles.button} onClick={handlePaste}>
          Import
        </button>
      </div>

      <div>
        <p
          role="status"
          style={{ margin: 0, fontSize: 13, color: result === null || result.ok ? "#15803d" : "#b91c1c" }}
        >
          {result?.message ?? ""}
        </p>
        {shownErrors.length > 0 ? (
          <ul style={styles.errorList} aria-label="Import errors">
            {shownErrors.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
            {hiddenErrors > 0 ? <li>{`and ${hiddenErrors} more`}</li> : null}
          </ul>
        ) : null}
      </div>
    </section>
  );
}