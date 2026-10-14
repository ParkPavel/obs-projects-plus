import { DataFieldType, type DataField, type DataValue, type Optional } from "src/lib/dataframe/dataframe";

/**
 * 3.7.2 B3 — whether a cell edits in place, and if not, the reason the user
 * reads. Before, a non-editable cell simply did nothing on a tap; «не все поля
 * доступны к редактированию, причина не понятна». The rule is the one
 * EditableCell always applied; only the reason is new.
 */
export interface CellReason {
  readonly key: string;
  readonly defaultValue: string;
  readonly params?: Record<string, string>;
}

export type CellAccess = { readonly editable: true } | { readonly editable: false; readonly reason: CellReason };

const R = "views.dashboard.table-v2.readonly-reason";

export function cellAccess(field: DataField, value: Optional<DataValue>, readonly: boolean): CellAccess {
  const rollup = field.typeConfig?.rollup;
  if (field.type === DataFieldType.Rollup || rollup) {
    const source = rollup?.relationField;
    return source
      ? { editable: false, reason: { key: `${R}.rollup-from`, defaultValue: `Rollup from «${source}» — computed`, params: { source } } }
      : { editable: false, reason: { key: `${R}.rollup`, defaultValue: "Rollup — computed" } };
  }
  if (field.type === DataFieldType.Formula) {
    return { editable: false, reason: { key: `${R}.formula`, defaultValue: "Formula — computed" } };
  }
  if (field.derived) {
    return { editable: false, reason: { key: `${R}.derived`, defaultValue: "Computed field — read only" } };
  }
  if (readonly) {
    return { editable: false, reason: { key: `${R}.source`, defaultValue: "This source is read only" } };
  }
  if (Array.isArray(value) && field.type !== DataFieldType.String && field.type !== DataFieldType.List && field.type !== DataFieldType.Relation) {
    return { editable: false, reason: { key: `${R}.list`, defaultValue: "A list of values is not edited here yet — open the note" } };
  }
  return { editable: true };
}
