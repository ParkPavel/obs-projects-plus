import type { FormulaSemantics } from "./catalog";
import { evaluateExpression, type FormulaEvaluationContext, type FormulaResult } from "./extendedEvaluator";
import { humanFormulaError } from "./formulaErrors";
import { validateExpression } from "./validation";

/** Absent means the original rules of the consuming surface. Never migrate on read. */
export interface VersionedFormula {
  readonly formulaVersion?: string;
}

export function formulaSemantics(
  version: unknown,
  legacy: Exclude<FormulaSemantics, "unified-v1">,
): FormulaSemantics {
  if (version === undefined) return legacy;
  if (version === "unified-v1") return version;
  throw new Error("Unsupported formula version");
}

/** An unsupported saved version has no editable execution profile. */
export function formulaEditorSemantics(version: unknown, legacy: Exclude<FormulaSemantics, "unified-v1">): FormulaSemantics | undefined {
  try { return formulaSemantics(version, legacy); } catch { return undefined; }
}

export function validateVersionedFormula(expression: string, fields: string[], version: unknown,
  legacy: Exclude<FormulaSemantics, "unified-v1"> = "legacy-computed"): string[] {
  const semantics = formulaEditorSemantics(version, legacy);
  return semantics ? validateExpression(expression, fields, semantics) : [humanFormulaError("Unsupported formula version")];
}

/** Untrusted persisted versions fail closed without echoing their contents. */
export function evaluateVersionedFormula(
  expression: string,
  version: unknown,
  context: Omit<FormulaEvaluationContext, "semantics">,
  legacy: Exclude<FormulaSemantics, "unified-v1"> = "legacy-computed",
): FormulaResult {
  try {
    return evaluateExpression(expression, { ...context, semantics: formulaSemantics(version, legacy) });
  } catch {
    return { value: null, error: humanFormulaError("Unsupported formula version") };
  }
}
