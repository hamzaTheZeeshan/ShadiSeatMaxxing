export const SPLASH_KEY = "shadi-maxing:splash-seen:v1";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function hasSeenSplash(storage?: Pick<Storage, "getItem">): boolean {
  try {
    const target = storage ?? window.sessionStorage; // resolved lazily
    return target.getItem(SPLASH_KEY) !== null;
  } catch {
    return false;
  }
}

export function markSplashSeen(storage?: Pick<Storage, "setItem">): void {
  try {
    const target = storage ?? window.sessionStorage; // resolved lazily
    target.setItem(SPLASH_KEY, "1");
  } catch {
    // storage unavailable: do nothing
  }
}

export function prefersReducedMotion(match?: (query: string) => { matches: boolean }): boolean {
  try {
    const fn =
      match ??
      (typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? (query: string) => window.matchMedia(query)
        : undefined);
    if (!fn) return false;
    return fn(REDUCED_MOTION_QUERY).matches === true;
  } catch {
    return false;
  }
}