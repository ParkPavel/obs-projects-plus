jest.mock("../limits", () => ({ ...jest.requireActual("../limits"), MAX_FORMULA_EVALUATION_STEPS: 13 }));
import { evaluateExpression } from "../extendedEvaluator";
const context = { record: { id: "synthetic.md", values: {} }, semantics: "unified-v1" as const };

test("each operator and literal is charged exactly once", () => {
  expect(evaluateExpression(Array(7).fill("1").join("+"), context)).toEqual({ value: 7 });
  expect(evaluateExpression(Array(8).fill("1").join("+"), context).error).toBeDefined();
  expect(evaluateExpression("2+2", context)).toEqual({ value: 4 });
});

test("a long unselected IF branch is analyzed safely but not evaluated", () => {
  const source = `IF(false, ${Array(4_000).fill("1").join("+")}, 3)`;
  expect(evaluateExpression(source, context)).toEqual({ value: 3 });
});
