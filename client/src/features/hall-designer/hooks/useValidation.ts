import { useMemo } from "react";
import { useEditorStore } from "../store/editorStore";
import type { Severity, ValidationIssue } from "../utils/validation";
import { validateLayout } from "../utils/validation";

export function useValidation(): { issues: ValidationIssue[]; byObjectId: Map<string, Severity> } {
  const hall = useEditorStore((s) => s.hall);
  const objects = useEditorStore((s) => s.objects);

  return useMemo(() => {
    const issues = validateLayout({ hall, objects });
    const byObjectId = new Map<string, Severity>();
    for (const issue of issues) {
      for (const id of issue.objectIds) {
        // Error beats warning.
        if (issue.severity === "error" || !byObjectId.has(id)) byObjectId.set(id, issue.severity);
      }
    }
    return { issues, byObjectId };
  }, [hall, objects]);
}