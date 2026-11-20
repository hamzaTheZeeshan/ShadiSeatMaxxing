import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { hasSeenSplash, markSplashSeen, prefersReducedMotion } from "./splashSession";

// NOTE: file/component name kept as CurtainSplash so your existing imports keep working.
// It is now a pure CSS heart-emoji intro (no three.js needed).

type Phase = "closed" | "opening" | "done";

const HOLD_MS = 1500; // hearts float + title pops in
const OPEN_MS = 1900; // burst + big rush of hearts, then fade to the app

// --- Theme (matches HomePage) -------------------------------------------------
const ACCENT = "#ff2e5b";
const ROSE_DEEP = "#be123c";
const BLUSH = "#fff1f3";
const FONT = "'Poppins', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const EMOJI_FONT = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const HEARTS = ["❤️", "💖", "💗", "💕", "💘", "💝", "🩷", "💓"];

// Deterministic pseudo-random so nothing jumps between renders
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const pick = (i: number, k: number) => HEARTS[Math.floor(rnd(i, k) * HEARTS.length)];

// Ambient hearts: always floating bottom -> top (negative delay = already spread on screen)
const AMBIENT = Array.from({ length: 18 }, (_, i) => {
  const duration = 4200 + rnd(i, 1) * 2600;
  return {
    char: pick(i, 2),
    left: rnd(i, 3) * 100,
    size: 22 + rnd(i, 4) * 34,
    duration,
    delay: -rnd(i, 5) * duration,
    sway: 14 + rnd(i, 6) * 26,
  };
});

// Rush hearts: a big upward wave when the intro opens
const RUSH = Array.from({ length: 36 }, (_, i) => ({
  char: pick(i + 40, 2),
  left: rnd(i + 40, 3) * 100,
  size: 24 + rnd(i + 40, 4) * 46,
  duration: 1300 + rnd(i + 40, 5) * 900,
  delay: rnd(i + 40, 6) * 700,
  sway: 10 + rnd(i + 40, 7) * 30,
}));

// Burst hearts: pop outward from the centre
const BURST = Array.from({ length: 26 }, (_, i) => {
  const angle = (i / 26) * Math.PI * 2 + rnd(i + 90, 1) * 0.3;
  const dist = 26 + rnd(i + 90, 2) * 32;
  return {
    char: pick(i + 90, 3),
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist,
    size: 22 + rnd(i + 90, 4) * 32,
    duration: 900 + rnd(i + 90, 5) * 600,
    delay: rnd(i + 90, 6) * 160,
    spin: (rnd(i + 90, 7) - 0.5) * 70,
  };
});

const KEYFRAMES =
  // overall fade out at the end of the opening phase
  "@keyframes shadiSplashFade{0%,82%{opacity:1}100%{opacity:0}}" +
  // heart travel: glide bottom -> top, fade in near the bottom and out near the top
  "@keyframes shadiHeartRise{0%{opacity:0;transform:translate3d(0,0,0)}8%{opacity:1}82%{opacity:1}100%{opacity:0;transform:translate3d(0,-125vh,0)}}" +
  // gentle side-to-side glide
  "@keyframes shadiHeartSway{0%,100%{transform:translateX(calc(var(--sway) * -1px)) rotate(-12deg)}50%{transform:translateX(calc(var(--sway) * 1px)) rotate(12deg)}}" +
  // pop in at the start of each journey
  "@keyframes shadiHeartPop{0%{transform:scale(0)}7%{transform:scale(1.4)}12%{transform:scale(0.92)}17%,100%{transform:scale(1)}}" +
  // radial burst from the centre
  "@keyframes shadiHeartBurst{0%{opacity:0;transform:translate(-50%,-50%) scale(0) rotate(0deg)}14%{opacity:1;transform:translate(-50%,-50%) scale(1.5) rotate(0deg)}100%{opacity:0;transform:translate(calc(-50% + var(--dx) * 1vmin),calc(-50% + var(--dy) * 1vmin)) scale(0.8) rotate(calc(var(--spin) * 1deg))}}" +
  // big centre heart: heartbeat while waiting
  "@keyframes shadiBeat{0%,100%{transform:translate(-50%,-50%) scale(1)}18%{transform:translate(-50%,-50%) scale(1.12)}32%{transform:translate(-50%,-50%) scale(1)}46%{transform:translate(-50%,-50%) scale(1.07)}60%{transform:translate(-50%,-50%) scale(1)}}" +
  // big centre heart: bursts open and fades
  "@keyframes shadiBigBurst{0%{opacity:0.3;transform:translate(-50%,-50%) scale(1)}25%{opacity:0.4;transform:translate(-50%,-50%) scale(1.25)}100%{opacity:0;transform:translate(-50%,-50%) scale(6)}}" +
  "@keyframes shadiTitlePop{0%{opacity:0;transform:scale(0.75)}60%{opacity:1;transform:scale(1.07)}100%{opacity:1;transform:scale(1)}}" +
  "@keyframes shadiRingBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}" +
  "@keyframes shadiSplashHint{0%,100%{opacity:0.5}50%{opacity:1}}";

// --- Styles ------------------------------------------------------------------
const styles = {
  stage: {
    position: "absolute",
    inset: 0,
    background: `radial-gradient(ellipse at 50% 55%, #ffffff 0%, ${BLUSH} 40%, #ffc2d1 100%)`,
  } satisfies CSSProperties,
  layer: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
  } satisfies CSSProperties,
  hint: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 36,
    zIndex: 3,
    textAlign: "center",
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: "0.08em",
    color: ROSE_DEEP,
    pointerEvents: "none",
    animation: "shadiSplashHint 2s ease-in-out infinite",
  } satisfies CSSProperties,
  skip: {
    position: "absolute",
    right: 20,
    bottom: 24,
    zIndex: 4,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: FONT,
    color: ACCENT,
    background: "rgba(255, 255, 255, 0.92)",
    border: "1px solid #ffc2d1",
    borderRadius: 999,
    boxShadow: "0 6px 18px rgba(255, 46, 91, 0.25)",
    cursor: "pointer",
  } satisfies CSSProperties,
  ring: {
    fontFamily: EMOJI_FONT,
    fontSize: 44,
    lineHeight: 1,
    marginBottom: 10,
    animation: "shadiRingBounce 1.6s ease-in-out infinite",
  } satisfies CSSProperties,
  h1: {
    margin: 0,
    fontFamily: FONT,
    fontSize: "clamp(38px, 7.5vw, 84px)",
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: "0.01em",
    color: ROSE_DEEP,
    textShadow: "0 2px 0 #ffffff, 0 0 28px rgba(255, 255, 255, 0.95)",
  } satisfies CSSProperties,
  tagline: {
    margin: "14px 0 0",
    fontFamily: FONT,
    fontSize: "clamp(14px, 2.2vw, 20px)",
    fontWeight: 500,
    letterSpacing: "0.03em",
    color: ROSE_DEEP,
    opacity: 0.85,
    textShadow: "0 0 14px rgba(255, 255, 255, 0.95)",
  } satisfies CSSProperties,
};

function rootStyle(phase: Phase): CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    overflow: "hidden",
    pointerEvents: "auto",
    cursor: "pointer",
    animation: phase === "opening" ? `shadiSplashFade ${OPEN_MS}ms linear forwards` : "none",
  };
}

function bigHeartStyle(phase: Phase): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    zIndex: 1,
    fontFamily: EMOJI_FONT,
    fontSize: "clamp(180px, 46vmin, 420px)",
    lineHeight: 1,
    opacity: 0.3,
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    willChange: "transform, opacity",
    animation:
      phase === "opening"
        ? "shadiBigBurst 1000ms cubic-bezier(0.5, 0, 0.9, 0.4) forwards"
        : "shadiBeat 1.4s ease-in-out infinite",
  };
}

function titleStyle(phase: Phase): CSSProperties {
  const opening = phase === "opening";
  return {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    padding: "0 16px",
    textAlign: "center",
    opacity: opening ? 0 : 1,
    animation: opening ? "none" : "shadiTitlePop 800ms cubic-bezier(0.22, 1.4, 0.36, 1) both",
    transition: opening ? "opacity 600ms ease-in 250ms" : "none",
  };
}

interface FloatProps {
  char: string;
  left: number;
  size: number;
  duration: number;
  delay: number;
  sway: number;
  infinite: boolean;
}

// Three nested layers so rise, sway and pop never fight over `transform`.
function FloatingHeart({ char, left, size, duration, delay, sway, infinite }: FloatProps) {
  const iterations = infinite ? "infinite" : 1;
  const ease = infinite ? "linear" : "cubic-bezier(0.2, 0.7, 0.3, 1)";
  return (
    <span
      style={
        {
          position: "absolute",
          left: `${left}%`,
          bottom: -size * 1.5,
          willChange: "transform, opacity",
          animation: `shadiHeartRise ${duration}ms ${ease} ${delay}ms ${iterations} both`,
        } as CSSProperties
      }
    >
      <span
        style={
          {
            display: "block",
            "--sway": sway,
            animation: `shadiHeartSway ${Math.max(1400, duration * 0.45)}ms ease-in-out ${delay}ms infinite`,
          } as CSSProperties
        }
      >
        <span
          style={{
            display: "block",
            fontFamily: EMOJI_FONT,
            fontSize: size,
            lineHeight: 1,
            filter: "drop-shadow(0 4px 8px rgba(255, 46, 91, 0.25))",
            animation: `shadiHeartPop ${duration}ms ease-out ${delay}ms ${iterations} both`,
          }}
        >
          {char}
        </span>
      </span>
    </span>
  );
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
    markOnce();
    const id = setTimeout(() => setPhase("done"), OPEN_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // keyboard skip while visible
  useEffect(() => {
    if (phase === "done") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        skip();
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
    <div role="dialog" aria-modal="true" aria-label="Welcome" style={rootStyle(phase)} onClick={skip}>
      <style>{KEYFRAMES}</style>

      <div style={styles.stage} aria-hidden="true" />

      {/* Big beating heart behind the title */}
      <div style={bigHeartStyle(phase)} aria-hidden="true">
        💖
      </div>

      {/* Ambient hearts floating bottom -> top (same elements in both phases, so no restart) */}
      <div style={styles.layer} aria-hidden="true">
        {AMBIENT.map((h, i) => (
          <FloatingHeart key={i} {...h} infinite />
        ))}
      </div>

      {/* Title */}
      <div style={titleStyle(phase)}>
        <div style={styles.ring} aria-hidden="true">
          💍
        </div>
        <h1 style={styles.h1}>ShadiMaxing</h1>
        <p style={styles.tagline}>Your dream wedding, made simple</p>
      </div>

      {/* Opening: big upward rush + radial burst */}
      {phase === "opening" ? (
        <>
          <div style={{ ...styles.layer, zIndex: 3 }} aria-hidden="true">
            {RUSH.map((h, i) => (
              <FloatingHeart key={i} {...h} infinite={false} />
            ))}
          </div>
          <div style={{ ...styles.layer, zIndex: 3 }} aria-hidden="true">
            {BURST.map((h, i) => (
              <span
                key={i}
                style={
                  {
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    fontFamily: EMOJI_FONT,
                    fontSize: h.size,
                    lineHeight: 1,
                    "--dx": h.dx,
                    "--dy": h.dy,
                    "--spin": h.spin,
                    willChange: "transform, opacity",
                    animation: `shadiHeartBurst ${h.duration}ms cubic-bezier(0.15, 0.8, 0.3, 1) ${h.delay}ms both`,
                  } as CSSProperties
                }
              >
                {h.char}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {phase === "closed" ? <div style={styles.hint}>Tap anywhere to begin</div> : null}

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