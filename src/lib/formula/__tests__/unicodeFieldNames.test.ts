/**
 * i3-final — a formula reads properties named in any script: «сумма» as a
 * field and as a column reference, «客户» likewise. ASCII-only identifiers made
 * these properties unreachable from formulas.
 */
import { evaluateFormulaValue } from "../extendedEvaluator";
import { tokenize } from "src/lib/helpers/formulaParser";
import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";

const rec = (id: string, values: Record<string, unknown>) => ({ id, values }) as unknown as DataRecord;
const frame = {
  fields: [],
  records: [rec("a", { сумма: 10, клиент: "Анна", 客户: 2 }), rec("b", { сумма: 5, клиент: "Борис", 客户: 3 })],
} as unknown as DataFrame;

describe("field names beyond ASCII", () => {
  it("tokenizes a Cyrillic field and a Cyrillic @column", () => {
    const kinds = tokenize("сумма + SUM(@сумма)").map((t) => `${t.type}:${String(t.value)}`);
    expect(kinds).toContain("FIELD:сумма");
    expect(kinds).toContain("FIELD:@сумма");
  });

  it("evaluates a bare Cyrillic field on the record", () => {
    expect(evaluateFormulaValue("сумма * 2", frame.records[0]!, frame)).toBe(20);
  });

  it("aggregates a Cyrillic column and filters by a Cyrillic criterion column", () => {
    expect(evaluateFormulaValue("SUM(@сумма)", frame.records[0]!, frame)).toBe(15);
    expect(evaluateFormulaValue('SUMIF(@клиент, "Анна", @сумма)', frame.records[1]!, frame)).toBe(10);
  });

  it("reads a CJK field name", () => {
    expect(evaluateFormulaValue("客户 + 1", frame.records[1]!, frame)).toBe(4);
  });
});
