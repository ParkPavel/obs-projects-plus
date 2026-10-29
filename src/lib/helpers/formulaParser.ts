/** Compatibility exports. New consumers use src/lib/formula. */
import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { FormulaNode } from "src/lib/formula/syntax";
import { evaluateFormulaNode } from "src/lib/formula/extendedEvaluator";
import { validateFormulaRaw } from "src/lib/formula/validation";
export { tokenize, parseFormula } from "src/lib/formula/syntax";
export type { FormulaNode, Token } from "src/lib/formula/syntax";
export function evaluateFormula(node: FormulaNode, record: DataRecord, baseDate?: Date): boolean {
  return Boolean(evaluateFormulaNode(node, { record, semantics: "legacy-filter", ...(baseDate !== undefined ? { referenceDate: baseDate } : {}) }));
}
export type ValidationError = { message: string; position?: number };
export function validateFormula(formula: string, availableFields: string[]): ValidationError[] {
  return validateFormulaRaw(formula, availableFields, "legacy-filter", true).map(message => ({ message }));
}
