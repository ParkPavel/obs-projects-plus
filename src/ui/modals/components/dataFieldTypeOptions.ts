/**
 * Single source of truth for data-field-type pickers (Stage A.9).
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5a — the `+ Add field` and
 * `Configure field` modals must enumerate `DataFieldType` from a shared
 * registry so adding a type literal does not silently bypass user-facing UI.
 *
 * @since 3.4.2 (Stage A / A.9 recovery)
 */
import { DataFieldType } from "src/lib/dataframe/dataframe";

export interface DataFieldTypeOption {
  readonly label: string;
  readonly value: DataFieldType;
}

/** Minimal subset of i18next's `t` function used by the registry. */
type TranslateFn = (key: string) => string;

/**
 * Build the list of selectable DataFieldType options, in stable display
 * order. `DataFieldType.Unknown` is omitted from selectable choices.
 */
export function dataFieldTypeOptions(t: TranslateFn): DataFieldTypeOption[] {
  return [
    { label: t("data-types.string"), value: DataFieldType.String },
    { label: t("data-types.number"), value: DataFieldType.Number },
    { label: t("data-types.boolean"), value: DataFieldType.Boolean },
    { label: t("data-types.date"), value: DataFieldType.Date },
    { label: t("data-types.list"), value: DataFieldType.List },
    { label: t("data-types.select"), value: DataFieldType.Select },
    { label: t("data-types.status"), value: DataFieldType.Status },
    { label: t("data-types.formula"), value: DataFieldType.Formula },
    { label: t("data-types.relation"), value: DataFieldType.Relation },
    { label: t("data-types.rollup"), value: DataFieldType.Rollup },
    { label: t("data-types.unique_id"), value: DataFieldType.UniqueId },
  ];
}

/** Stable count of selectable types (Unknown excluded). */
export const SELECTABLE_DATA_FIELD_TYPE_COUNT = 11;
