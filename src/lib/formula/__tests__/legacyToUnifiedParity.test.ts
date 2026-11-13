import { evaluateFormulaWithError, evaluateExpression } from "src/lib/formula/extendedEvaluator";
import type { DataRecord } from "src/lib/dataframe/dataframe";

/**
 * These demo vectors agree between profiles. They are regression examples,
 * not proof that arbitrary saved expressions can be migrated automatically.
 */
const REAL_FORMULAS = [
  'IF(AND(type = "visit", status = "проведён"), 1)',
  'IF(AND(type = "visit", status = "проведён", paid), price)',
  'IF(AND(type = "visit", status = "проведён", NOT(paid)), price)',
  'IF(type = "expense", 0 - amount, paidAmount)',
  'IF(AND(type = "op", kind = "доход"), amount)',
  'IF(AND(type = "op", kind = "расход"), amount)',
  'IF(type = "op", IF(kind = "доход", amount, 0 - amount), 0)',
];

const record = (values: Record<string, unknown>): DataRecord => ({ id: "r", values: values as DataRecord["values"] });
const SAMPLES = [
  { type: "visit", status: "проведён", paid: true, price: 4000, amount: 0, paidAmount: 4000, kind: "доход" },
  { type: "visit", status: "проведён", paid: false, price: 1500, amount: 0, paidAmount: 0, kind: "доход" },
  { type: "visit", status: "отменён", paid: false, price: 1500, amount: 0, paidAmount: 0, kind: "доход" },
  { type: "expense", amount: 700, paidAmount: 0 },
  { type: "op", kind: "доход", amount: 1200 },
  { type: "op", kind: "расход", amount: 300 },
  { type: "op", kind: "доход" },
  {},
];

describe("owner demo formulas agree across the public adapters", () => {
  for (const expression of REAL_FORMULAS) {
    it(expression, () => {
      for (const sample of SAMPLES) {
        const legacy = evaluateFormulaWithError(expression, record(sample));
        const unified = evaluateExpression(expression, { record: record(sample), semantics: "unified-v1" });
        expect({ sample, value: unified.value, error: unified.error ?? null }).toEqual({ sample, value: legacy.value, error: legacy.error ?? null });
      }
    });
  }
});
