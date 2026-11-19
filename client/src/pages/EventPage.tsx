import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import EventForm from "../features/event/components/EventForm";
import { useEventStore } from "../features/event/store/eventStore";
import { loadEventFromStorage, saveEventToStorage } from "../features/event/utils/eventPersistence";

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
  inner: { maxWidth: 640, margin: "0 auto" } satisfies CSSProperties,
  heading: { margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  intro: { margin: "0 0 20px", fontSize: 15, color: "#4b5563" } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 16,
  } satisfies CSSProperties,
  button: {
    padding: "8px 16px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
  } satisfies CSSProperties,
  status: { fontSize: 13, minHeight: 18, whiteSpace: "pre-line" } satisfies CSSProperties,
  next: {
    display: "inline-block",
    marginTop: 20,
    padding: "8px 16px",
    fontSize: 14,
    borderRadius: 6,
    background: "#111827",
    color: "#ffffff",
    textDecoration: "none",
  } satisfies CSSProperties,
};

export default function EventPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [formVersion, setFormVersion] = useState(0); // bumped on Load so the form re-inits from the store
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

  const handleSave = () => {
    const result = saveEventToStorage(useEventStore.getState().event);
    if (result.ok) showStatus("success", "Event saved to browser.");
    else showStatus("error", result.error);
  };

  const handleLoad = () => {
    const result = loadEventFromStorage();
    if (result.ok) {
      useEventStore.getState().setEvent(result.value);
      setFormVersion((v) => v + 1);
      showStatus("success", "Event loaded from browser.");
    } else {
      showStatus("error", result.error); // nothing changes
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.heading}>Event details</h1>
        <p style={styles.intro}>Tell us about the event you are planning the hall for.</p>
        <EventForm key={formVersion} />
        <div style={styles.row}>
          <button type="button" style={styles.button} onClick={handleSave}>
            Save to browser
          </button>
          <button type="button" style={styles.button} onClick={handleLoad}>
            Load from browser
          </button>
          <span
            role="status"
            style={{ ...styles.status, color: status?.kind === "error" ? "#b91c1c" : "#15803d" }}
          >
            {status?.text ?? ""}
          </span>
        </div>
        <Link to="/designer" style={styles.next}>
          Next: Hall
        </Link>
      </div>
    </div>
  );
}