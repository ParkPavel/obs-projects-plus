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
import { createFormulaPass } from "src/lib/formula/extendedEvaluator";
import { resolveFieldName } from "src/lib/formula/formulaErrors";
import { parseFormula, type FormulaNode } from "src/lib/helpers/formulaParser";
import { evaluateVersionedFormula, formulaSemantics, type VersionedFormula } from "src/lib/formula/version";
import { assertFormulaLimits, MAX_FORMULA_INPUT_LENGTH } from "src/lib/formula/limits";
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

function bindingName(node: FormulaNode | undefined, fallback?: string): string | undefined {
  return node?.type === "literal" ? String(node.value) : node?.type === "field" ? node.name : fallback;
}

/** Record/column dependencies, excluding lexically scoped names (unparseable → none). */
export function referencedNames(expression: string, formulaVersion?: string): string[] {
  let ast: FormulaNode;
  try {
    formulaSemantics(formulaVersion);
    if (expression.length > MAX_FORMULA_INPUT_LENGTH) return [];
    ast = parseFormula(expression, undefined, "strict");
    assertFormulaLimits(ast);
  } catch { return []; }
  const out: string[] = [];
  const pending: Array<{ node: FormulaNode; scope: ReadonlySet<string> }> = [{ node: ast, scope: new Set() }];
  while (pending.length) {
    const { node: n, scope } = pending.pop()!;
    if (n.type === "column_ref" || (n.type === "field" && !scope.has(n.name))) out.push(n.name);
    else if (n.type === "function") {
      if (n.name === "PROP") {
        const name = bindingName(n.args[0]);
        if (name && !scope.has(name)) out.push(name);
      } else if (n.name === "LET" || n.name === "LETS") {
        const visits: typeof pending = [];
        let local: ReadonlySet<string> = scope;
        const pairs = n.name === "LET" ? 1 : Math.floor((n.args.length - 1) / 2);
        for (let i = 0; i < pairs; i++) {
          const value = n.args[i * 2 + 1], name = bindingName(n.args[i * 2]);
          if (value) visits.push({ node: value, scope: local });
          if (name) local = new Set([...local, name]);
        }
        const result = n.args[n.name === "LET" ? 2 : n.args.length - 1];
        if (result) visits.push({ node: result, scope: local });
        pending.push(...visits.reverse());
      } else if (["MAP", "FILTER", "REDUCE"].includes(n.name)) {
        const local = new Set(scope);
        local.add(bindingName(n.args[1], "item")!);
        const reduce = n.name === "REDUCE";
        if (reduce) local.add(bindingName(n.args[2], "acc")!);
        const result = n.args[reduce ? 4 : 2];
        if (result) pending.push({ node: result, scope: local });
        if (reduce && n.args[3]) pending.push({ node: n.args[3], scope });
        if (n.args[0]) pending.push({ node: n.args[0], scope });
      } else for (let i = n.args.length - 1; i >= 0; i--) pending.push({ node: n.args[i]!, scope });
    }
    else if (n.type === "operator") pending.push({ node: n.right, scope }, { node: n.left, scope });
    else if (n.type === "array") {
      for (let i = n.items.length - 1; i >= 0; i--) pending.push({ node: n.items[i]!, scope });
    }
  }
  return out;
}

/**
 * i3-data: the formulas in an order where each comes after every formula it
 * reads, and the names caught in a loop. A formula naming ITSELF reads the
 * stored value of that key (`qty = qty + 1`), so a self-reference is no loop.
 * Kahn's algorithm: linear in formulas + references, terminates on any input.
 */
export function orderFormulaDefs<T extends VersionedFormula & { name: string; expression: string }>(
  defs: readonly T[]
): { ordered: T[]; cyclic: Set<string> } {
  const names = defs.map((d) => d.name);
  const deps = new Map<string, Set<string>>();
  for (const d of defs) {
    const own = new Set<string>();
    for (const ref of referencedNames(d.expression, d.formulaVersion)) {
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
  formulaFields: readonly FormulaFieldDef[] | undefined,
  reportError?: (field: string, recordId: string, message: string) => void,
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
    const fields = [...frame.fields, ...ordered.slice(0, ordered.indexOf(def))
        .filter(prior => !existingNames.has(prior.name))
        .map(prior => ({ name: prior.name, type: inferType(firstNonNull(records, prior.name)), repeated: false, identifier: false, derived: true }))];
    const current: DataFrame = { ...frame, fields, records };
    // i3-final: one pass per formula column — `SUM(@amount)` is computed once
    // for the column, not once per record (was O(N²) on large tables). The
    // pass belongs to `current`, which no later formula reuses.
    const pass = createFormulaPass(current);
    records = records.map((record) => {
      let value: Optional<DataValue>;
      try {
        const result = evaluateVersionedFormula(def.expression, def.formulaVersion, { record, frame: current, pass });
        value = result.value;
        if (result.error) reportError?.(def.name, record.id, result.error);
      } catch {
        value = null;
      }
      return { ...record, values: { ...record.values, [def.name]: value } };
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
