import type { CheckItem, CheckStatus } from "../utils/constraintReport";
import { badgeStyle, MUTED } from "../ui";
import type { Tone } from "../ui";

const LABELS: Record<CheckStatus, string> = { satisfied: "OK", broken: "Broken", info: "Info" };

function toneOf(item: CheckItem): Tone {
  if (item.status === "satisfied") return "good";
  if (item.status === "broken") return item.severity === "hard" ? "bad" : "warn";
  return "neutral";
}

interface Props {
  items: readonly CheckItem[];
  emptyText?: string;
}

export default function CheckList({ items, emptyText = "No constraints apply." }: Props) {
  if (items.length === 0) return <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{emptyText}</p>;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
      {items.map((item) => (
        <li key={item.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 8, fontSize: 12 }}>
          <span style={{ ...badgeStyle(toneOf(item)), alignSelf: "start", textAlign: "center" }}>{LABELS[item.status]}</span>
          <span>
            <strong>{item.title}</strong>
            <br />
            <span style={{ color: MUTED }}>{item.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}