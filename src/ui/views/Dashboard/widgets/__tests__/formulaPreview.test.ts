import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { previewFormulaField, formulaWouldCycle } from "../formulaPreview";

const frame: DataFrame = {
  fields: [{ name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false }],
  records: [{ id: "a", values: { amount: 2 } }, { id: "b", values: { amount: 7 } }],
};
test("a column aggregate previews all rows, not just the selected record", () => {
  expect(previewFormulaField(frame, [], "sum", "SUM(@amount)")).toEqual({ value: 9, error: null });
  expect(previewFormulaField(frame, [], "", "SUM(@amount)").value).toBe(9);
  expect(frame.records[0]!.values).toEqual({ amount: 2 });
});
test("a preview reads another formula's completed column, regardless of saved order", () => {
  expect(previewFormulaField(frame, [{ name: "double", expression: "amount * 2" }], "sum", "SUM(@double)").value).toBe(18);
});
test("editing a self-referencing field reads raw values once, as Apply does", () => {
  expect(previewFormulaField(frame, [{ name: "amount", expression: "amount + 1" }], "amount", "amount + 2").value).toBe(4);
});
test("runtime errors from the canonical pass reach the preview", () => {
  const result = previewFormulaField(frame, [], "broken", "UNKNOWN(amount)");
  expect(result.value).toBeNull();
  expect(result.error).toBeTruthy();
});
test("a proposed definition cannot introduce a dependency cycle", () => {
  expect(formulaWouldCycle([{ name: "later", expression: "result + 1" }], "result", "later + 1")).toBe(true);
  expect(formulaWouldCycle([], "amount", "amount + 1")).toBe(false);
});
