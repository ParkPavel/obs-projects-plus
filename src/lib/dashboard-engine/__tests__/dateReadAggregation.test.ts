/**
 * stab-dateread (Codex audit) — the dashboard engine reads a date's text by
 * the stored-date rule too: written order, and an impossible day is not
 * rolled over into the next month.
 */
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { computeAggregations } from "src/lib/dashboard-engine/aggregation";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";

function frameOf(dates: unknown[]): DataFrame {
  return {
    fields: [
      { name: "date", type: DataFieldType.Date, repeated: false, identifier: true, derived: false },
      { name: "value", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: dates.map((date, i) => ({ id: String(i), values: { date: date as never, value: 1 } })),
  };
}

function monthOf(date: unknown): unknown {
  const result = executeTransform(frameOf([date]), {
    steps: [{ type: "group-by", fields: ["date"], dateGrouping: { field: "date", granularity: "month" } }],
  });
  return result.data.records[0]?.values["date_month"];
}

describe("date grouping reads text in written order", () => {
  it("10.04.2026 groups into April, not October", () => {
    expect(monthOf("10.04.2026")).toBe("2026-04");
  });

  it("an impossible day is invalid, not the next month", () => {
    expect(monthOf("2024-02-30")).toBe("__invalid__");
  });
});

describe("earliest/latest read text in written order", () => {
  it("earliest of 10.04.2026 and 05.05.2026 is April 10", () => {
    const out = computeAggregations(frameOf(["10.04.2026", "05.05.2026"]), { date: "earliest" });
    expect(String(out["date"]?.value)).toContain("2026-04-0");
  });

  it("an impossible day is skipped, not counted as March 1", () => {
    const out = computeAggregations(frameOf(["2024-02-30", "2024-02-10"]), { date: "latest" });
    expect(String(out["date"]?.value)).toContain("2024-02-");
  });
});
