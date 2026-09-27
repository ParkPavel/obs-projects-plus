/**
 * selectionFollow — a chart or stats block narrowed to the record picked in
 * another block, through a relation (3.6.0).
 *
 * Pick a client in the clients table, and the wellbeing chart beside it shows
 * only that client's visits: the visits link the client by their `client`
 * field. The table drives the canvas selection with the record's file name
 * (tableRowOps.rowSelectionValue); a follower keeps the records whose relation
 * field links a note of that name. Only a selection coming from the configured
 * master block narrows; any other selection leaves the follower as it is.
 *
 * Links are compared by the linked note's NAME — no path, alias or extension,
 * case-insensitive — because that is what the master sends. `canonicalLinkKey`
 * keeps the path, so `[[Кабинет/Клиенты/Анна]]` would never match "Анна".
 */

import type { DataRecord } from "src/lib/dataframe/dataframe";
import { parseRelationLinks } from "src/lib/relations/parseRelationLinks";
import { chartSourceId, dataTableSourceId, type SelectionState } from "../../canvasSelectionStore";
import type { LinkedSelectionConfig } from "../../types";

/** The name of the note a link points at, as a comparison key. */
export function linkNameKey(link: string): string {
  const target = link.replace(/^\[\[|\]\]$/g, "").split("|")[0] ?? "";
  const name = target.split("#")[0]!.split("/").pop() ?? "";
  return name.replace(/\.md$/i, "").trim().toLowerCase();
}

/** True when `selection` comes from the block `linked` follows and names something. */
export function isFollowing(selection: SelectionState, linked: LinkedSelectionConfig | undefined): boolean {
  if (!linked?.sourceWidgetId || !linked.relationField) return false;
  if (selection.source === null || selection.values.length === 0) return false;
  return (
    selection.source === dataTableSourceId(linked.sourceWidgetId) ||
    selection.source === chartSourceId(linked.sourceWidgetId)
  );
}

/** The records whose relation field links one of the selected notes, or all of them when not following. */
export function followLinkedSelection(
  records: readonly DataRecord[],
  selection: SelectionState,
  linked: LinkedSelectionConfig | undefined
): readonly DataRecord[] {
  if (!linked || !isFollowing(selection, linked)) return records;
  const keys = new Set(selection.values.map((v) => linkNameKey(String(v))));
  return records.filter((r) =>
    parseRelationLinks(r.values[linked.relationField]).some((link) => keys.has(linkNameKey(link)))
  );
}
