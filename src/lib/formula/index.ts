/**
 * R0.1 — Unified Formula Module entry point
 *
 * Revision 3 §1.5 mandates a SINGLE formula engine for the whole plugin
 * (Database column formulas, Schema-MVP modal, Agenda agendaFormula,
 * filter formula mode, Rollup custom calculation). Today these surfaces
 * each have their own parser/evaluator and they drift over time.
 *
 * This file is the canonical import path for the formula engine. New
 * call-sites MUST import from here (`src/lib/formula`). Migrations from
 * the legacy paths (`src/lib/helpers/formulaParser`) happen in R0.1b/c.
 *
 * Anchors:
 * - REVISION_3 §1.5
 * - .ai_internal/R0_4_ENTRY_POINTS_INVENTORY.md (lists `open-formula-editor`)
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
