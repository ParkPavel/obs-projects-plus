import { evaluateExpression } from "../extendedEvaluator";

test.each([
  ["2026-10-01 UTC", "2026-10-01 GMT", false],
  ["2026-02-30", "2026-03-02", false],
  ["2026-13-01", "2027-01-01", false],
  ["2026-10-01T24:01:00", "2026-10-02T00:01:00", false],
  ["2026-10-01T12:30:00Z", "2026-10-01T14:30:00+02:00", true],
  ["2026-10-01T24:00:00Z", "2026-10-02T00:00:00Z", true],
])("new date recognition compares complete supported forms only: %s / %s", (a, b, expected) => {
  expect(evaluateExpression("a = b", { record: { id: "synthetic.md", values: { a, b } }, semantics: "unified-v1" })).toEqual({ value: expected });
});
