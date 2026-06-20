// src/ui/views/Dashboard/widgets/DatabaseCall/groupRows.ts
// Row grouping engine for Table V2 (un-archived in F2.5 - pure logic).
//
// #045.6 — Adds a `mode: "semantic"` overlay that mirrors the Board
// view's NPLAN-C1 3-tier bucket grouping (To Do / In Progress / Done).
// Both DataTable and Board now group Status fields the same way,
// regardless of whether the underlying source is folder, tag, or
// Dataview — closing M-DATAVIEW-BRIDGE Gap on cross-view consistency.

import type { DataRecord, Optional, DataValue } from "src/lib/dataframe/dataframe";
import type { GroupConfig } from "src/ui/views/Dashboard/types";

export interface RowGroup {
  readonly key: string;
  readonly records: DataRecord[];
  readonly subGroups?: RowGroup[];
}

export interface SemanticLabels {
  readonly todo: string;
  readonly inProgress: string;
  readonly complete: string;
  readonly none: string;
}

export type StatusGroups = {
  readonly todo?: ReadonlyArray<string>;
  readonly inProgress?: ReadonlyArray<string>;
  readonly complete?: ReadonlyArray<string>;
};

export const DEFAULT_SEMANTIC_LABELS: SemanticLabels = {
  todo: "To Do",
  inProgress: "In Progress",
  complete: "Done",
  none: "No Status",
};

/**
 * #045.6 / #094 — Map one raw status value into its semantic bucket label.
 * Single source of truth for 3-bucket dispatch shared by DataTable, Board
 * and the Dashboard chart pipeline.
 */
export function bucketLabelForRaw(
  raw: string | null,
  statusGroups: StatusGroups,
  labels: SemanticLabels
): string {
  if (raw !== null && (statusGroups.todo ?? []).includes(raw)) return labels.todo;
  if (raw !== null && (statusGroups.inProgress ?? []).includes(raw)) return labels.inProgress;
  if (raw !== null && (statusGroups.complete ?? []).includes(raw)) return labels.complete;
  return labels.none;
}

/**
 * Group records by the specified field.
 * If config.subGroupField is set, each group is further divided into sub-groups.
 * Returns ordered list of groups.
 */
export function groupRecords(
  records: DataRecord[],
  config: GroupConfig
): RowGroup[] {
  let groups: { key: string; records: DataRecord[] }[];

  if (config.mode === "semantic" && config.statusGroups) {
    groups = buildSemanticGroups(records, config);
    // Semantic mode owns its ordering (To Do → In Progress → Done → None);
    // user-driven sort orders don't reshuffle bucket priority.
  } else {
    groups = buildValueGroups(records, config.field);

    // Sort groups (value mode only — semantic order is fixed).
    if (config.sortOrder === "asc") {
      groups.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
    } else if (config.sortOrder === "desc") {
      groups.sort((a, b) => b.key.localeCompare(a.key, undefined, { numeric: true }));
    }
    // "manual" → keep insertion order
  }

  // Filter hidden groups (applies to both modes).
  if (config.hiddenGroups.length > 0) {
    const hidden = new Set(config.hiddenGroups);
    groups = groups.filter((g) => !hidden.has(g.key));
  }

  // Sub-grouping (2-level)
  if (config.subGroupField) {
    const subField = config.subGroupField;
    const subSortOrder = config.subGroupSortOrder ?? "asc";
    return groups.map((group) => ({
      ...group,
      subGroups: buildSubGroups(group.records, subField, subSortOrder),
    }));
  }

  return groups;
}

function buildValueGroups(
  records: DataRecord[],
  field: string
): { key: string; records: DataRecord[] }[] {
  const map = new Map<string, DataRecord[]>();
  for (const record of records) {
    const value = record.values[field];
    const key = valueToGroupKey(value);
    const existing = map.get(key);
    if (existing) {
      existing.push(record);
    } else {
      map.set(key, [record]);
    }
  }
  return Array.from(map.entries()).map(([key, records]) => ({ key, records }));
}

/**
 * #045.6 — Build the 3-tier semantic bucket overlay. Mirrors the Board
 * view's `getSemanticColumns` (board.ts) so the same Status field
 * displays identically in both. Differences from the Board version:
 *   - No i18n store dependency — labels passed in via config so the
 *     pure module can be tested in isolation.
 *   - Always returns the 3 main buckets in canonical order (even when
 *     empty) so the user can drop a card into "In Progress" while the
 *     bucket is still empty — matches Notion behaviour.
 *   - "No Status" bucket is appended only when at least one record
 *     fails to match any of the three buckets.
 */
function buildSemanticGroups(
  records: DataRecord[],
  config: GroupConfig
): { key: string; records: DataRecord[] }[] {
  const sg = config.statusGroups ?? {};

  const labels: SemanticLabels = {
    todo: config.semanticLabels?.todo ?? DEFAULT_SEMANTIC_LABELS.todo,
    inProgress: config.semanticLabels?.inProgress ?? DEFAULT_SEMANTIC_LABELS.inProgress,
    complete: config.semanticLabels?.complete ?? DEFAULT_SEMANTIC_LABELS.complete,
    none: config.semanticLabels?.none ?? DEFAULT_SEMANTIC_LABELS.none,
  };

  const buckets: Record<string, DataRecord[]> = {
    [labels.todo]: [],
    [labels.inProgress]: [],
    [labels.complete]: [],
    [labels.none]: [],
  };

  for (const record of records) {
    const str = stringifyForBucket(record.values[config.field]);
    const bucket = bucketLabelForRaw(str, sg, labels);
    buckets[bucket]!.push(record);
  }

  const ordered: { key: string; records: DataRecord[] }[] = [
    { key: labels.todo, records: buckets[labels.todo] ?? [] },
    { key: labels.inProgress, records: buckets[labels.inProgress] ?? [] },
    { key: labels.complete, records: buckets[labels.complete] ?? [] },
  ];
  // Only surface "No Status" when something actually landed there
  // (avoids cluttering the UI when every record matches a bucket).
  if ((buckets[labels.none]?.length ?? 0) > 0) {
    ordered.push({ key: labels.none, records: buckets[labels.none] ?? [] });
  }
  return ordered;
}

export function stringifyForBucket(value: Optional<DataValue>): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // Arrays / Dates / objects don't participate in semantic bucketing —
  // they always fall through to "No Status".
  return null;
}

function buildSubGroups(
  records: DataRecord[],
  field: string,
  sortOrder: "asc" | "desc" | "manual"
): RowGroup[] {
  const map = new Map<string, DataRecord[]>();
  for (const record of records) {
    const key = valueToGroupKey(record.values[field]);
    const existing = map.get(key);
    if (existing) {
      existing.push(record);
    } else {
      map.set(key, [record]);
    }
  }

  const subGroups = Array.from(map.entries()).map(([key, records]) => ({
    key,
    records,
  }));

  if (sortOrder === "asc") {
    subGroups.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  } else if (sortOrder === "desc") {
    subGroups.sort((a, b) => b.key.localeCompare(a.key, undefined, { numeric: true }));
  }

  return subGroups;
}

function valueToGroupKey(value: Optional<DataValue>): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map(String).sort().join(", ");
  }
  return String(value);
}
