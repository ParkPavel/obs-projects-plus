import { DataFieldType, type DataField, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
import { dateInputValue } from "src/lib/helpers/dateShape";
import { dayFromTyped, typedFromDay } from "src/lib/helpers/typedDate";
import { toNumber } from "src/lib/engine/numeric";
import { editedCellValue } from "./editedCellValue";
type DateFormat = import("src/settings/v3/settings").DateFormatConfig;

export function cellDraftText(field: DataField, value: Optional<DataValue>, format?: DateFormat): string {
  return field.type === DataFieldType.Date ? typedFromDay(dateInputValue(value, format?.writeFormat)) : value == null ? "" : String(value);
}

/** Validation and serialization share the reader's numeric and date rules. */
export function parseCellDraft(field: DataField, stored: Optional<DataValue>, draft: string, format?: DateFormat):
  { ok: true; value: Optional<DataValue> } | { ok: false } {
  const day = field.type === DataFieldType.Date ? dayFromTyped(draft) : draft;
  if (day === null || (field.type === DataFieldType.Number && draft.trim() !== "" && toNumber(draft) === null)) return { ok: false };
  return { ok: true, value: editedCellValue(field, stored, day, format) };
}
