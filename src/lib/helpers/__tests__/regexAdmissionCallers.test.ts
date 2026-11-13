import { isSafePattern } from "redos-detector";
import { evaluateExpression } from "src/lib/formula/extendedEvaluator";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import { matchesCondition } from "src/lib/engine/filterEvaluator";
import { humanFormulaError } from "src/lib/formula/formulaErrors";
import { DataFieldType } from "src/lib/dataframe/dataframe";

jest.mock("redos-detector", () => ({ isSafePattern: jest.fn() }));
const check = isSafePattern as jest.Mock;
beforeEach(() => check.mockReturnValue({ safe: false, error: "hitMaxSteps", score: { infinite: false, value: 1 } }));

const record = { id: "a.md", values: { title: "foo", item1: "value" } };
const frame = {
  fields: [{ name: "item1", type: DataFieldType.String, repeated: false, identifier: false, derived: false }],
  records: [record],
};

test.each(["unified-v1"] as const)("%s rejects inconclusive regex matching and replacement", semantics => {
  for (const fn of ["REGEX_MATCH", "REGEX_REPLACE"]) {
    const args = fn === "REGEX_MATCH" ? '"foo", "[a-z]+"' : '"foo", "[a-z]+", "x"';
    const result = evaluateExpression(`${fn}(${args})`, { semantics, record });
    expect(result.value).toBeNull();
    expect(result.error).toBe(humanFormulaError("Regex pattern unverified"));
  }
});

test("a saved visual filter fails closed on inconclusive complexity", () => {
  expect(matchesCondition({ field: "title", operator: "regex", value: "[a-z]+", enabled: true }, record)).toBe(false);
});

test("UNPIVOT reports an inconclusive pattern instead of returning silently matched rows", () => {
  const result = executeTransform(frame, { steps: [{ type: "unpivot", fieldGroups: [{ pattern: "item(\\d+)", outputName: "value" }], keepFields: [] }] });
  expect(result.data).toBe(frame);
  expect(result.meta.warnings).toContainEqual(expect.stringMatching(/skipped regex pattern.*unverified/));
});
