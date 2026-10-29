jest.mock("../limits", () => ({ ...jest.requireActual("../limits"), MAX_FORMULA_EVALUATION_STEPS: 50 }));
import { evaluateExpression, evaluateFormulaWithError } from "../extendedEvaluator";
import { createStandaloneFinancialBudget } from "../limits";
const record = { id: "synthetic.md", values: {} };

test("a direct solver's fallback budget accumulates iterations instead of resetting", () => {
  const charge = createStandaloneFinancialBudget(4);
  charge(2);
  charge(2);
  expect(() => charge(1)).toThrow("limit");
});

test.each(["IRR(-100,60,60)", "RATE(12,-100,1000)"])("nested %s calls share numerical work in both modes", expression => {
  const source = `MAP([1,2,3,4,5], "item", ${expression})`;
  expect(evaluateFormulaWithError(source, record).error).toContain("limit");
  expect(evaluateExpression(source, { record, semantics: "unified-v1" }).error).toContain("limit");
});

test("nested NPV cashflow work is bounded in compatibility mode too", () => {
  const source = 'MAP([1,2,3,4,5], "item", NPV(0.1,1,2,3,4,5,6,7,8,9,10,11,12))';
  expect(evaluateFormulaWithError(source, record).error).toContain("limit");
});

test("compatibility WORKDAYS charges its real day-by-day loop across nested calls", () => {
  const source = 'MAP([1,2,3,4,5], "item", WORKDAYS("2026-10-01","2026-10-15"))';
  expect(evaluateFormulaWithError(source, record).error).toContain("limit");
  expect(evaluateExpression(source, { record, semantics: "unified-v1" }).error).toBeUndefined();
});
