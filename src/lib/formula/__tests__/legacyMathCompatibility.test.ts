// Captured through the actual old public API before the math/workload changes.
jest.mock("src/lib/stores/i18n", () => ({
  i18n: { subscribe(run: (value: { t: (key: string) => string }) => void) {
    run({ t: (key: string) => key });
    return () => {};
  } },
}));
import baseline from "./fixtures/legacy-math-5885.json";
import { evaluateFormulaWithError } from "../extendedEvaluator";

function encode(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "number" && Object.is(item, -0) ? { negativeZero: true }
      : typeof item === "number" && !Number.isFinite(item) ? { nonFinite: String(item) } : item
  ));
}

test.each(baseline.rows)("saved mathematical formula retains its old result: $expression", expected => {
  expect(encode(evaluateFormulaWithError(expected.expression, { id: "synthetic.md", values: {} }))).toEqual(expected.result);
});
