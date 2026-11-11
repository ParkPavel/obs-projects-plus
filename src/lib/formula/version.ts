import type { FormulaSemantics } from "./catalog";
import { evaluateExpression, type FormulaEvaluationContext, type FormulaResult } from "./extendedEvaluator";
import { humanFormulaError } from "./formulaErrors";
import { validateExpression } from "./validation";

/** The single current rule set; missing markers are persisted by the guarded settings migration. */
export interface VersionedFormula {
  readonly formulaVersion?: string;
}

export function formulaSemantics(
  version: unknown,
): FormulaSemantics {
  if (version === undefined) return "unified-v1";
  if (version === "unified-v1") return version;
  throw new Error("Unsupported formula version");
}

/** An unsupported saved version has no editable execution profile. */
export function formulaEditorSemantics(version: unknown): FormulaSemantics | undefined {
  try { return formulaSemantics(version); } catch { return undefined; }
}

export function validateVersionedFormula(expression: string, fields: string[], version: unknown): string[] {
  const semantics = formulaEditorSemantics(version);
  return semantics ? validateExpression(expression, fields, semantics) : [humanFormulaError("Unsupported formula version")];
}

/** Untrusted persisted versions fail closed without echoing their contents. */
export function evaluateVersionedFormula(
  expression: string,
  version: unknown,
  context: Omit<FormulaEvaluationContext, "semantics">,
): FormulaResult {
  try {
    return evaluateExpression(expression, { ...context, semantics: formulaSemantics(version) });
  } catch {
    return { value: null, error: humanFormulaError("Unsupported formula version") };
  }
}
