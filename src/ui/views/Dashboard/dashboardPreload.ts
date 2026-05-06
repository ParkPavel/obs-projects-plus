// dashboardPreload.ts — pure utilities for cross-source right-frame preloading.
// Extracted from DashboardCanvas.svelte (R5-013).

import type { WidgetDefinition } from "./types";
import type { ProjectDefinition } from "src/settings/settings";

/**
 * Scan widget configs (join steps, chart correlations) AND project.fieldConfig
 * (relation / rollup targets) to collect the set of external project IDs that
 * this canvas depends on for right-frame resolution.
 *
 * Pure function — no side effects, fully testable without Svelte.
 */
export function collectReferencedSourceIds(
  widgets: WidgetDefinition[],
  project: ProjectDefinition
): string[] {
  const ids = new Set<string>();

  for (const w of widgets) {
    const steps = w.transform?.steps ?? [];
    for (const s of steps) {
      if (s.type === "join" && s.rightSourceId) ids.add(s.rightSourceId);
    }
    if (w.type === "chart") {
      const cfg = w.config as { correlation?: { rightSourceId?: string } };
      const id = cfg?.correlation?.rightSourceId;
      if (id) ids.add(id);
    }
  }

  // Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.4 (R-11 mitigation).
  // Stage A cross-project relations & rollups declared on project.fieldConfig
  // must also feed the pre-load pipeline.
  const fc = project.fieldConfig as
    | Record<
        string,
        {
          relation?: { targetProjectId?: string };
          rollup?: { targetProjectId?: string };
        }
      >
    | undefined;

  if (fc) {
    for (const cfg of Object.values(fc)) {
      const relTarget = cfg?.relation?.targetProjectId;
      if (relTarget && relTarget !== project.id) ids.add(relTarget);
      const rollTarget = cfg?.rollup?.targetProjectId;
      if (rollTarget && rollTarget !== project.id) ids.add(rollTarget);
    }
  }

  return Array.from(ids);
}
