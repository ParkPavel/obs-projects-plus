// Captured from actual public APIs at a56ed9bf before their replacement.
// Keep the same clock and text boundary as the independent baseline runner.
jest.mock("src/lib/stores/i18n", () => ({
  i18n: { subscribe(run: (value: { t: (key: string) => string }) => void) {
    run({ t: (key: string) => key });
    return () => {};
  } },
}));

import baseline from "./fixtures/legacy-formulas-a56.json";
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { parseFormula, evaluateFormula, validateFormula } from "src/lib/helpers/formulaParser";
import { createFormulaPass, evaluateFormulaWithError, validateFormulaExpression } from "../extendedEvaluator";

function encode(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "number" && !Number.isFinite(item) ? { nonFinite: String(item) }
      : item === undefined ? { absent: true } : item
  ));
}

function capture(fn: () => unknown): { result: unknown } | { thrown: string } {
  try { return { result: encode(fn()) }; }
  catch (error) { return { thrown: (error as Error).message }; }
}

const records: DataRecord[] = baseline.records;
const fields = Object.keys(records[0]!.values);
const frame: DataFrame = {
  fields: fields.map(name => ({ name, type: DataFieldType.String, repeated: false, identifier: false, derived: false })),
  records,
};

beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(baseline.reference)); });
afterAll(() => { jest.useRealTimers(); });

test.each(baseline.rows)("saved public formula keeps its previous results: $expression", expected => {
  const expression = expected.expression;
  expect({
    expression,
    legacyValidation: validateFormula(expression, fields),
    computedValidation: validateFormulaExpression(expression, fields),
    records: records.map(record => ({
      id: record.id,
      legacy: capture(() => evaluateFormula(parseFormula(expression), record, new Date(baseline.reference))),
      computed: capture(() => evaluateFormulaWithError(expression, record, frame, createFormulaPass(frame))),
    })),
  }).toEqual(expected);
});
