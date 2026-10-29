import dayjs from "dayjs";
import { evaluateExpression, evaluateFormulaWithError } from "../extendedEvaluator";
const record = { id: "synthetic.md", values: {} };

test.each([
  ["2026-10-05", "2026-10-09", 4],
  ["2026-10-02", "2026-10-05", 1],
  ["2026-10-05", "2026-10-02", -1],
  ["2026-10-03", "2026-10-04", 0],
  ["2026-10-07", "2026-10-06", -1],
  ["2026-10-02T23:59:00", "2026-10-05T00:01:00", 1],
  ["2026-10-05T00:01:00", "2026-10-02T23:59:00", -1],
  ["2026-10-05T23:59:00", "2026-10-05T00:01:00", 0],
] as const)("new WORKDAYS(%s,%s) has signed calendar distance %s", (start, end, expected) => {
  expect(evaluateExpression(`WORKDAYS("${start}","${end}")`, { record, semantics: "unified-v1" })).toEqual({ value: expected });
});

test("new calendar work does not scale with interval length", () => {
  const original = dayjs.prototype.add;
  let calls = 0;
  const add = jest.spyOn(dayjs.prototype, "add").mockImplementation(function (this: dayjs.Dayjs, value, unit) {
    if (++calls > 1_000) throw new Error("Test harness stopped the old day-by-day loop");
    return original.call(this, value, unit);
  });
  try {
    const source = 'WORKDAYS("2000-01-01","2099-12-31")';
    const result = evaluateExpression(source, { record, semantics: "unified-v1" });
    expect(result).toEqual({ value: 26089 });
    expect(add.mock.calls.length).toBeLessThanOrEqual(6);
  } finally { add.mockRestore(); }
});

test("compatibility keeps descending negative zero", () => {
  expect(Object.is(evaluateFormulaWithError('WORKDAYS("2026-10-05","2026-10-02")', record).value, -0)).toBe(true);
});
