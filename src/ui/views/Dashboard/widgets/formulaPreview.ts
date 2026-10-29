import type { DataFrame, Optional, DataValue } from "src/lib/dataframe/dataframe";
import { applyFormulaFields, orderFormulaDefs } from "src/lib/dashboard-engine/applyFormulaFields";
import type { FormulaFieldDef } from "../types";
import type { VersionedFormula } from "src/lib/formula/version";

/** A proposed field is previewed by the same dependency and column passes as Apply. */
function programFor(definitions: readonly FormulaFieldDef[], name: string, expression: string, draft?: VersionedFormula): readonly FormulaFieldDef[] {
  const updated = (definition: FormulaFieldDef): FormulaFieldDef => {
    if (!draft) return { ...definition, expression };
    const { formulaVersion: _oldVersion, ...rest } = definition;
    return { ...rest, expression, ...(draft.formulaVersion !== undefined ? { formulaVersion: draft.formulaVersion } : {}) };
  };
  return definitions.some(definition => definition.name === name)
    ? definitions.map(definition => definition.name === name ? updated(definition) : definition)
    : [...definitions, updated({ name, expression })];
}
export function formulaWouldCycle(definitions: readonly FormulaFieldDef[], name: string, expression: string, draft?: VersionedFormula): boolean {
  return orderFormulaDefs(programFor(definitions, name, expression, draft)).cyclic.has(name);
}
export function previewFormulaField(
  frame: DataFrame, definitions: readonly FormulaFieldDef[], name: string, expression: string,
  draft?: VersionedFormula,
): { value: Optional<DataValue>; error: string | null } {
  let target = name;
  if (!target) {
    target = "__preview__";
    while (frame.fields.some(field => field.name === target) || definitions.some(definition => definition.name === target)) target += "_";
  }
  const program = programFor(definitions, target, expression, draft);
  let error: string | null = null;
  const first = frame.records[0];
  const result = applyFormulaFields(frame, program, (field, id, message) => {
    if (field === target && id === first?.id) error = message;
  });
  return { value: result.records[0]?.values[target] ?? null, error };
}
