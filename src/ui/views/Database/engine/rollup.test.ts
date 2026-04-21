import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { computeRollup, computeRollupColumn } from "./rollup";
import type { RollupConfig } from "./rollup";

// ── Helpers ─────────────────────────────────────────────

function makeDF(records: DataRecord[]): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "tasks", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "hours", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "done", type: DataFieldType.Boolean, repeated: false, identifier: false, derived: false },
    ],
    records,
  };
}

function rec(
  id: string,
  name: string,
  tasks: string,
  hours: number,
  done: boolean
): DataRecord {
  return { id, values: { name, tasks, hours, done } };
}

const df = makeDF([
  rec("project.md", "Project", "[[Task A]] [[Task B]] [[Task C]]", 0, false),
  rec("task-a.md", "Task A", "", 10, true),
  rec("task-b.md", "Task B", "", 25, false),
  rec("task-c.md", "Task C", "", 15, true),
]);

const baseConfig: RollupConfig = {
  relationField: "tasks",
  targetField: "hours",
  function: "sum",
};

// ── computeRollup ───────────────────────────────────────

describe("computeRollup", () => {
  it("should sum numeric values from relation targets", () => {
    const result = computeRollup(df.records[0]!, baseConfig, df);
    expect(result.value).toBe(50); // 10 + 25 + 15
    expect(result.formattedValue).toBe("50");
  });

  it("should compute count", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, function: "count" },
      df
    );
    expect(result.value).toBe(3);
  });

  it("should compute avg", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, function: "avg" },
      df
    );
    // (10 + 25 + 15) / 3 ≈ 16.67
    expect(result.value).toBeCloseTo(16.67, 1);
  });

  it("should compute min", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, function: "min" },
      df
    );
    expect(result.value).toBe(10);
  });

  it("should compute max", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, function: "max" },
      df
    );
    expect(result.value).toBe(25);
  });

  it("should compute median", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, function: "median" },
      df
    );
    expect(result.value).toBe(15); // sorted: 10, 15, 25 → median = 15
  });

  it("should compute range", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, function: "range" },
      df
    );
    expect(result.value).toBe(15); // 25 - 10
  });

  it("should compute percent_true on boolean field", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, targetField: "done", function: "percent_true" },
      df
    );
    // 2 of 3 are true → 67%
    expect(result.formattedValue).toBe("67%");
  });

  it("should compute concat", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, targetField: "name", function: "concat" },
      df
    );
    expect(result.formattedValue).toBe("Task A, Task B, Task C");
  });

  it("should compute concat_unique", () => {
    const dfDup = makeDF([
      rec("p.md", "P", "[[X]] [[Y]] [[X2]]", 0, false),
      rec("x.md", "X", "", 10, false),
      rec("y.md", "Y", "", 10, false),
      rec("x2.md", "X2", "", 10, false),
    ]);
    const result = computeRollup(
      dfDup.records[0]!,
      { ...baseConfig, targetField: "hours", function: "concat_unique" },
      dfDup
    );
    expect(result.formattedValue).toBe("10");
  });

  it("should return 0 for records with no relations", () => {
    const result = computeRollup(df.records[1]!, baseConfig, df);
    expect(result.value).toBe(0);
  });

  it("should count_unique", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, function: "count_unique" },
      df
    );
    expect(result.value).toBe(3);
  });

  it("should use custom separator for concat", () => {
    const result = computeRollup(
      df.records[0]!,
      { ...baseConfig, targetField: "name", function: "concat", separator: " | " },
      df
    );
    expect(result.formattedValue).toBe("Task A | Task B | Task C");
  });
});

// ── computeRollupColumn ─────────────────────────────────

describe("computeRollupColumn", () => {
  it("should compute rollup for all records", () => {
    const map = computeRollupColumn(df, baseConfig);
    expect(map.size).toBe(df.records.length);
    expect(map.get("project.md")?.value).toBe(50);
    expect(map.get("task-a.md")?.value).toBe(0);
  });

  it("should return map with formattedValue", () => {
    const map = computeRollupColumn(df, {
      ...baseConfig,
      function: "avg",
    });
    const projectResult = map.get("project.md");
    expect(projectResult).toBeDefined();
    expect(typeof projectResult!.formattedValue).toBe("string");
  });
});
