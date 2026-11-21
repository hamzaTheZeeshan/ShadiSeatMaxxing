import { useMemo, useState } from "react";
import { tabStyle, ui } from "../ui";

export interface JsonTab {
  id: string;
  label: string;
  data: unknown;
}

interface Props {
  tabs: readonly JsonTab[];
}

export default function RawJsonInspector({ tabs }: Props) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  // Only stringify while expanded: payloads can be large.
  const text = useMemo(() => (open && active ? JSON.stringify(active.data, null, 2) : ""), [open, active]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    if (!active) return;
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section style={ui.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ ...ui.h2, margin: 0 }}>Raw JSON inspector</h2>
        <button type="button" style={ui.button} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Collapse" : "Expand"}
        </button>
      </div>

      {open && active ? (
        <>
          <div style={{ ...ui.toolbar, marginTop: 12 }}>
            {tabs.map((t) => (
              <button key={t.id} type="button" style={tabStyle(t.id === active.id)} onClick={() => setActiveId(t.id)}>
                {t.label}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <button type="button" style={ui.button} onClick={() => void copy()}>
              {copied ? "Copied!" : "Copy"}
            </button>
            <button type="button" style={ui.button} onClick={download}>
              Download .json
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: 16,
              fontFamily: "inherit",
              border: "2px solid #111111",
              background: "#111111",
              color: "#fff4dc",
              fontSize: 12,
              lineHeight: 1.5,
              overflow: "auto",
              maxHeight: 480,
            }}
          >
            {text}
          </pre>
        </>
      ) : null}
    </section>
  );
}