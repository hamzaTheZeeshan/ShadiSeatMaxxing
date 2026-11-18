import { useEffect } from "react";
import { useEditorStore } from "../store/editorStore";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function handleKeyDown(e: KeyboardEvent): void {
  if (isEditableTarget(e.target)) return;

  const state = useEditorStore.getState();
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (mod && !e.altKey) {
    if (key === "z") {
      e.preventDefault();
      if (e.shiftKey) state.redo();
      else state.undo();
      return;
    }
    if (key === "y" && e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      state.redo();
      return;
    }
    return;
  }

  if (e.altKey) return;

  if (e.key === "Delete" || e.key === "Backspace") {
    if (state.selectedId === null) return;
    e.preventDefault();
    state.removeObject(state.selectedId);
    return;
  }

  if (e.key === "Escape") {
    e.preventDefault();
    state.select(null);
    state.setTool("select");
  }
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}