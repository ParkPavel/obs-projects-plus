/**
 * The "+ Property" flow as in Notion (B5, 3.7.2): types in two groups with
 * icons, a rollup that may create its relation on the spot, and a live
 * example of the calculation on three target records. Svelte-free so the
 * rules are tested once. Storage formats are untouched: the dialog still
 * writes `typeConfig.relation` / `typeConfig.rollup` / `typeConfig.formula`.
 */
import { DataFieldType, type DataField, type DataRecord, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
import { aggregate, type RollupFunction, type RollupResult } from "src/lib/engine/aggregate";

export interface FieldTypeChoice {
  readonly value: DataFieldType;
  /** Key under `data-types.` in the translations. */
  readonly labelKey: string;
  /** Lucide icon name. */
  readonly icon: string;
}

export interface FieldTypeGroup {
  readonly id: "basic" | "linked";
  readonly types: readonly FieldTypeChoice[];
}

export const FIELD_TYPE_GROUPS: readonly FieldTypeGroup[] = [
  {
    id: "basic",
    types: [
      { value: DataFieldType.String, labelKey: "data-types.string", icon: "type" },
      { value: DataFieldType.Number, labelKey: "data-types.number", icon: "hash" },
      { value: DataFieldType.Select, labelKey: "data-types.select", icon: "chevron-down-circle" },
      { value: DataFieldType.Status, labelKey: "data-types.status", icon: "loader" },
      { value: DataFieldType.Date, labelKey: "data-types.date", icon: "calendar" },
      { value: DataFieldType.Boolean, labelKey: "data-types.boolean", icon: "check-square" },
      { value: DataFieldType.List, labelKey: "data-types.list", icon: "list" },
      { value: DataFieldType.UniqueId, labelKey: "data-types.unique_id", icon: "fingerprint" },
    ],
  },
  {
    id: "linked",
    types: [
      { value: DataFieldType.Relation, labelKey: "data-types.relation", icon: "arrow-up-right" },
      { value: DataFieldType.Rollup, labelKey: "data-types.rollup", icon: "sigma" },
      { value: DataFieldType.Formula, labelKey: "data-types.formula", icon: "function-square" },
    ],
  },
];

/** The calculations Notion shows first; the full list stays one step away. */
export const ROLLUP_QUICK_FUNCTIONS: readonly RollupFunction[] = [
  "count_total",
  "sum",
  "avg",
  "min",
  "max",
  "percent_not_empty",
  "show_original",
];

/** A number is summed, anything else is counted — the choice a person makes nine times in ten. */
export function defaultRollupFunction(target: DataField | undefined): RollupFunction {
  return target?.type === DataFieldType.Number ? "sum" : "count_total";
}

/** A relation created from the rollup step is named after the project it links to. */
export function newRelationFieldName(projectName: string, existing: readonly string[]): string {
  const taken = new Set(existing);
  const base = projectName.trim() || "Relation";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export const EXAMPLE_RECORDS = 3;

export interface RollupExample {
  readonly records: number;
  readonly values: Optional<DataValue>[];
  readonly result: RollupResult;
}

/** The calculation applied to the first three target records, as if one record linked to all three. */
export function rollupExample(
  targetRecords: readonly DataRecord[],
  targetField: string,
  fn: RollupFunction,
  separator?: string
): RollupExample | null {
  if (!targetField || targetRecords.length === 0) return null;
  const sample = targetRecords.slice(0, EXAMPLE_RECORDS);
  const values = sample.map((r) => r.values[targetField] ?? null);
  const config = separator !== undefined
    ? { relationField: "", targetField, function: fn, separator }
    : { relationField: "", targetField, function: fn };
  return { records: sample.length, values, result: aggregate(values, config) };
}
