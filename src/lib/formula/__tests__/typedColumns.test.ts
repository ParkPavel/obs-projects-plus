import { createFormulaPass, evaluateExpression, evaluateFormulaWithError } from "src/lib/formula";
import { DataFieldType } from "src/lib/dataframe/dataframe";
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;
const firstDate = new Date("2026-10-01T00:00:00Z"), secondDate = new Date("2026-10-02T00:00:00Z");
const records: DataRecord[] = [
  { id: "one.md", values: { status: "Open", amount: "2", due: firstDate, tags: ["red"], done: true } },
  { id: "two.md", values: { status: "Closed", amount: 3, due: secondDate, tags: ["blue", "green"], done: false } },
  { id: "blank.md", values: { status: null, amount: null, due: null, tags: [], done: null } },
  { id: "absent.md", values: {} },
];
const frame = { records, fields: Object.keys(records[0]!.values).map(name => ({ name, type: DataFieldType.Unknown, repeated: false, identifier: false, derived: false })) };
const context = { record: records[0]!, frame, semantics: "unified-v1" as const };

test.each([
  ["status", ["Open", "Closed", null, undefined]], ["amount", ["2", 3, null, undefined]],
  ["due", [firstDate, secondDate, null, undefined]], ["done", [true, false, null, undefined]],
  ["tags", [["red"], ["blue", "green"], [], undefined]],
])("new column %s keeps types, positions and absence", (name, expected) => {
  expect(evaluateExpression(`MAP(@${name}, "item", item)`, context)).toEqual({ value: expected });
});

test("legacy numeric columns and aggregate behavior are unchanged", () => {
  expect(evaluateFormulaWithError("@status", records[0]!, frame)).toEqual({ value: [] });
  expect(evaluateExpression("SUM(@amount)", context)).toEqual({ value: 5 });
  expect(evaluateExpression("COUNT(@status)", context)).toEqual({ value: 2 });
});

test("new COUNT follows its non-null metadata while legacy list counting is retained", () => {
  expect(evaluateExpression("COUNT([1,null,false,0])", context)).toEqual({ value: 3 });
  expect(evaluateFormulaWithError("COUNT([1,null,false,0])", records[0]!)).toEqual({ value: 4 });
});

test("new column results copy the outer array instead of sharing a mutable result", () => {
  const pass = createFormulaPass(frame, "unified-v1");
  const a = evaluateExpression("@status", { ...context, pass }), b = evaluateExpression("@status", { ...context, pass });
  expect(a.value).not.toBe(b.value);
  if (!Array.isArray(a.value)) throw new Error("Expected a list");
  a.value[0] = "changed";
  expect(b.value).toEqual(["Open", "Closed", null, undefined]);
  expect(records[0]!.values["status"]).toBe("Open");
});

test("new columns never read inherited properties", () => {
  const inherited: DataRecord = { id: "inherited.md", values: Object.assign(Object.create({ status: "hidden" }), { amount: 7 }) };
  expect(evaluateExpression("@status", { ...context, frame: { ...frame, records: [inherited] } })).toEqual({ value: [undefined] });
  expect(evaluateExpression("@constructor", { ...context, frame: { ...frame, records: [inherited] } })).toEqual({ value: [undefined] });
});

test("a column reference without a frame reports missing data instead of zero", () => {
  expect(evaluateExpression("SUM(@amount)", { record: records[0]!, semantics: "unified-v1" }).error).toBeDefined();
});
