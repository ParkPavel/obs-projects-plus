// dashboardPreload.ts — pure utilities for cross-source right-frame preloading.
// Extracted from DashboardCanvas.svelte (R5-013).

import type { DataFrame } from "src/lib/dataframe/dataframe";
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
    // NPLAN-V7.1: database-call widgets with an independent sourceConfig load
    // their frame via the same right-frame preload channel so vault-change
    // invalidation and stale-resolution guards apply automatically.
    if (w.type === "database-call" && w.sourceConfig?.projectId) {
      ids.add(w.sourceConfig.projectId);
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

/**
 * Build a stateful preload runner. Each `run(ids)` invocation increments an
 * internal generation token; late-resolving older batches are discarded so
 * a stale resolution can never overwrite a newer one.
 *
 * Extracted from DashboardCanvas.svelte (R5-013) — keeps the canvas free of
 * the async/generation bookkeeping.
 */
export function createPreloadRunner(
  resolveExternalFrame: ((id: string) => Promise<DataFrame | undefined>) | undefined,
  setFrames: (frames: ReadonlyMap<string, DataFrame>) => void
): (referencedIds: readonly string[]) => void {
  let generation = 0;

  return function run(referencedIds) {
    const token = ++generation;
    void (async () => {
      try {
        if (!resolveExternalFrame || referencedIds.length === 0) {
          if (token === generation) setFrames(new Map());
          return;
        }
        const entries = await Promise.all(
          referencedIds.map(async (id) => {
            const df = await resolveExternalFrame(id);
            return [id, df] as const;
          })
        );
        if (token !== generation) return;
        const next = new Map<string, DataFrame>();
        for (const [id, df] of entries) {
          if (df) next.set(id, df);
        }
        setFrames(next);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[obs-projects-plus] right-frame preload failed", err);
        if (token === generation) setFrames(new Map());
      }
    })();
  };
}

/**
 * Stateful sync gate. Calls `runPreload` only when the referenced-id set has
 * changed OR the external invalidation tick has advanced. Lets callers fold
 * the entire reactive preload block into a single `$:` line.
 */
export function createPreloadSync(
  runPreload: (referencedIds: readonly string[]) => void
): (referencedIds: readonly string[], invalidationTick: number) => void {
  let lastKey = "";
  let lastTick = 0;
  return (referencedIds, invalidationTick) => {
    const key = referencedIds.slice().sort().join("|");
    if (key === lastKey && invalidationTick === lastTick) return;
    lastKey = key;
    lastTick = invalidationTick;
    runPreload(referencedIds);
  };
}
