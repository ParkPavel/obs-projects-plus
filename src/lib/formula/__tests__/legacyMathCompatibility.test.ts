// Current expected values captured from unified-v1 at checkpoint 82d, before runtime removal.
// Captured through the actual old public API before the math/workload changes.
jest.mock("src/lib/stores/i18n", () => ({
  i18n: { subscribe(run: (value: { t: (key: string) => string }) => void) {
    run({ t: (key: string) => key });
    return () => {};
  } },
}));
import baseline from "./fixtures/unified-math-82d.json";
import { evaluateFormulaWithError } from "../extendedEvaluator";

function encode(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "number" && Object.is(item, -0) ? { negativeZero: true }
      : typeof item === "number" && !Number.isFinite(item) ? { nonFinite: String(item) } : item
  ));
}

test.each(baseline.rows)("saved mathematical formula matches frozen current-rule mathematics: $expression", expected => {
  const actual = encode(evaluateFormulaWithError(expected.expression, { id: "synthetic.md", values: {} }));
  const value = expected.result.value;
  if (typeof value === "number" && !Number.isInteger(value)) {
    // Native math libraries/V8 versions can differ by a few rounding bits.
    // Keep result shape/types/errors exact; permit only machine-scale drift.
    expect(actual).toEqual({ ...expected.result, value: expect.any(Number) });
    const number = (actual as { value: number }).value;
    expect(Number.isFinite(number)).toBe(true);
    expect(Math.abs(number - value)).toBeLessThanOrEqual(32 * Number.EPSILON * Math.max(1, Math.abs(value)));
  } else {
    expect(actual).toEqual(expected.result);
  }
});
