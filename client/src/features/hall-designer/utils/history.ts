import type { Hall, HallObject } from "../types/layout";

export interface Snapshot {
  hall: Hall;
  objects: HallObject[];
}

export interface History {
  past: Snapshot[];
  future: Snapshot[];
}

export const HISTORY_LIMIT = 100;

export function emptyHistory(): History {
  return { past: [], future: [] };
}

// Keeps only the newest HISTORY_LIMIT entries (drops the oldest). Never mutates.
function capStack(stack: Snapshot[]): Snapshot[] {
  return stack.length > HISTORY_LIMIT
    ? stack.slice(stack.length - HISTORY_LIMIT)
    : stack;
}

export function pushHistory(history: History, before: Snapshot): History {
  return { past: capStack([...history.past, before]), future: [] };
}

export function undoHistory(
  history: History,
  current: Snapshot,
): { history: History; snapshot: Snapshot } | null {
  const snapshot = history.past[history.past.length - 1];
  if (snapshot === undefined) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: capStack([...history.future, current]),
    },
    snapshot,
  };
}

export function redoHistory(
  history: History,
  current: Snapshot,
): { history: History; snapshot: Snapshot } | null {
  const snapshot = history.future[history.future.length - 1];
  if (snapshot === undefined) return null;
  return {
    history: {
      past: capStack([...history.past, current]),
      future: history.future.slice(0, -1),
    },
    snapshot,
  };
}

export function canUndoHistory(history: History): boolean {
  return history.past.length > 0;
}

export function canRedoHistory(history: History): boolean {
  return history.future.length > 0;
}