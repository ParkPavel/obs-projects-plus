jest.mock("src/lib/stores/i18n", () => ({
  i18n: { subscribe(run: (value: { t: (key: string) => string }) => void) {
    run({ t: (key: string) => key }); return () => {};
  } },
}));
import baseline from "./fixtures/legacy-syntax-d3.json";
import { tokenize, parseFormula } from "../syntax";
import { evaluateFormulaWithError, validateFormulaExpression, createFormulaPass } from "../extendedEvaluator";
import { DataFieldType } from "src/lib/dataframe/dataframe";
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;
const records: DataRecord[] = baseline.records;
const fields = Object.keys(records[0]!.values);
const frame = { records, fields: fields.map(name => ({ name, type: DataFieldType.String, repeated: false, derived: false, identifier: false })) };

function encode(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "number" && Object.is(item, -0) ? { negativeZero: true }
      : typeof item === "number" && !Number.isFinite(item) ? { nonFinite: String(item) }
      : item === undefined ? { absent: true } : item
  ));
}
function capture(fn: () => unknown): unknown {
  try { return { result: encode(fn()) }; } catch (error) { return { thrown: (error as Error).message }; }
}
test.each(baseline.rows)("default syntax keeps its saved behavior: $expression", expected => {
  const expression = expected.expression;
  expect(encode({ expression, tokens: capture(() => tokenize(expression)), ast: capture(() => parseFormula(expression)),
    validation: validateFormulaExpression(expression, fields), computed: evaluateFormulaWithError(expression, records[0]!, frame, createFormulaPass(frame)) })).toEqual(expected);
});
