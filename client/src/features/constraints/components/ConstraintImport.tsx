import { useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { parseOption } from "../../guests/types/guestSchema";
import type { EnumOption } from "../../guests/types/guestSchema";
import { useGuestStore } from "../../guests/store/guestStore";
import { useEditorStore } from "../../hall-designer/store/editorStore";
import { useConstraintStore } from "../store/constraintStore";
import { DEFAULT_SETTINGS } from "../types/constraintSchema";
import {
  CONSTRAINT_JSON_TEMPLATE,
  MAX_CONSTRAINT_JSON_BYTES,
  parseConstraintsJson,
  serializeConstraints,
} from "../utils/constraintJson";
import { summarizeLayout } from "../utils/layoutSummary";

type ImportMode = "replace" | "append";

const MODES: ReadonlyArray<EnumOption<ImportMode>> = [
  { value: "replace", label: "Replace everything" },
  { value: "append", label: "Add rules only" },
];

interface Status {
  ok: boolean;
  lines: string[];
}

const styles = {
  section: { margin: "0 0 24px", padding: 16, border: "1px solid #d1d5db", borderRadius: 10, background: "#ffffff" } satisfies CSSProperties,
  heading: { margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12, fontSize: 14 } satisfies CSSProperties,
  textarea: { width: "100%", maxWidth: 640, minHeight: 120, padding: 8, fontFamily: "monospace", fontSize: 13, boxSizing: "border-box" } satisfies CSSProperties,
  status: { margin: "12px 0 0", fontSize: 14 } satisfies CSSProperties,
};

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function ConstraintImport() {
  const [mode, setMode] = useState<ImportMode>("replace");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function runImport(source: string) {
    const { data, errors } = parseConstraintsJson(source);
    if (data === null) {
      setStatus({ ok: false, lines: errors });
      return;
    }
    const store = useConstraintStore.getState();
    const guestIds = new Set(useGuestStore.getState().guests.map((g) => g.id));
    const lines: string[] = [];

    if (mode === "replace") {
      const hasExisting =
        store.rules.length > 0 ||
        Object.keys(store.zones).length > 0 ||
        JSON.stringify(store.settings) !== JSON.stringify(DEFAULT_SETTINGS);
      if (hasExisting && !window.confirm("Replace all current settings, zones and rules with the imported data?")) return;
      if (!store.replaceAll(data)) {
        setStatus({ ok: false, lines: ["Import failed. Nothing was changed."] });
        return;
      }
      lines.push(`Imported ${data.rules.length} rules.`);
      const tableIds = new Set(summarizeLayout(useEditorStore.getState().objects).tables.map((t) => t.id));
      const unknownTables = Object.keys(data.zones).filter((id) => !tableIds.has(id)).length;
      if (unknownTables > 0) {
        lines.push(`${unknownTables} zone ${unknownTables === 1 ? "entry refers" : "entries refer"} to tables that are not in the current hall.`);
      }
    } else {
      const result = store.importRules(
        data.rules.map((r) => ({
          kind: r.kind,
          strength: r.strength,
          weight: r.weight,
          guest_ids: r.guest_ids,
          note: r.note,
        })),
      );
      if (result === null) {
        setStatus({ ok: false, lines: ["Could not add the rules (too many rules). Nothing was changed."] });
        return;
      }
      lines.push(`Imported ${result.added} rules.`);
    }

    const unknownGuests = data.rules.filter((r) => r.guest_ids.some((id) => !guestIds.has(id))).length;
    if (unknownGuests > 0) {
      lines.push(`${unknownGuests} ${unknownGuests === 1 ? "rule refers" : "rules refer"} to guests that are not in the guest list.`);
    }
    setStatus({ ok: true, lines });
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_CONSTRAINT_JSON_BYTES) {
        setStatus({ ok: false, lines: ["File too large (max 2 MB)"] });
      } else {
        try {
          runImport(await file.text());
        } catch {
          setStatus({ ok: false, lines: ["Could not read the file."] });
        }
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function exportCurrent() {
    const { settings, zones, rules } = useConstraintStore.getState();
    downloadText("constraints.json", serializeConstraints({ version: 1, settings, zones, rules }));
  }

  return (
    <section style={styles.section} aria-labelledby="constraint-import-heading">
      <h2 id="constraint-import-heading" style={styles.heading}>
        Import and export
      </h2>
      <div style={styles.row}>
        <label>
          Mode{" "}
          <select
            value={mode}
            onChange={(e) => {
              const next = parseOption(MODES, e.target.value);
              if (next) setMode(next);
            }}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          JSON file <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} />
        </label>
      </div>
      <label htmlFor="constraint-paste">Or paste JSON</label>
      <div>
        <textarea
          id="constraint-paste"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={styles.textarea}
        />
      </div>
      <div style={styles.row}>
        <button type="button" onClick={() => runImport(text)} disabled={text.trim() === ""}>
          Import pasted JSON
        </button>
        <button type="button" onClick={() => downloadText("constraints-template.json", CONSTRAINT_JSON_TEMPLATE)}>
          Download template
        </button>
        <button type="button" onClick={exportCurrent}>
          Export current JSON
        </button>
      </div>
      <div role="status" style={{ ...styles.status, color: status && !status.ok ? "#b91c1c" : "#15803d" }}>
        {status?.lines.map((line) => <div key={line}>{line}</div>)}
      </div>
    </section>
  );
}