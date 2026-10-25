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
//
// i3-data: «математика таблиц как в Google Sheets / Notion». Formulas are
// evaluated in DEPENDENCY order, not stored order, so `b = a * 2` works
// whichever of the two was created first; and column by column, so a later
// formula's column aggregate (`SUM(@total)`) sees the computed column. A loop
// between formulas (a → b → a) is not evaluated at all: its columns are empty
// (null) rather than holding a value from a half-finished pass.

import {
  DataFieldType,
  type DataField,
  type DataFrame,
  type DataRecord,
  type DataValue,
  type Optional,
} from "src/lib/dataframe/dataframe";
import { createFormulaPass, evaluateFormulaValue } from "src/lib/formula/extendedEvaluator";
import { resolveFieldName } from "src/lib/formula/formulaErrors";
import { parseFormula, type FormulaNode } from "src/lib/helpers/formulaParser";
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

/** Every field or column name an expression mentions (unparseable → none). */
export function referencedNames(expression: string): string[] {
  let ast: FormulaNode;
  try { ast = parseFormula(expression); } catch { return []; }
  const out: string[] = [];
  const walk = (n: FormulaNode): void => {
    if (n.type === "field" || n.type === "column_ref") out.push(n.name);
    else if (n.type === "function") n.args.forEach(walk);
    else if (n.type === "operator") { walk(n.left); walk(n.right); }
    else if (n.type === "array") n.items.forEach(walk);
  };
  walk(ast);
  return out;
}

/**
 * i3-data: the formulas in an order where each comes after every formula it
 * reads, and the names caught in a loop. A formula naming ITSELF reads the
 * stored value of that key (`qty = qty + 1`), so a self-reference is no loop.
 * Kahn's algorithm: linear in formulas + references, terminates on any input.
 */
export function orderFormulaDefs<T extends { name: string; expression: string }>(
  defs: readonly T[]
): { ordered: T[]; cyclic: Set<string> } {
  const names = defs.map((d) => d.name);
  const deps = new Map<string, Set<string>>();
  for (const d of defs) {
    const own = new Set<string>();
    for (const ref of referencedNames(d.expression)) {
      const target = resolveFieldName(ref, names);
      if (target !== undefined && target !== d.name) own.add(target);
    }
    deps.set(d.name, own);
  }
  const ordered: T[] = [];
  const done = new Set<string>();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const d of defs) {
      if (done.has(d.name)) continue;
      if ([...(deps.get(d.name) ?? [])].every((n) => done.has(n))) {
        done.add(d.name);
        ordered.push(d);
        progressed = true;
      }
    }
  }
  const cyclic = new Set(defs.filter((d) => !done.has(d.name)).map((d) => d.name));
  return { ordered, cyclic };
}

export function applyFormulaFields(
  frame: DataFrame,
  formulaFields: readonly FormulaFieldDef[] | undefined
): DataFrame {
  if (!formulaFields || formulaFields.length === 0) return frame;

  const existingNames = new Set(frame.fields.map((f) => f.name));
  const defs = formulaFields.filter((d) => d.name && d.expression);
  if (defs.length === 0) return frame;

  const { ordered, cyclic } = orderFormulaDefs(defs);
  let records: DataRecord[] = frame.records.map((record) => ({ ...record, values: { ...record.values } }));
  for (const name of cyclic) for (const r of records) r.values[name] = null;
  for (const def of ordered) {
    // The frame as computed so far: column references read finished columns.
    const current: DataFrame = { ...frame, records };
    // i3-final: one pass per formula column — `SUM(@amount)` is computed once
    // for the column, not once per record (was O(N²) on large tables). The
    // pass belongs to `current`, which no later formula reuses.
    const pass = createFormulaPass(current);
    records = records.map((record) => {
      let value: Optional<DataValue>;
      try {
        value = evaluateFormulaValue(def.expression, record, current, pass);
      } catch {
        value = null;
      }
      record.values[def.name] = value;
      return record;
    });
  }
  const newRecords = records;

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
