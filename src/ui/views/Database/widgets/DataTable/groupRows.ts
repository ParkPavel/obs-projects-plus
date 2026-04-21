// src/ui/views/Database/widgets/DataTable/groupRows.ts
// Row grouping logic for DataTable.

import type { DataRecord, Optional, DataValue } from "src/lib/dataframe/dataframe";
import type { GroupConfig } from "../../types";

export interface RowGroup {
  readonly key: string;
  readonly records: DataRecord[];
  readonly subGroups?: RowGroup[];
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
  const map = new Map<string, DataRecord[]>();

  for (const record of records) {
    const value = record.values[config.field];
    const key = valueToGroupKey(value);
    const existing = map.get(key);
    if (existing) {
      existing.push(record);
    } else {
      map.set(key, [record]);
    }
  }

  // Add empty groups if configured
  if (config.showEmptyGroups) {
    // Empty group placeholder — already covered if key="" exists
  }

  let groups = Array.from(map.entries()).map(([key, records]) => ({
    key,
    records,
  }));

  // Filter hidden groups
  if (config.hiddenGroups.length > 0) {
    const hidden = new Set(config.hiddenGroups);
    groups = groups.filter((g) => !hidden.has(g.key));
  }

  // Sort groups
  if (config.sortOrder === "asc") {
    groups.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  } else if (config.sortOrder === "desc") {
    groups.sort((a, b) => b.key.localeCompare(a.key, undefined, { numeric: true }));
  }
  // "manual" → keep insertion order

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
