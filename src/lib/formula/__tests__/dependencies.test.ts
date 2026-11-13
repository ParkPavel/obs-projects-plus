import { applyFormulaFields, orderFormulaDefs, referencedNames } from "src/lib/dashboard-engine/applyFormulaFields";
import { formulaWouldCycle } from "src/ui/views/Dashboard/widgets/formulaPreview";

test.each([
  'LET("y", 1, y)', 'LETS("y", 1, "z", y + 1, z - 1)',
  'SUM(MAP([1], "y", y))', 'SUM(FILTER([1], "y", y > 0))',
  'REDUCE([1], "y", "acc", 0, acc + y)', 'LET("y", 1, PROP("y"))',
])("local names do not create a false column cycle: %s", expression => {
  const definitions = [{ name: "x", expression }, { name: "y", expression: "x + 1" }];
  expect(orderFormulaDefs(definitions).cyclic.size).toBe(0);
  expect(formulaWouldCycle(definitions, "x", expression)).toBe(false);
  const result = applyFormulaFields({ fields: [], records: [{ id: "a.md", values: {} }] }, definitions);
  expect(result.records[0]!.values).toMatchObject({ x: 1, y: 2 });
});

test.each([
  ['LET("y", y + 1, y)', ["y"]],
  ['LETS("y", source, "z", y + other, z)', ["source", "other"]],
  ['LET("y", 1, SUM(@y))', ["y"]],
  ['LET("y", 1, PROP("Y"))', ["Y"]],
  ['MAP(items, "item", item + source)', ["items", "source"]],
  ['REDUCE(items, "item", "acc", source, acc + item + extra)', ["items", "source", "extra"]],
] as const)("real initializer, column and outer references remain dependencies: %s", (expression, expected) => {
  expect(referencedNames(expression)).toEqual(expected);
});

test("initializer dependencies still block real cycles", () => {
  expect(orderFormulaDefs([{ name: "x", expression: 'LET("y", y, y)' }, { name: "y", expression: "x + 1" }]).cyclic).toEqual(new Set(["x", "y"]));
});
