import { createFormulaPass, evaluateExpression, evaluateFormulaNode, validateExpression } from "src/lib/formula";
import { DataFieldType } from "src/lib/dataframe/dataframe";
type FormulaNode = import("../syntax").FormulaNode;
const record = { id: "one.md", values: { amount: 2 } };
const frame = { fields: [{ name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false }], records: [record, { id: "two.md", values: { amount: 3 } }] };

test("a long flat chain validates and computes without structural-depth rejection", () => {
  const source = Array(8_000).fill("1").join("+");
  expect(validateExpression(source, [], "unified-v1")).toEqual([]);
  expect(evaluateExpression(source, { record, semantics: "unified-v1" })).toEqual({ value: 8_000 });
});

test("long operators inside a cached frame-wide function have iterative shape analysis", () => {
  const source = `SUM(@amount, ${Array(4_000).fill("1").join("+")})`;
  const pass = createFormulaPass(frame, "unified-v1");
  for (const row of frame.records) expect(evaluateExpression(source, { record: row, frame, pass, semantics: "unified-v1" })).toEqual({ value: 4_005 });
  expect(pass.frameValues.size).toBeGreaterThan(0);
});

test("a long chain within MAP uses its own scope and shared budget", () => {
  const tail = Array(1_000).fill("1").join("+");
  expect(evaluateExpression(`MAP([1,2], "item", item + ${tail})`, { record, semantics: "unified-v1" })).toEqual({ value: [1001, 1002] });
});

test("operator traversal preserves left-to-right side effects and association", () => {
  const random = jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.1).mockReturnValueOnce(0.2);
  try {
    expect(evaluateExpression("RANDOM_INT(1,10) - RANDOM_INT(1,10) - RANDOM_INT(1,10)", { record, semantics: "unified-v1" })).toEqual({ value: -4 });
    expect(random).toHaveBeenCalledTimes(3);
  } finally { random.mockRestore(); }
});

test("balanced external operators are stack-safe and still obey node limits", () => {
  let ast: FormulaNode = { type: "literal", value: 1 };
  for (let i = 0; i < 12; i++) ast = { type: "operator", operator: "+", left: ast, right: ast };
  expect(evaluateFormulaNode(ast, { record, semantics: "unified-v1" })).toBe(4096);
  for (let i = 0; i < 5; i++) ast = { type: "operator", operator: "+", left: ast, right: ast };
  expect(() => evaluateFormulaNode(ast, { record, semantics: "unified-v1" })).toThrow();
});
