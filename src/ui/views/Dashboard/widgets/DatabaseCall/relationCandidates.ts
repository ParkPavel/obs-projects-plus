/**
 * relationCandidates — the records a Relation cell can link to (#081).
 *
 * Moved out of `RelationPickerPopover.svelte` when the picker gained
 * active-option navigation and its ceiling (R0.6) left no room for both.
 */

import { parseRelationLinks } from "src/lib/relations/parseRelationLinks";
import { writable } from "svelte/store";

type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
type ViewApi = import("src/lib/viewApi").ViewApi;
type RelationFieldConfig = import("src/settings/base/settings").RelationFieldConfig;


/**
 * The labels the picker offers, sorted. They are the records of the target
 * project (`RelationFieldConfig.targetProjectId`, through
 * `api.resolveExternalFrame`). Only an unconfigured field offers the wikilink
 * targets already used in this column; an empty target stays empty.
 */
export async function loadRelationCandidates(
  field: DataField,
  api: ViewApi,
  frame: DataFrame
): Promise<string[]> {
  const rel = (field.typeConfig as { relation?: RelationFieldConfig } | undefined)?.relation;
  if (rel?.targetProjectId) {
    if (!api.resolveExternalFrame) return [];
    const target = await api.resolveExternalFrame(rel.targetProjectId);
    return [...new Set(target?.records.map(record => record.id.replace(/\.md$/i, "")) ?? [])]
      .sort((a, b) => a.localeCompare(b));
  }
  const seen = new Set<string>();
  for (const record of frame.records) {
    for (const target of parseRelationLinks(record.values[field.name])) seen.add(target);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

const contextKey = (field: DataField) => JSON.stringify([field.name,
  (field.typeConfig as { relation?: RelationFieldConfig } | undefined)?.relation?.targetProjectId]);

/** A search result belongs to one live field/source revision, never a later editor. */
export function createRelationCandidates() {
  let state = { candidates: [] as string[], loading: true, error: false };
  const store = writable(state);
  let revision = 0, alive = true;
  let input: { key: string; api: ViewApi; frame: DataFrame } | null = null;
  const set = (next: typeof state) => { state = next; store.set(state); };
  return {
    subscribe: store.subscribe,
    destroy(): void { alive = false; revision++; },
    accepts(target: string, field: DataField, api: ViewApi, frame: DataFrame): boolean {
      return alive && !state.loading && !state.error && input?.key === contextKey(field) &&
        input.api === api && input.frame === frame && state.candidates.includes(target);
    },
    async load(field: DataField, api: ViewApi, frame: DataFrame): Promise<void> {
      if (!alive) return;
      const request = ++revision;
      input = { key: contextKey(field), api, frame };
      set({ candidates: [], loading: true, error: false });
      try {
        const candidates = await loadRelationCandidates(field, api, frame);
        if (alive && request === revision) set({ candidates, loading: false, error: false });
      } catch (error) {
        if (alive && request === revision) {
          set({ candidates: [], loading: false, error: true });
          console.error("[Projects+] relation candidates load failed", error);
        }
      }
    },
  };
}
