import { DataFieldType, type DataField, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
import { toNumber } from "src/lib/engine/numeric";
import { dateToStore } from "src/lib/helpers/dateShape";

type DateFormatConfig = import("src/settings/v3/settings").DateFormatConfig;

/** Typed conversion lives outside the UI; all numbers use the canonical rule. */
export function editedCellValue(field: DataField, stored: Optional<DataValue>, raw: string, dateFormat?: DateFormatConfig): Optional<DataValue> {
  if (field.type === DataFieldType.Number) return toNumber(raw);
  if (field.type === DataFieldType.Date) return dateToStore(stored, raw, field.typeConfig?.time === true, dateFormat);
  return raw;
}
