// A small test budget proves nested work accounting without expensive loops.
jest.mock("../limits", () => ({ ...jest.requireActual("../limits"), MAX_FORMULA_EVALUATION_STEPS: 50 }));

import { evaluateExpression, evaluateFormulaWithError, getFormulaDefinition, parseFormula } from "src/lib/formula";
import { cumulativePeriodWork } from "../limits";

const record = { id: "financial.md", values: { huge: Infinity } };
const context = { record, semantics: "unified-v1" as const };

/** Stop the OLD unsafe implementation after a little work, never a billion iterations. */
function boundedProbe(source: string, legacy = false) {
  const original = Math.pow;
  let calls = 0;
  const spy = jest.spyOn(Math, "pow").mockImplementation((base, exponent) => {
    if (++calls > 1_000) throw new Error("Test harness stopped the financial loop");
    return original(base, exponent);
  });
  try { return { result: legacy ? evaluateFormulaWithError(source, record) : evaluateExpression(source, context), calls: () => calls }; }
  finally { spy.mockRestore(); }
}

test.each(["CUMPRINC", "CUMIPMT"])("%s refuses enormous actual work before entering its loop", name => {
  const probe = boundedProbe(`${name}(0.01, 1000000000, 1000, 1, 1000000000, 0)`);
  expect(probe.result.value).toBeNull();
  expect(probe.result.error).toContain("limit");
  expect(probe.calls()).toBe(0);
});

test("a floating-point period counter that cannot advance is rejected", () => {
  const probe = boundedProbe("CUMIPMT(0.01, 18014398509481984, 1000, 18014398509481984, 18014398509481984, 0)");
  expect(probe.result.value).toBeNull();
  expect(probe.result.error).toContain("limit");
  expect(probe.calls()).toBe(0);
});

test.each([false, true])("non-finite financial inputs never enter a loop (legacy: %s)", legacy => {
  const probe = boundedProbe("CUMIPMT(0.01, huge, 1000, 1, huge, 0)", legacy);
  expect(probe.result.value).toBeNull();
  expect(probe.calls()).toBe(0);
});

test("the loop-work guard independently rejects infinite endpoints", () => {
  expect(() => cumulativePeriodWork(1, Infinity)).toThrow("limit");
  expect(() => cumulativePeriodWork(Infinity, Infinity)).toThrow("limit");
  expect(cumulativePeriodWork(NaN, 12)).toBe(0);
});

test.each(["CUMPRINC", "CUMIPMT"])("legacy %s also refuses excessive work", name => {
  const probe = boundedProbe(`${name}(0.01, 1000000000, 1000, 1, 1000000000, 0)`, true);
  expect(probe.result.error).toContain("limit");
  expect(probe.calls()).toBe(0);
});

test("nested legacy calls share the financial work budget", () => {
  expect(evaluateFormulaWithError('MAP([1,2], "item", CUMIPMT(0.01, 100, 1000, 1, 30, 0))', record).error).toContain("limit");
});

test("several cumulative calls share the same work budget", () => {
  const source = 'MAP([1,2], "item", CUMIPMT(0.01, 100, 1000, 1, 30, 0))';
  expect(evaluateExpression(source, context).error).toContain("limit");
});

test("a common catalog invocation without a caller budget still refuses excessive work", () => {
  const ast = parseFormula("CUMIPMT(0.01, 1000000000, 1000, 1, 1000000000, 0)");
  if (ast.type !== "function") throw new Error("Expected a cumulative call");
  const pow = jest.spyOn(Math, "pow").mockImplementation(() => { throw new Error("Test harness stopped the financial loop"); });
  try {
    expect(() => getFormulaDefinition("CUMIPMT", "unified-v1")!.invoke(
      ast.args, node => node.type === "literal" ? node.value : null, () => null,
      { semantics: "unified-v1", referenceTime: 0 }
    )).toThrow("limit");
    expect(pow).not.toHaveBeenCalled();
  } finally { pow.mockRestore(); }
});

test.each(["CUMPRINC", "CUMIPMT"])("ordinary %s results remain identical", name => {
  const source = `${name}(0.01, 12, 1000, 1, 12, 0)`;
  const before = evaluateFormulaWithError(source, record);
  expect(typeof before.value).toBe("number");
  expect(evaluateExpression(source, context)).toEqual(before);
});
