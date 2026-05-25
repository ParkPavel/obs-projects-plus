// MPLAN-008 — Pure derivation of list rows for DataListWidget.

import type { DataFrame, DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataListConfig } from "../../types";

export interface ListItem {
  readonly id: string;
  readonly title: string;
  readonly fields: ReadonlyArray<{
    readonly name: string;
    readonly value: Optional<DataValue>;
    /**
     * Field semantic type, projected from `frame.fields` when available.
     * Falls back to `DataFieldType.Unknown` for fields the consumer asked
     * for that don't appear in the frame schema (rare; treated as text).
     *
     * #045.3 — enables consumers (DataListWidget, SubBaseCanvasWidget) to
     * dispatch on type when rendering (e.g. Relation → pill-chip view).
     */
    readonly type: DataFieldType;
  }>;
}

function basename(id: string): string {
  const start = id.lastIndexOf("/") + 1;
  const end = id.lastIndexOf(".");
  if (end > start) return id.substring(start, end);
  return id.substring(start);
}

function titleOf(record: DataRecord, titleField: string | undefined): string {
  if (titleField) {
    const v = record.values[titleField];
    if (v != null && v !== "") return String(v);
  }
  const fallback = record.values["name"] ?? record.values["title"];
  if (fallback != null && fallback !== "") return String(fallback);
  return basename(record.id) || record.id;
}

function compareValues(a: Optional<DataValue>, b: Optional<DataValue>): number {
  const aMissing = a == null || a === "";
  const bMissing = b == null || b === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  const an = typeof a === "number" ? a : Number(a);
  const bn = typeof b === "number" ? b : Number(b);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && typeof a !== "string" && typeof b !== "string") {
    return an - bn;
  }
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

export function deriveListItems(frame: DataFrame, config: DataListConfig | undefined): ListItem[] {
  if (!frame) return [];
  const cfg = config ?? { fields: [] };
  const fields = cfg.fields ?? [];
  const records = [...frame.records];

  if (cfg.sortField) {
    const order = cfg.sortOrder === "desc" ? -1 : 1;
    const sortField = cfg.sortField;
    records.sort((a, b) => {
      const av = a.values[sortField];
      const bv = b.values[sortField];
      const aMissing = av == null || av === "";
      const bMissing = bv == null || bv === "";
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return order * compareValues(av, bv);
    });
  }

  const limited = cfg.limit && cfg.limit > 0 ? records.slice(0, cfg.limit) : records;

  // Pre-index frame fields by name so per-record mapping is O(1) per field
  // instead of O(F) — keeps deriveListItems linear in records × selected fields.
  const fieldTypeByName = new Map<string, DataFieldType>();
  for (const f of frame.fields) {
    fieldTypeByName.set(f.name, f.type);
  }

  return limited.map((record) => ({
    id: record.id,
    title: titleOf(record, cfg.titleField),
    fields: fields.map((name) => ({
      name,
      value: record.values[name],
      type: fieldTypeByName.get(name) ?? DataFieldType.Unknown,
    })),
  }));
}
