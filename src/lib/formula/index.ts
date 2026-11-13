/**
 * Canonical formula entry: one AST runtime and executable function catalog.
 * Existing boolean/computed APIs retain their compatibility profiles. New
 * rules require an explicit evaluation context; saved formulas are not migrated
 * by importing this module. Persisted definitions carry an optional version;
 * the explicit editor opt-in is integrated separately from the data layer.
 */
export {
  tokenize,
  parseFormula,
  evaluateFormula,
  validateFormula,
} from "src/lib/helpers/formulaParser";
export type {
  FormulaNode,
  Token,
  ValidationError,
} from "src/lib/helpers/formulaParser";

// Date formula surface — re-exported for canonical import path (R5-002)
export {
  parseDateFormula,
  isDateFormula,
  getDateFormulaSuggestions,
  testDateFormula,
} from "src/lib/helpers/dateFormulaParser";
export type {
  DateFormulaResult,
  DateFormulaSuggestion,
} from "src/lib/helpers/dateFormulaParser";

// Extended evaluator for FormulaField computed columns (R5-002 Phase 2)
export {
  evaluateFormulaValue,
  evaluateFormulaWithError,
  validateFormulaExpression,
  getFormulaFunctions,
  isStyledValue,
  createFormulaPass,
  evaluateExpression,
  evaluateFormulaNode,
} from "./extendedEvaluator";
export type {
  StyledValue,
  FormulaResult,
  FormulaPass,
  FormulaEvaluationContext,
} from "./extendedEvaluator";
export { getFormulaCatalog, getFormulaDefinition } from "./catalog";
export type { FormulaSemantics, FormulaDefinition } from "./catalog";
export { validateExpression } from "./validation";
export { formulaSemantics, evaluateVersionedFormula } from "./version";
export type { VersionedFormula } from "./version";
export type { FormulaSyntaxPolicy } from "./syntax";
// i3-final: the criteria language of SUMIF / COUNTIF / the *IFS family
export { compileCriterion, matchingRows } from "./criteria";

