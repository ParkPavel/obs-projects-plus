import { evaluateExpression } from "../extendedEvaluator";
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;
type Cell = DataRecord["values"][string];

const pairs: Array<[Cell, Cell, boolean, number | null]> = [
  [true, 1, true, 0], [false, 0, true, 0],
  [true, "1", true, 0], [false, "0", true, 0],
  [true, " TRUE ", true, 0], [false, " FALSE ", true, 0],
  [true, false, false, 1], [true, 2, false, -1],
  [true, "junk", false, null], [false, "", false, null],
  [false, null, false, null], [1, "junk", false, null],
  [1, " 1 ", true, 0], [" Alpha ", "alpha", true, 0],
  ["e", "é", false, -1], ["a", "B", false, -1],
  ["😀", "\ue000", false, -1],
  [Infinity, Infinity, false, null], [NaN, 0, false, null],
  [new Date("2026-10-01T00:00:00Z"), "2026-10-01T02:00:00+02:00", true, 0],
];

test.each(pairs)("new comparisons agree for %p and %p", (left, right, equal, order) => {
  function value(expression: string, a = left, b = right) {
    const result = evaluateExpression(expression, { record: { id: "synthetic.md", values: { lhs: a, rhs: b } }, semantics: "unified-v1" });
    expect(result.error).toBeUndefined();
    return result.value;
  }
  expect(value("lhs = rhs")).toBe(equal);
  expect(value("lhs = rhs", right, left)).toBe(equal);
  expect(value("lhs >= rhs")).toBe(order !== null && order >= 0);
  expect(value("lhs <= rhs")).toBe(order !== null && order <= 0);
  expect(value("lhs < rhs", right, left)).toBe(order !== null && order > 0);
});
