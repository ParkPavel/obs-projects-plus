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
 * #136 — what is known about one external source right now.
 *
 * Before this existed the preloader published `Map<string, DataFrame>` and
 * simply omitted anything it could not resolve. A consumer could therefore not
 * tell "still loading" from "this project is gone", and `WidgetHost` bridged
 * that gap by rendering the PARENT project's records instead — plausible data
 * from the wrong project, with no signal. A missing key is not a state.
 */
export type ExternalSourceState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly frame: DataFrame }
  | { readonly status: "unavailable" }
  | { readonly status: "error"; readonly message: string };

/**
 * The ready frames, for consumers that legitimately only care about those:
 * `join` and chart correlation both treat an unresolved right-hand source as
 * absent, which is correct for them — a join against nothing yields nothing.
 *
 * Derived rather than published separately, so the two views cannot drift.
 */
export function readyFrames(
  states: ReadonlyMap<string, ExternalSourceState>
): ReadonlyMap<string, DataFrame> {
  const frames = new Map<string, DataFrame>();
  for (const [id, state] of states) {
    if (state.status === "ready") frames.set(id, state.frame);
  }
  return frames;
}

/**
 * Build a stateful preload runner. Each `run(ids)` invocation increments an
 * internal generation token; late-resolving older batches are discarded so
 * a stale resolution can never overwrite a newer one.
 *
 * Publishes `loading` for every referenced id before awaiting, so a consumer
 * can distinguish "not yet" from "not there" during the first render — which is
 * exactly the window in which the old code showed the wrong project's data.
 *
 * Extracted from DashboardCanvas.svelte (R5-013) — keeps the canvas free of
 * the async/generation bookkeeping.
 */
export function createPreloadRunner(
  resolveExternalFrame: ((id: string) => Promise<DataFrame | undefined>) | undefined,
  setStates: (states: ReadonlyMap<string, ExternalSourceState>) => void
): (referencedIds: readonly string[]) => void {
  let generation = 0;

  return function run(referencedIds) {
    const token = ++generation;

    if (!resolveExternalFrame || referencedIds.length === 0) {
      setStates(new Map());
      return;
    }

    const loading = new Map<string, ExternalSourceState>();
    for (const id of referencedIds) loading.set(id, { status: "loading" });
    setStates(loading);

    void (async () => {
      const entries = await Promise.all(
        referencedIds.map(async (id): Promise<readonly [string, ExternalSourceState]> => {
          try {
            const df = await resolveExternalFrame(id);
            const state: ExternalSourceState = df
              ? { status: "ready", frame: df }
              : { status: "unavailable" };
            return [id, state] as const;
          } catch (err) {
            // Per-source, so one broken project cannot blank the others — the
            // previous version caught at the batch level and published an empty
            // map, taking every sibling source down with it.
            // eslint-disable-next-line no-console
            console.warn("[obs-projects-plus] right-frame preload failed", id, err);
            const message = err instanceof Error ? err.message : String(err);
            return [id, { status: "error", message }] as const;
          }
        })
      );
      if (token !== generation) return;
      setStates(new Map(entries));
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
