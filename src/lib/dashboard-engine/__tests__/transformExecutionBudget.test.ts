import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { executeTransform } from "../transformExecutor";
import type { TransformContext, TransformPipeline, TransformStep } from "../transformTypes";

const fields = [{ name: "amount", type: DataFieldType.Number, repeated: false, derived: false, identifier: false }];
const frame = (count: number): DataFrame => ({ fields, records: Array.from({ length: count }, (_, id) => ({ id: `${id}.md`, values: { amount: id } })) });
const compute = (name: string, expression = "amount + 1") => ({ type: "compute" as const, columns: [{ name, expression }] });
// The execution controls are runtime-only, never persisted as pipeline settings.
const controls = (workLimit: number, signal?: AbortSignal): TransformContext => ({ workLimit, ...(signal ? { signal } : {}) });

test("an already cancelled pipeline never executes its first step", () => {
  const input = frame(4), controller = new AbortController(); controller.abort();
  const result = executeTransform(input, { steps: [compute("computed")] }, controls(1000, controller.signal));
  expect(result.data).toBe(input); expect(result.meta.stepsExecuted).toBe(0);
  expect(result.meta.warnings.join(" ")).toMatch(/cancel/i);
});
test("a work limit interrupts a single compute step and publishes no partial rows", () => {
  const input = frame(100), result = executeTransform(input, { steps: [compute("computed")] }, controls(20));
  expect(result.data).toBe(input); expect(result.derivedFields).toEqual([]); expect(result.meta.stepsExecuted).toBe(0);
  expect(result.meta.warnings.join(" ")).toMatch(/work limit/i);
});
test("several completed steps share a single budget; a failed step retains the last complete frame", () => {
  const input = frame(10), pipeline: TransformPipeline = { steps: [compute("first"), compute("second")] };
  const result = executeTransform(input, pipeline, controls(55));
  expect(result.meta.stepsExecuted).toBe(1);
  expect(result.data.records).toHaveLength(10);
  expect(result.data.records.every(record => record.values["first"] !== undefined && record.values["second"] === undefined)).toBe(true);
  expect(result.meta.warnings.join(" ")).toMatch(/work limit/i);
});
test.each([undefined, "unified-v1" as const])("financial work across rows shares the pipeline budget (%s)", formulaVersion => {
  const input = frame(10), result = executeTransform(input, { steps: [{ type: "compute", columns: [{ name: "payment", expression: "CUMPRINC(0.01, 100, 1000, 1, 80, 0) + amount", ...(formulaVersion ? { formulaVersion } : {}) }] }] }, controls(200));
  expect(result.meta.stepsExecuted).toBe(0); expect(result.data).toBe(input);
  expect(result.meta.warnings.join(" ")).toMatch(/work limit/i);
});
test("normal pipelines preserve their result under ample budget", () => {
  const input = frame(10), pipeline = { steps: [compute("computed")] };
  expect(executeTransform(input, pipeline, controls(10000)).data).toEqual(executeTransform(input, pipeline).data);
});
test("an unrelated execution failure is not relabelled as cancellation", () => {
  const input = frame(1); Object.defineProperty(input.records[0], "values", { get() { throw new Error("Broken source"); } });
  expect(() => executeTransform(input, { steps: [compute("computed")] })).toThrow("Broken source");
});
test("cancellation observed inside a step prevents publishing that step", () => {
  const input = frame(10), controller = new AbortController();
  Object.defineProperty(input.records[0]!.values, "amount", { enumerable: true, get() { controller.abort(); return 1; } });
  const result = executeTransform(input, { steps: [compute("computed")] }, controls(1000, controller.signal));
  expect(result.data).toBe(input); expect(result.meta.stepsExecuted).toBe(0); expect(result.meta.warnings.join(" ")).toMatch(/cancel/i);
});
test("the deadline is checked within a single step", () => {
  let clock = 0; const now = jest.spyOn(performance, "now").mockImplementation(() => clock++ * 400);
  try {
    const input = frame(20), result = executeTransform(input, { steps: [compute("computed")] });
    expect(result.data).toBe(input); expect(result.meta.stepsExecuted).toBe(0); expect(result.meta.warnings.join(" ")).toMatch(/deadline/i);
  } finally { now.mockRestore(); }
});
const steps: TransformStep[] = [
  { type: "unnest", field: "items" },
  { type: "unpivot", fieldGroups: [{ pattern: "item(\\d+)", outputName: "item" }], keepFields: ["amount"] },
  { type: "filter", conditions: { conjunction: "and", conditions: [{ field: "amount", operator: "is", value: "1", enabled: true }] } },
  { type: "group-by", fields: ["amount"] },
  { type: "aggregate", columns: [{ sourceField: "amount", outputName: "total", function: "SUM" }] },
  { type: "pivot", categoryField: "amount", valueField: "item1", aggregation: "SUM" },
  { type: "join", rightSourceId: "right", on: { leftKey: "amount", rightKey: "amount" }, how: "left" },
];
test.each(steps)("$type observes the same execution budget within its rows/fields", step => {
  const input: DataFrame = { fields: [...fields, { ...fields[0]!, name: "item1" }], records: frame(20).records.map(record => ({ ...record, values: { ...record.values, item1: 2, items: [1, 2, 3] } })) };
  const context = { ...controls(8), rightFrames: new Map([["right", input]]) };
  const result = executeTransform(input, { steps: [step] }, context);
  expect(result.data).toBe(input); expect(result.meta.stepsExecuted).toBe(0); expect(result.meta.warnings.join(" ")).toMatch(/work limit/i);
});
