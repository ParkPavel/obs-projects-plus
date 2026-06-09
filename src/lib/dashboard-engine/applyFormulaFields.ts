// MPLAN-001 — Apply formula fields to a DataFrame.
//
// Takes a DataFrame plus the user-saved formula definitions from
// `DatabaseViewConfig.formulaFields` and returns a new DataFrame with each
// formula evaluated per record and appended as a derived DataField.
//
// The downstream Table cell router already handles String / Number / Boolean
// / Date by inferred type, so injecting computed values here is enough to
// make formula columns render inline (the previous behaviour was to save the
// definition but never compute it).

import {
  DataFieldType,
  type DataField,
  type DataFrame,
  type DataRecord,
  type DataValue,
  type Optional,
} from "src/lib/dataframe/dataframe";
import { evaluateFormulaValue } from "src/lib/formula/extendedEvaluator";
import type { FormulaFieldDef } from "src/ui/views/Dashboard/types";

function inferType(value: Optional<DataValue>): DataFieldType {
  if (value == null) return DataFieldType.String;
  if (typeof value === "number") return DataFieldType.Number;
  if (typeof value === "boolean") return DataFieldType.Boolean;
  if (value instanceof Date) return DataFieldType.Date;
  if (Array.isArray(value)) return DataFieldType.List;
  return DataFieldType.String;
}

function firstNonNull(
  records: DataRecord[],
  name: string
): Optional<DataValue> {
  for (const r of records) {
    const v = r.values[name];
    if (v != null) return v;
  }
  return null;
}

export function applyFormulaFields(
  frame: DataFrame,
  formulaFields: readonly FormulaFieldDef[] | undefined
): DataFrame {
  if (!formulaFields || formulaFields.length === 0) return frame;

  const existingNames = new Set(frame.fields.map((f) => f.name));
  const defs = formulaFields.filter((d) => d.name && d.expression);
  if (defs.length === 0) return frame;

  const newRecords: DataRecord[] = frame.records.map((record) => {
    const newValues = { ...record.values };
    const evalRecord: DataRecord = { id: record.id, values: newValues };
    for (const def of defs) {
      try {
        newValues[def.name] = evaluateFormulaValue(
          def.expression,
          evalRecord,
          frame
        );
      } catch {
        newValues[def.name] = null;
      }
    }
    return { ...record, values: newValues };
  });

  const appendedFields: DataField[] = defs
    .filter((d) => !existingNames.has(d.name))
    .map((d) => {
      const sample = firstNonNull(newRecords, d.name);
      const declared = d.resultType;
      const type: DataFieldType = declared
        ? declared === "string"
          ? DataFieldType.String
          : declared === "number"
            ? DataFieldType.Number
            : declared === "boolean"
              ? DataFieldType.Boolean
              : DataFieldType.Date
        : inferType(sample);
      return {
        name: d.name,
        type,
        repeated: false,
        identifier: false,
        derived: true,
      };
    });

  return {
    ...frame,
    fields: [...frame.fields, ...appendedFields],
    records: newRecords,
  };
}
