import { DataFieldType, type DataField, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
import { dateInputValue, parseStoredDate } from "src/lib/helpers/dateShape";
import { dayFromTyped, typedFromDay, parseTypedDate, formatTypedDate } from "src/lib/helpers/typedDate";
import dayjs from "dayjs";
import { toNumber } from "src/lib/engine/numeric";
import { editedCellValue } from "./editedCellValue";
type DateFormat = import("src/settings/v3/settings").DateFormatConfig;

export function cellDraftText(field: DataField, value: Optional<DataValue>, format?: DateFormat): string {
  if (field.type === DataFieldType.Date && field.typeConfig?.time === true) {
    const date = value instanceof Date ? value : typeof value === "string" ? parseStoredDate(value, format?.writeFormat) : null;
    if (date && !Number.isNaN(date.getTime())) return formatTypedDate(date, true);
  }
  return field.type === DataFieldType.Date ? typedFromDay(dateInputValue(value, format?.writeFormat)) : value == null ? "" : String(value);
}

/** Validation and serialization share the reader's numeric and date rules. */
export function parseCellDraft(field: DataField, stored: Optional<DataValue>, draft: string, format?: DateFormat):
  { ok: true; value: Optional<DataValue> } | { ok: false } {
  if (field.type === DataFieldType.Date && field.typeConfig?.time === true) {
    const parsed = parseTypedDate(draft);
    if (parsed.kind === "invalid") return { ok: false };
    if (parsed.kind === "date" && parsed.hasTime) {
      // Opening and accepting an unchanged clock must preserve seconds,
      // offsets and source spelling. Explicit clock edits use local time and
      // the source project's write format, as the existing datetime control.
      if (formatTypedDate(parsed.date, true) === cellDraftText(field, stored, format)) return { ok: true, value: stored };
      return { ok: true, value: dayjs(parsed.date).format(format ? `${format.writeFormat} HH:mm` : "YYYY-MM-DDTHH:mm") };
    }
  }
  const day = field.type === DataFieldType.Date ? dayFromTyped(draft) : draft;
  if (day === null || (field.type === DataFieldType.Number && draft.trim() !== "" && toNumber(draft) === null)) return { ok: false };
  return { ok: true, value: editedCellValue(field, stored, day, format) };
}
