/**
 * relationCandidates — the records a Relation cell can link to (#081).
 *
 * Moved out of `RelationPickerPopover.svelte` when the picker gained
 * active-option navigation and its ceiling (R0.6) left no room for both.
 */

import { parseRelationLinks } from "src/lib/relations/parseRelationLinks";

type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
type ViewApi = import("src/lib/viewApi").ViewApi;
type RelationFieldConfig = import("src/settings/base/settings").RelationFieldConfig;

/** A record id as the label a link shows: the last path segment without `.md`. */
function baseName(id: string): string {
  return (id.split("/").pop() ?? id).replace(/\.md$/, "");
}

/**
 * The labels the picker offers, sorted. They are the records of the target
 * project (`RelationFieldConfig.targetProjectId`, through
 * `api.resolveExternalFrame`); with no target, or nothing in it, every wikilink
 * target already used in this column.
 */
export async function loadRelationCandidates(
  field: DataField,
  api: ViewApi,
  frame: DataFrame
): Promise<string[]> {
  const rel = (field.typeConfig as { relation?: RelationFieldConfig } | undefined)?.relation;
  let candidates: string[] = [];
  if (rel?.targetProjectId && api.resolveExternalFrame) {
    const target = await api.resolveExternalFrame(rel.targetProjectId).catch(() => null);
    candidates = target?.records.map((r) => baseName(r.id)) ?? [];
  }
  if (candidates.length === 0) {
    const seen = new Set<string>();
    for (const r of frame.records) {
      for (const label of parseRelationLinks(r.values[field.name])) seen.add(label);
    }
    candidates = [...seen];
  }
  return candidates.sort((a, b) => a.localeCompare(b));
}
