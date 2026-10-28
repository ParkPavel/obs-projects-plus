import type { DataFrame, Optional, DataValue } from "src/lib/dataframe/dataframe";
import { applyFormulaFields, orderFormulaDefs } from "src/lib/dashboard-engine/applyFormulaFields";
import type { FormulaFieldDef } from "../types";

/** A proposed field is previewed by the same dependency and column passes as Apply. */
function programFor(definitions: readonly FormulaFieldDef[], name: string, expression: string): readonly FormulaFieldDef[] {
  return definitions.some(definition => definition.name === name)
    ? definitions.map(definition => definition.name === name ? { ...definition, expression } : definition)
    : [...definitions, { name, expression }];
}
export function formulaWouldCycle(definitions: readonly FormulaFieldDef[], name: string, expression: string): boolean {
  return orderFormulaDefs(programFor(definitions, name, expression)).cyclic.has(name);
}
export function previewFormulaField(
  frame: DataFrame, definitions: readonly FormulaFieldDef[], name: string, expression: string,
): { value: Optional<DataValue>; error: string | null } {
  let target = name;
  if (!target) {
    target = "__preview__";
    while (frame.fields.some(field => field.name === target) || definitions.some(definition => definition.name === target)) target += "_";
  }
  const program = programFor(definitions, target, expression);
  let error: string | null = null;
  const first = frame.records[0];
  const result = applyFormulaFields(frame, program, (field, id, message) => {
    if (field === target && id === first?.id) error = message;
  });
  return { value: result.records[0]?.values[target] ?? null, error };
}
