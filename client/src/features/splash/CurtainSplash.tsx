import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { hasSeenSplash, markSplashSeen, prefersReducedMotion } from "./splashSession";

type Phase = "closed" | "opening" | "done";

const HOLD_MS = 600;
const OPEN_MS = 1400;

const MAROON = "#5a0f1e";
const GOLD = "#d4af37";

const KEYFRAMES = "@keyframes shadiSplashTitleIn{from{opacity:0}to{opacity:1}}";

const FOLDS =
  "repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0) 20px, rgba(255,255,255,0.07) 40px, rgba(0,0,0,0.28) 60px)";

const styles = {
  root: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    overflow: "hidden",
    pointerEvents: "auto",
    cursor: "pointer",
  } satisfies CSSProperties,
  valance: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    background: `linear-gradient(180deg, ${GOLD}, #a8841f)`,
    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
  } satisfies CSSProperties,
  skip: {
    position: "absolute",
    right: 16,
    bottom: 16,
    zIndex: 3,
    padding: "8px 16px",
    fontSize: 14,
    fontFamily: "system-ui, sans-serif",
    color: GOLD,
    background: "rgba(0,0,0,0.35)",
    border: `1px solid ${GOLD}`,
    borderRadius: 6,
    cursor: "pointer",
  } satisfies CSSProperties,
};

function panelStyle(side: "left" | "right", phase: Phase): CSSProperties {
  const opening = phase === "opening";
  const offscreen = side === "left" ? "translateX(-100%)" : "translateX(100%)";
  return {
    position: "absolute",
    top: 0,
    bottom: 0,
    [side]: 0,
    width: "50%",
    background: `${FOLDS}, ${MAROON}`,
    [side === "left" ? "borderRight" : "borderLeft"]: `3px solid ${GOLD}`,
    boxSizing: "border-box",
    transform: opening ? offscreen : "translateX(0)",
    transition: opening ? `transform ${OPEN_MS}ms ease-in-out` : "none",
    willChange: opening ? "transform" : "auto",
  };
}

function titleStyle(phase: Phase): CSSProperties {
  const opening = phase === "opening";
  return {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    margin: 0,
    padding: "0 16px",
    textAlign: "center",
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: "clamp(32px, 7vw, 72px)",
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: GOLD,
    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
    opacity: opening ? 0 : 1,
    animation: opening ? "none" : "shadiSplashTitleIn 500ms ease-out",
    transition: opening ? `opacity ${HOLD_MS}ms ease-in` : "none",
  };
}

export default function CurtainSplash() {
  const [phase, setPhase] = useState<Phase>(() =>
    !hasSeenSplash() && !prefersReducedMotion() ? "closed" : "done",
  );
  const markedRef = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  const markOnce = () => {
    if (markedRef.current) return;
    markedRef.current = true;
    markSplashSeen();
  };

  const skip = () => {
    markOnce();
    setPhase("done");
  };

  // closed -> opening
  useEffect(() => {
    if (phase !== "closed") return;
    const id = setTimeout(() => setPhase("opening"), HOLD_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // opening -> done; mark seen when the opening starts
  useEffect(() => {
    if (phase !== "opening") return;
    if (!markedRef.current) {
      markedRef.current = true;
      markSplashSeen();
    }
    const id = setTimeout(() => setPhase("done"), OPEN_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // keyboard skip while visible
  useEffect(() => {
    if (phase === "done") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!markedRef.current) {
          markedRef.current = true;
          markSplashSeen();
        }
        setPhase("done");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

  // move focus into the dialog while it is visible
  useEffect(() => {
    if (phase === "closed") skipRef.current?.focus();
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome" style={styles.root} onClick={skip}>
      <style>{KEYFRAMES}</style>
      <div style={panelStyle("left", phase)}>
        <div style={styles.valance} />
      </div>
      <div style={panelStyle("right", phase)}>
        <div style={styles.valance} />
      </div>
      <h1 style={titleStyle(phase)}>Shadi Maxing</h1>
      <button
        ref={skipRef}
        type="button"
        aria-label="Skip intro"
        style={styles.skip}
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
      >
        Skip
      </button>
    </div>
  );
}