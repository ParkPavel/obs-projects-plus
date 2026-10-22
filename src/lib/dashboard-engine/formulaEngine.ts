// formulaEngine.ts — thin re-export wrapper (R5-002 Phase 2).
// Implementation moved to src/lib/formula/extendedEvaluator.ts.

export {
  evaluateFormulaValue,
  evaluateFormulaWithError,
  validateFormulaExpression,
  getFormulaFunctions,
  isStyledValue,
  createFormulaPass,
} from "src/lib/formula";
export type {
  StyledValue,
  FormulaResult,
  FormulaPass,
} from "src/lib/formula";

export {
  getFormulaMetadata,
  getAllFormulaMetadata,
  type FormulaMetadata,
  type FormulaCategory,
} from "./formulaMetadata";
