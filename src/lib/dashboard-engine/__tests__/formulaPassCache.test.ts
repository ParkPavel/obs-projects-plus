/**
 * i3-final: a column aggregate is computed once per pass, not once per record.
 *
 * `share = amount / SUM(@amount)` on a 2000-row table used to run the SUM —
 * a walk over all 2000 rows — for every row: four million reads. The spies
 * count how often the aggregate's own body runs while a whole formula column
 * is filled in.
 *
 * With `jest.mock` this file is compiled by Babel, which cannot name an
 * IMPORTED type in an annotation; the local `Frame` type stands in for it.
 */

jest.mock("src/lib/engine/aggregate", () => {
  const actual = jest.requireActual("src/lib/engine/aggregate");
  return { ...actual, aggregate: jest.fn(actual.aggregate) };
});
jest.mock("src/lib/formula/criteria", () => {
  const actual = jest.requireActual("src/lib/formula/criteria");
  return { ...actual, compileCriterion: jest.fn(actual.compileCriterion) };
});

import { aggregate } from "src/lib/engine/aggregate";
import { compileCriterion } from "src/lib/formula/criteria";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { applyFormulaFields } from "src/lib/dashboard-engine/applyFormulaFields";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import { createFormulaPass, evaluateFormulaValue } from "src/lib/formula/extendedEvaluator";

const ROWS = 2000;
const TOTAL = (ROWS * (ROWS + 1)) / 2;
const TEAM_A = (ROWS * ROWS) / 4; // 1 + 3 + … + 1999

type Row = { id: string; values: Record<string, unknown> };
type Frame = { fields: unknown[]; records: Row[] };

function field(name: string, type: unknown) {
  return { name, type, repeated: false, identifier: false, derived: false };
}

function table(): Frame {
  return {
    fields: [field("amount", DataFieldType.Number), field("team", DataFieldType.String)],
    records: Array.from({ length: ROWS }, (_, i) => ({
      id: `r${i}.md`,
      values: { amount: i + 1, team: i % 2 === 0 ? "a" : "b" },
    })),
  };
}

/** Fills formula columns into a fresh 2000-row table. */
function apply(...columns: Array<[string, string]>): Frame {
  const defs = columns.map(([name, expression]) => ({ name, expression }));
  return applyFormulaFields(table() as never, defs) as unknown as Frame;
}

function cell(frame: Frame, row: number, name = "f"): unknown {
  return frame.records[row]?.values[name];
}

beforeEach(() => {
  (aggregate as unknown as jest.Mock).mockClear();
  (compileCriterion as unknown as jest.Mock).mockClear();
});

describe("formula pass cache", () => {
  it("SUM(@col) inside a per-record formula runs once for the whole column", () => {
    const out = apply(["f", "amount / SUM(@amount)"]);
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(cell(out, 0)).toBeCloseTo(1 / TOTAL);
    expect(cell(out, ROWS - 1)).toBeCloseTo(ROWS / TOTAL);
  });

  it("two aggregates in one formula: once each", () => {
    apply(["f", "(amount - AVG(@amount)) / MAX(@amount)"]);
    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it("SUMIF with a fixed criterion: compiled once per pass", () => {
    const out = apply(["f", 'SUMIF(@team, "a", @amount)']);
    expect(compileCriterion).toHaveBeenCalledTimes(1);
    expect(cell(out, 0)).toBe(TEAM_A);
  });

  it("a per-record criterion is not cached — each record gets its own group", () => {
    const out = apply(["f", "SUMIF(@team, team, @amount)"]);
    expect(compileCriterion).toHaveBeenCalledTimes(ROWS);
    expect(cell(out, 0)).toBe(TEAM_A);
    expect(cell(out, 1)).toBe(TOTAL - TEAM_A);
  });

  it("each formula column gets its own pass: a later column sees the earlier one", () => {
    const out = apply(["double", "amount * 2"], ["share", "double / SUM(@double)"]);
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(cell(out, 0, "share")).toBeCloseTo(1 / TOTAL);
  });

  it("a pipeline compute step shares one pass across its records", () => {
    const result = executeTransform(table() as never, {
      steps: [{ type: "compute", columns: [{ name: "share", expression: "amount / SUM(@amount)" }] }],
    });
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(cell(result.data as unknown as Frame, 0, "share")).toBeCloseTo(1 / TOTAL);
  });

  it("a pass made for another frame is not used — no stale answer", () => {
    const a = table();
    const b = table();
    b.records.forEach((r) => { r.values["amount"] = 1; });
    const pass = createFormulaPass(a as never);
    expect(evaluateFormulaValue("SUM(@amount)", a.records[0] as never, a as never, pass)).toBe(TOTAL);
    expect(evaluateFormulaValue("SUM(@amount)", b.records[0] as never, b as never, pass)).toBe(ROWS);
  });

  it("record-bound calls are never cached (scope variables, ID)", () => {
    const out = apply(["f", 'LET("x", amount, x + SUM(@amount) * 0)']);
    expect(cell(out, 0)).toBe(1);
    expect(cell(out, 9)).toBe(10);
    expect(cell(apply(["f", "ID()"]), 3)).toBe("r3.md");
  });

  it("a column value is a copy: records never share one array", () => {
    const out = apply(["f", "@amount"]);
    expect(cell(out, 0)).not.toBe(cell(out, 1));
    expect(cell(out, 0)).toHaveLength(ROWS);
  });

  // Measured 1.2–1.5 s before scans were remembered per group, ~40 ms after.
  it("2000 rows of SUMIF by group stay well under half a second", () => {
    const started = Date.now();
    apply(["f", "SUMIF(@team, team, @amount) / SUM(@amount)"]);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
