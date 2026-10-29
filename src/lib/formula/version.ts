import type { FormulaSemantics } from "./catalog";
import { evaluateExpression, type FormulaEvaluationContext, type FormulaResult } from "./extendedEvaluator";
import { humanFormulaError } from "./formulaErrors";

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
