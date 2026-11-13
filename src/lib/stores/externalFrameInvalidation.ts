import { writable } from "svelte/store";

/**
 * Monotonic tick that advances every time sibling-project `DataFrame`s may
 * have become stale (vault `modify/create/delete/rename` events, settings
 * mutations). Canvas preloaders subscribe to this store so they can re-run
 * their `resolveExternalFrame` preload pass for the currently referenced
 * source ids, even when the set of ids hasn't changed.
 *
 * The App-level external-frame cache is cleared in lockstep with this tick.
 */
export const externalFrameInvalidation = writable<number>(0);

export function bumpExternalFrameInvalidation(): void {
  externalFrameInvalidation.update((n) => n + 1);
}

/**
 * What decides whether cached sibling frames are still right: each project's
 * id, name, source and field configuration. Rollups are folded into those
 * frames (externalFrameResolver), so a changed rollup — sum to avg — must
 * refresh every reader, not only a renamed project (Codex review of 316d058).
 */
export function projectsCacheKey(
  projects: ReadonlyArray<{ id: string; name: string; dataSource?: unknown; fieldConfig?: unknown; additionalSources?: unknown; views?: unknown }>
): string {
  return projects
    .map((p) => `${p.id}|${p.name}|${JSON.stringify(p.dataSource ?? null)}|${JSON.stringify(p.fieldConfig ?? null)}|${JSON.stringify(p.additionalSources ?? null)}|${blockSignature(p.views)}`)
    .join("\u0001");
}

/**
 * i3-data: what decides a block's frame when it is read as a source — the
 * dashboard's filter and formulas, each block's source, filter and pipeline.
 * Only these: a column width or an active tab must not refetch every frame.
 */
function blockSignature(views: unknown): string {
  if (!Array.isArray(views)) return "";
  return JSON.stringify(views.map((v: { id?: unknown; filter?: unknown; config?: { widgets?: unknown; formulaFields?: unknown } }) => {
    const raw = v?.config?.widgets;
    const widgets = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
    const blocks = widgets
      .filter((w) => w?.["type"] === "database-call")
      .map((w) => [w["id"], w["sourceConfig"] ?? null, (w["config"] as { subFilter?: unknown } | undefined)?.subFilter ?? null, w["transform"] ?? null]);
    return blocks.length > 0 ? [v?.id, v?.filter ?? null, v?.config?.formulaFields ?? null, blocks] : null;
  }));
}
