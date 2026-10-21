/**
 * i3-gallery — the gallery's sections: grouping by a field, and the
 * progressive window over a large set.
 *
 * Pure: no DOM, no stores. The record order inside a section is the view's
 * order (its sort), as Notion keeps it; the sections themselves are ordered
 * by their key (numbers by value), with the "no value" section last, as the
 * board puts its "no status" column.
 */

import type { DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
import { stripToDisplay } from "src/lib/engine/wikilink";

/** The key of the section for records with no value in the group field. */
export const NO_VALUE_GROUP = "";

export interface GalleryGroup {
  /** The value the section stands for; `NO_VALUE_GROUP` for "no value". */
  readonly key: string;
  readonly records: DataRecord[];
}

/** The section key of one value; a link reads as its note's name. */
function keyOf(value: Optional<DataValue>): string {
  if (value === undefined || value === null) return NO_VALUE_GROUP;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? NO_VALUE_GROUP : value.toISOString().slice(0, 10);
  return stripToDisplay(String(value)).trim();
}

/** Every key a record belongs to: one per distinct item of a list. */
function keysOf(value: Optional<DataValue>): string[] {
  if (!Array.isArray(value)) return [keyOf(value)];
  const keys = [...new Set(value.map(keyOf).filter((key) => key !== NO_VALUE_GROUP))];
  return keys.length ? keys : [NO_VALUE_GROUP];
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * The records split by `fieldName`. A list value (tags, a multi-select, a
 * list of links) puts the record in a section per item, as Notion's board and
 * gallery do for a multi-select group. No field: one section with every record.
 */
export function groupGalleryRecords(records: readonly DataRecord[], fieldName: string | undefined): GalleryGroup[] {
  if (!fieldName) return [{ key: NO_VALUE_GROUP, records: [...records] }];
  const byKey = new Map<string, DataRecord[]>();
  for (const record of records) {
    for (const key of keysOf(record.values[fieldName])) {
      const list = byKey.get(key);
      if (list) list.push(record);
      else byKey.set(key, [record]);
    }
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => {
      if (a === NO_VALUE_GROUP) return b === NO_VALUE_GROUP ? 0 : 1;
      if (b === NO_VALUE_GROUP) return -1;
      return collator.compare(a, b);
    })
    .map(([key, list]) => ({ key, records: list }));
}

/** How many cards a window grows by, and where it starts. */
export const GALLERY_WINDOW_STEP = 120;
/** Below this many records the whole set renders at once. */
export const GALLERY_WINDOW_THRESHOLD = 200;

export interface WindowedGroup extends GalleryGroup {
  readonly collapsed: boolean;
  /** Cards of this section past the window, not rendered yet. */
  readonly hidden: number;
}

/**
 * The sections cut to a budget of `limit` rendered cards, in order. A folded
 * section renders none and spends none. `limit` of Infinity renders all.
 */
export function windowGroups(
  groups: readonly GalleryGroup[],
  collapsed: readonly string[],
  limit: number
): WindowedGroup[] {
  let budget = limit;
  return groups.map((group) => {
    const isCollapsed = collapsed.includes(group.key);
    if (isCollapsed) return { ...group, collapsed: true, hidden: 0 };
    const take = Math.max(0, Math.min(group.records.length, budget));
    budget -= take;
    return {
      key: group.key,
      records: group.records.slice(0, take),
      collapsed: false,
      hidden: group.records.length - take,
    };
  });
}

/** The first window for a set of `total` records: all of a small set. */
export function initialWindow(total: number): number {
  return total > GALLERY_WINDOW_THRESHOLD ? GALLERY_WINDOW_STEP : Infinity;
}
