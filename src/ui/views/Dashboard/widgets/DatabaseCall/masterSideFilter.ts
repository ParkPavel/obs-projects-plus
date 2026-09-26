/**
 * masterSideFilter — a linked block narrowed from the MASTER's side of the
 * relation (F3b, `LinkedSelectionConfig.relationSide: "master"`).
 *
 * The usual linked block holds the relation itself: pick a client in the
 * master table, and the sessions block keeps the sessions whose `client`
 * links that client. The other way round has no field on the receiving
 * side: on the Sessions dashboard a Clients block cannot say which client a
 * session names — the SESSION says it, in its own `client` field. So the
 * selected master rows are found in the master frame, their relation values
 * are resolved against the receiving frame by the relation contract (path →
 * basename → display; unmatched and ambiguous contribute nothing), and the
 * receiving block keeps the records those links reach.
 *
 * Master rows are matched by file name, which is what the table drives the
 * selection with (tableRowOps.rowSelectionValue).
 *
 * Links resolve over the block's WHOLE source, by the relation's own display
 * field, and only then meet the records the block shows: resolving among the
 * filtered records let an explicit link to a hidden note fall back by basename
 * onto a namesake (Codex review of 0ebea59).
 */

import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import { LEGACY_DISPLAY_FALLBACKS } from "src/lib/engine/crossProjectResolver";
import { buildRelationTargetIndex, resolveRelationValue } from "src/lib/relations/relationContract";
import { recordBaseName } from "./tableRowOps";

export function filterByMasterSide(
  universe: DataFrame,
  visible: readonly DataRecord[],
  master: DataFrame,
  selectedNames: readonly string[],
  relationField: string
): DataRecord[] {
  const names = new Set(selectedNames.map((n) => n.toLowerCase()));
  const relation = master.fields.find((fl) => fl.name === relationField)?.typeConfig?.["relation"] as
    | { displayField?: string }
    | undefined;
  const displayField = relation?.displayField;
  const index = buildRelationTargetIndex(universe, displayField ? [displayField] : LEGACY_DISPLAY_FALLBACKS);
  const reached = new Set<string>();
  for (const row of master.records) {
    if (!names.has(recordBaseName(row).toLowerCase())) continue;
    for (const r of resolveRelationValue(row.values[relationField], index)) {
      if (r.status === "resolved" && r.targetRecordId) reached.add(r.targetRecordId);
    }
  }
  return visible.filter((r) => reached.has(r.id));
}
