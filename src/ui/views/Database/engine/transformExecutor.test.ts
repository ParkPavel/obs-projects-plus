// src/ui/views/Database/engine/transformExecutor.test.ts

import { executeTransform, evaluateExpression } from "./transformExecutor";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { TransformPipeline } from "./transformTypes";

// ── Helpers ──────────────────────────────────────────────────

function makeWideFrame(): DataFrame {
  return {
    fields: [
      { name: "date", type: DataFieldType.Date, repeated: false, identifier: true, derived: false },
      { name: "type", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "exercise1", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "weight1", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "sets1", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "reps1", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "exercise2", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "weight2", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "sets2", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "reps2", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: [
      {
        id: "2026-04-01.md",
        values: {
          date: "2026-04-01",
          type: "strength",
          exercise1: "Bench Press",
          weight1: 80,
          sets1: 4,
          reps1: 10,
          exercise2: "Squat",
          weight2: 120,
          sets2: 5,
          reps2: 8,
        },
      },
      {
        id: "2026-04-03.md",
        values: {
          date: "2026-04-03",
          type: "strength",
          exercise1: "Bench Press",
          weight1: 82.5,
          sets1: 4,
          reps1: 10,
          exercise2: "",
          weight2: undefined,
          sets2: undefined,
          reps2: undefined,
        },
      },
    ],
  };
}

// ── UNPIVOT Tests ────────────────────────────────────────────

describe("executeTransform — UNPIVOT", () => {
  const pipeline: TransformPipeline = {
    steps: [
      {
        type: "unpivot",
        fieldGroups: [
          { pattern: "exercise(\\d+)", outputName: "exercise" },
          { pattern: "weight(\\d+)", outputName: "weight" },
          { pattern: "sets(\\d+)", outputName: "sets" },
          { pattern: "reps(\\d+)", outputName: "reps" },
        ],
        keepFields: ["date", "type"],
      },
    ],
  };

  test("unpivots wide frame into long format", () => {
    const result = executeTransform(makeWideFrame(), pipeline);

    // Record 1 has both exercises → 2 rows
    // Record 2 has only exercise1 (exercise2 is empty) → 1 row
    expect(result.data.records.length).toBe(3);
    expect(result.meta.inputRowCount).toBe(2);
    expect(result.meta.outputRowCount).toBe(3);
  });

  test("keep fields are preserved", () => {
    const result = executeTransform(makeWideFrame(), pipeline);

    for (const record of result.data.records) {
      expect(record.values["date"]).toBeDefined();
      expect(record.values["type"]).toBe("strength");
    }
  });

  test("output fields are created from group names", () => {
    const result = executeTransform(makeWideFrame(), pipeline);
    const fieldNames = result.data.fields.map((f) => f.name);

    expect(fieldNames).toContain("exercise");
    expect(fieldNames).toContain("weight");
    expect(fieldNames).toContain("sets");
    expect(fieldNames).toContain("reps");
    expect(fieldNames).toContain("_source_record");
    expect(fieldNames).toContain("_group_index");
  });

  test("record IDs include source + index", () => {
    const result = executeTransform(makeWideFrame(), pipeline);
    expect(result.data.records[0]?.id).toBe("2026-04-01.md__1");
    expect(result.data.records[1]?.id).toBe("2026-04-01.md__2");
    expect(result.data.records[2]?.id).toBe("2026-04-03.md__1");
  });

  test("empty groups are skipped", () => {
    const result = executeTransform(makeWideFrame(), pipeline);
    // 2026-04-03 has empty exercise2 → only 1 row for that record
    const rec2Rows = result.data.records.filter(
      (r) => r.values["_source_record"] === "2026-04-03.md"
    );
    expect(rec2Rows.length).toBe(1);
  });

  test("returns unchanged frame when no fields match", () => {
    const noMatchPipeline: TransformPipeline = {
      steps: [
        {
          type: "unpivot",
          fieldGroups: [{ pattern: "nonexistent(\\d+)", outputName: "x" }],
          keepFields: ["date"],
        },
      ],
    };
    const result = executeTransform(makeWideFrame(), noMatchPipeline);
    expect(result.data.records.length).toBe(2); // unchanged
    expect(result.meta.warnings.length).toBeGreaterThan(0);
  });

  test("derived fields are identified", () => {
    const result = executeTransform(makeWideFrame(), pipeline);
    expect(result.derivedFields.length).toBeGreaterThan(0);
    for (const f of result.derivedFields) {
      expect(f.derived).toBe(true);
    }
  });
});

// ── COMPUTE Tests ────────────────────────────────────────────

describe("executeTransform — COMPUTE", () => {
  test("computes simple multiplication", () => {
    const frame: DataFrame = {
      fields: [
        { name: "price", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "qty", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "1", values: { price: 10, qty: 5 } },
        { id: "2", values: { price: 20, qty: 3 } },
      ],
    };

    const result = executeTransform(frame, {
      steps: [
        {
          type: "compute",
          columns: [{ name: "total", expression: "price * qty" }],
        },
      ],
    });

    expect(result.data.records[0]?.values["total"]).toBe(50);
    expect(result.data.records[1]?.values["total"]).toBe(60);
  });

  test("computes addition and subtraction", () => {
    const frame: DataFrame = {
      fields: [
        { name: "a", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "b", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [{ id: "1", values: { a: 10, b: 3 } }],
    };

    const result = executeTransform(frame, {
      steps: [
        {
          type: "compute",
          columns: [
            { name: "sum", expression: "a + b" },
            { name: "diff", expression: "a - b" },
          ],
        },
      ],
    });

    expect(result.data.records[0]?.values["sum"]).toBe(13);
    expect(result.data.records[0]?.values["diff"]).toBe(7);
  });

  test("respects operator precedence (* before +)", () => {
    const frame: DataFrame = {
      fields: [
        { name: "a", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "b", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "c", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [{ id: "1", values: { a: 2, b: 3, c: 4 } }],
    };

    const result = executeTransform(frame, {
      steps: [
        {
          type: "compute",
          columns: [{ name: "result", expression: "a + b * c" }],
        },
      ],
    });

    // 2 + (3 * 4) = 14, NOT (2+3) * 4 = 20
    expect(result.data.records[0]?.values["result"]).toBe(14);
  });

  test("division by zero returns null", () => {
    const frame: DataFrame = {
      fields: [
        { name: "a", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "b", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [{ id: "1", values: { a: 10, b: 0 } }],
    };

    const result = executeTransform(frame, {
      steps: [
        {
          type: "compute",
          columns: [{ name: "ratio", expression: "a / b" }],
        },
      ],
    });

    expect(result.data.records[0]?.values["ratio"]).toBeNull();
  });

  test("adds computed field to fields array", () => {
    const frame: DataFrame = {
      fields: [
        { name: "x", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [{ id: "1", values: { x: 5 } }],
    };

    const result = executeTransform(frame, {
      steps: [
        {
          type: "compute",
          columns: [{ name: "doubled", expression: "x * 2" }],
        },
      ],
    });

    const doubledField = result.data.fields.find((f) => f.name === "doubled");
    expect(doubledField).toBeDefined();
    expect(doubledField?.derived).toBe(true);
  });
});

// ── UNPIVOT + COMPUTE Pipeline ───────────────────────────────

describe("executeTransform — UNPIVOT → COMPUTE pipeline", () => {
  test("chains unpivot then compute", () => {
    const pipeline: TransformPipeline = {
      steps: [
        {
          type: "unpivot",
          fieldGroups: [
            { pattern: "exercise(\\d+)", outputName: "exercise" },
            { pattern: "weight(\\d+)", outputName: "weight" },
            { pattern: "sets(\\d+)", outputName: "sets" },
            { pattern: "reps(\\d+)", outputName: "reps" },
          ],
          keepFields: ["date", "type"],
        },
        {
          type: "compute",
          columns: [{ name: "volume", expression: "weight * sets * reps" }],
        },
      ],
    };

    const result = executeTransform(makeWideFrame(), pipeline);

    // Check volume = weight × sets × reps for first record
    const firstRow = result.data.records[0];
    expect(firstRow?.values["volume"]).toBe(80 * 4 * 10); // 3200
  });
});

// ── evaluateExpression Unit Tests ────────────────────────────

describe("evaluateExpression", () => {
  test("simple addition", () => {
    expect(evaluateExpression("a + b", { a: 10, b: 5 })).toBe(15);
  });

  test("simple multiplication", () => {
    expect(evaluateExpression("a * b", { a: 4, b: 3 })).toBe(12);
  });

  test("mixed operators with precedence", () => {
    expect(evaluateExpression("a + b * c", { a: 1, b: 2, c: 3 })).toBe(7);
  });

  test("numeric literals", () => {
    expect(evaluateExpression("a * 2", { a: 5 })).toBe(10);
  });

  test("string number values are parsed", () => {
    expect(evaluateExpression("a + b", { a: "10", b: "5" })).toBe(15);
  });

  test("undefined field returns null", () => {
    expect(evaluateExpression("a + b", { a: 10 })).toBeNull();
  });

  test("empty expression returns null", () => {
    expect(evaluateExpression("", {})).toBeNull();
  });

  test("division by zero returns null", () => {
    expect(evaluateExpression("a / b", { a: 10, b: 0 })).toBeNull();
  });
});

// ── Step Order Validation ────────────────────────────────────

describe("executeTransform — step order validation", () => {
  test("warns on out-of-order steps", () => {
    const frame: DataFrame = {
      fields: [
        { name: "x", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [{ id: "1", values: { x: 1 } }],
    };

    const result = executeTransform(frame, {
      steps: [
        { type: "compute", columns: [{ name: "y", expression: "x * 2" }] },
        {
          type: "unpivot",
          fieldGroups: [{ pattern: "y(\\d+)", outputName: "val" }],
          keepFields: ["x"],
        },
      ],
    });

    expect(result.meta.warnings).toContainEqual(
      expect.stringContaining("Step order warning")
    );
  });

  test("no warning for correct order", () => {
    const frame: DataFrame = {
      fields: [
        { name: "a1", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "x", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [{ id: "1", values: { a1: 5, x: 1 } }],
    };

    const result = executeTransform(frame, {
      steps: [
        {
          type: "unpivot",
          fieldGroups: [{ pattern: "a(\\d+)", outputName: "a" }],
          keepFields: ["x"],
        },
        { type: "compute", columns: [{ name: "b", expression: "a * 2" }] },
      ],
    });

    const orderWarnings = result.meta.warnings.filter((w) =>
      w.includes("Step order warning")
    );
    expect(orderWarnings).toHaveLength(0);
  });
});

// ── Regex Safety ─────────────────────────────────────────────

describe("executeTransform — regex safety", () => {
  test("rejects lookbehind patterns", () => {
    const frame: DataFrame = {
      fields: [
        { name: "test1", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      ],
      records: [{ id: "1", values: { test1: "x" } }],
    };

    const result = executeTransform(frame, {
      steps: [
        {
          type: "unpivot",
          fieldGroups: [{ pattern: "pre(test\\d+)", outputName: "val" }],
          keepFields: [],
        },
      ],
    });

    // Should not crash; pattern is silently rejected, no matches
    expect(result.meta.warnings).toContainEqual(
      expect.stringContaining("no fields matched")
    );
  });
});

// ── FILTER Tests ─────────────────────────────────────────────

function makeFilterableFrame(): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
      { name: "status", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "priority", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "1", values: { name: "Task A", status: "active", priority: 5 } },
      { id: "2", values: { name: "Task B", status: "done", priority: 3 } },
      { id: "3", values: { name: "Task C", status: "active", priority: 8 } },
      { id: "4", values: { name: "Task D", status: "pending", priority: 1 } },
    ],
  };
}

describe("executeTransform — FILTER", () => {
  test("filters records by string equality", () => {
    const frame = makeFilterableFrame();
    const result = executeTransform(frame, {
      steps: [
        {
          type: "filter",
          conditions: {
            conjunction: "and",
            conditions: [
              { field: "status", operator: "is", value: "active", enabled: true },
            ],
          },
        },
      ],
    });

    expect(result.data.records).toHaveLength(2);
    expect(result.data.records.map((r) => r.id)).toEqual(["1", "3"]);
  });

  test("empty filter returns all records with warning", () => {
    const frame = makeFilterableFrame();
    const result = executeTransform(frame, {
      steps: [
        { type: "filter", conditions: { conjunction: "and", conditions: [] } },
      ],
    });

    expect(result.data.records).toHaveLength(4);
    expect(result.meta.warnings).toContainEqual(
      expect.stringContaining("empty conditions")
    );
  });

  test("filters by number comparison", () => {
    const frame = makeFilterableFrame();
    const result = executeTransform(frame, {
      steps: [
        {
          type: "filter",
          conditions: {
            conjunction: "and",
            conditions: [
              { field: "priority", operator: "gt", value: "4", enabled: true },
            ],
          },
        },
      ],
    });

    expect(result.data.records).toHaveLength(2);
    expect(result.data.records.map((r) => r.id)).toEqual(["1", "3"]);
  });
});

// ── GROUP BY Tests ───────────────────────────────────────────

function makeGroupableFrame(): DataFrame {
  return {
    fields: [
      { name: "category", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "label", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "1", values: { category: "A", amount: 10, label: "first" } },
      { id: "2", values: { category: "B", amount: 20, label: "second" } },
      { id: "3", values: { category: "A", amount: 30, label: "third" } },
      { id: "4", values: { category: "B", amount: 40, label: "fourth" } },
      { id: "5", values: { category: "A", amount: 50, label: "fifth" } },
    ],
  };
}

describe("executeTransform — GROUP BY", () => {
  test("groups records by field", () => {
    const frame = makeGroupableFrame();
    const result = executeTransform(frame, {
      steps: [{ type: "group-by", fields: ["category"] }],
    });

    expect(result.data.records).toHaveLength(2);

    const groupA = result.data.records.find(
      (r) => r.values["category"] === "A"
    );
    const groupB = result.data.records.find(
      (r) => r.values["category"] === "B"
    );

    expect(groupA).toBeDefined();
    expect(groupB).toBeDefined();
    expect(groupA!.values["_group_size"]).toBe(3);
    expect(groupB!.values["_group_size"]).toBe(2);
  });

  test("carries non-group fields as arrays", () => {
    const frame = makeGroupableFrame();
    const result = executeTransform(frame, {
      steps: [{ type: "group-by", fields: ["category"] }],
    });

    const groupA = result.data.records.find(
      (r) => r.values["category"] === "A"
    );
    expect(groupA).toBeDefined();
    const amounts = groupA!.values["amount"];
    expect(Array.isArray(amounts)).toBe(true);
    expect(amounts).toEqual([10, 30, 50]);
  });

  test("empty fields returns warning", () => {
    const frame = makeGroupableFrame();
    const result = executeTransform(frame, {
      steps: [{ type: "group-by", fields: [] }],
    });

    expect(result.data.records).toHaveLength(5);
    expect(result.meta.warnings).toContainEqual(
      expect.stringContaining("no fields specified")
    );
  });

  test("date grouping by month", () => {
    const frame: DataFrame = {
      fields: [
        { name: "date", type: DataFieldType.Date, repeated: false, identifier: true, derived: false },
        { name: "value", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "1", values: { date: "2024-01-15", value: 10 } },
        { id: "2", values: { date: "2024-01-20", value: 20 } },
        { id: "3", values: { date: "2024-02-10", value: 30 } },
      ],
    };

    const result = executeTransform(frame, {
      steps: [
        {
          type: "group-by",
          fields: ["date"],
          dateGrouping: { field: "date", granularity: "month" },
        },
      ],
    });

    expect(result.data.records).toHaveLength(2);
    const jan = result.data.records.find(
      (r) => r.values["date_month"] === "2024-01"
    );
    expect(jan).toBeDefined();
    expect(jan!.values["_group_size"]).toBe(2);
  });
});

// ── AGGREGATE Tests ──────────────────────────────────────────

describe("executeTransform — AGGREGATE", () => {
  test("SUM on grouped array", () => {
    const frame = makeGroupableFrame();
    const result = executeTransform(frame, {
      steps: [
        { type: "group-by", fields: ["category"] },
        {
          type: "aggregate",
          columns: [
            { sourceField: "amount", outputName: "total", function: "SUM" },
          ],
        },
      ],
    });

    const groupA = result.data.records.find(
      (r) => r.values["category"] === "A"
    );
    expect(groupA!.values["total"]).toBe(90);
  });

  test("AVG on grouped array", () => {
    const frame = makeGroupableFrame();
    const result = executeTransform(frame, {
      steps: [
        { type: "group-by", fields: ["category"] },
        {
          type: "aggregate",
          columns: [
            { sourceField: "amount", outputName: "avg_amount", function: "AVG" },
          ],
        },
      ],
    });

    const groupA = result.data.records.find(
      (r) => r.values["category"] === "A"
    );
    expect(groupA!.values["avg_amount"]).toBe(30);
  });

  test("MEDIAN on grouped array", () => {
    const frame = makeGroupableFrame();
    const result = executeTransform(frame, {
      steps: [
        { type: "group-by", fields: ["category"] },
        {
          type: "aggregate",
          columns: [
            { sourceField: "amount", outputName: "med", function: "MEDIAN" },
          ],
        },
      ],
    });

    const groupA = result.data.records.find(
      (r) => r.values["category"] === "A"
    );
    expect(groupA!.values["med"]).toBe(30); // [10, 30, 50] → median = 30
  });

  test("COUNT_DISTINCT on grouped array", () => {
    const frame: DataFrame = {
      fields: [
        { name: "team", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
        { name: "role", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "1", values: { team: "A", role: "dev" } },
        { id: "2", values: { team: "A", role: "dev" } },
        { id: "3", values: { team: "A", role: "qa" } },
      ],
    };

    const result = executeTransform(frame, {
      steps: [
        { type: "group-by", fields: ["team"] },
        {
          type: "aggregate",
          columns: [
            { sourceField: "role", outputName: "unique_roles", function: "COUNT_DISTINCT" },
          ],
        },
      ],
    });

    expect(result.data.records[0]!.values["unique_roles"]).toBe(2);
  });

  test("MIN, MAX, RANGE on grouped array", () => {
    const frame = makeGroupableFrame();
    const result = executeTransform(frame, {
      steps: [
        { type: "group-by", fields: ["category"] },
        {
          type: "aggregate",
          columns: [
            { sourceField: "amount", outputName: "min_a", function: "MIN" },
            { sourceField: "amount", outputName: "max_a", function: "MAX" },
            { sourceField: "amount", outputName: "range_a", function: "RANGE" },
          ],
        },
      ],
    });

    const groupA = result.data.records.find((r) => r.values["category"] === "A");
    expect(groupA!.values["min_a"]).toBe(10);
    expect(groupA!.values["max_a"]).toBe(50);
    expect(groupA!.values["range_a"]).toBe(40);
  });

  test("empty columns returns warning", () => {
    const frame = makeGroupableFrame();
    const result = executeTransform(frame, {
      steps: [{ type: "aggregate", columns: [] }],
    });

    expect(result.meta.warnings).toContainEqual(
      expect.stringContaining("no columns specified")
    );
  });
});

// ── UNNEST ───────────────────────────────────────────────────

describe("transformExecutor — unnest", () => {
  function makeNestedFrame(): DataFrame {
    return {
      fields: [
        { name: "date", type: DataFieldType.Date, repeated: false, identifier: true, derived: false },
        { name: "type", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
        { name: "exercises", type: DataFieldType.Unknown, repeated: false, identifier: false, derived: false },
      ],
      records: [
        {
          id: "2026-04-01.md",
          values: {
            date: "2026-04-01",
            type: "strength",
            exercises: [
              { name: "Bench Press", sets: 3, reps: 10, weight: 80 },
              { name: "Squat", sets: 4, reps: 8, weight: 120 },
            ] as any,
          },
        },
        {
          id: "2026-04-03.md",
          values: {
            date: "2026-04-03",
            type: "cardio",
            exercises: [
              { name: "Running", duration: 30 },
            ] as any,
          },
        },
      ],
    };
  }

  test("unnest array of objects → one row per element", () => {
    const frame = makeNestedFrame();
    const result = executeTransform(frame, {
      steps: [{ type: "unnest", field: "exercises" }],
    });

    expect(result.data.records).toHaveLength(3);
    // First record: Bench Press
    expect(result.data.records[0]!.values["name"]).toBe("Bench Press");
    expect(result.data.records[0]!.values["sets"]).toBe(3);
    expect(result.data.records[0]!.values["weight"]).toBe(80);
    expect(result.data.records[0]!.values["date"]).toBe("2026-04-01");
    expect(result.data.records[0]!.values["_index"]).toBe(0);
    // Second record: Squat
    expect(result.data.records[1]!.values["name"]).toBe("Squat");
    expect(result.data.records[1]!.values["reps"]).toBe(8);
    expect(result.data.records[1]!.values["_index"]).toBe(1);
    // Third record: Running
    expect(result.data.records[2]!.values["name"]).toBe("Running");
    expect(result.data.records[2]!.values["duration"]).toBe(30);
    expect(result.data.records[2]!.values["type"]).toBe("cardio");
  });

  test("unnest removes source field by default", () => {
    const frame = makeNestedFrame();
    const result = executeTransform(frame, {
      steps: [{ type: "unnest", field: "exercises" }],
    });

    const fieldNames = result.data.fields.map((f) => f.name);
    expect(fieldNames).not.toContain("exercises");
    expect(fieldNames).toContain("name");
    expect(fieldNames).toContain("_index");
  });

  test("keepOriginal preserves source field", () => {
    const frame = makeNestedFrame();
    const result = executeTransform(frame, {
      steps: [{ type: "unnest", field: "exercises", keepOriginal: true }],
    });

    const fieldNames = result.data.fields.map((f) => f.name);
    expect(fieldNames).toContain("exercises");
  });

  test("prefix prepends to extracted field names", () => {
    const frame = makeNestedFrame();
    const result = executeTransform(frame, {
      steps: [{ type: "unnest", field: "exercises", prefix: "ex_" }],
    });

    const fieldNames = result.data.fields.map((f) => f.name);
    expect(fieldNames).toContain("ex_name");
    expect(fieldNames).toContain("ex_sets");
    expect(fieldNames).toContain("ex__index");
  });

  test("fields filter picks only specified keys", () => {
    const frame = makeNestedFrame();
    const result = executeTransform(frame, {
      steps: [{ type: "unnest", field: "exercises", fields: ["name", "weight"] }],
    });

    const fieldNames = result.data.fields.map((f) => f.name);
    expect(fieldNames).toContain("name");
    expect(fieldNames).toContain("weight");
    expect(fieldNames).not.toContain("sets");
    expect(fieldNames).not.toContain("reps");
    expect(fieldNames).not.toContain("duration");
  });

  test("empty array field → one row with null nested fields", () => {
    const frame: DataFrame = {
      fields: [
        { name: "id", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
        { name: "items", type: DataFieldType.Unknown, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "a", values: { id: "a", items: [] } },
        { id: "b", values: { id: "b", items: [{ x: 1 }] as any } },
      ],
    };

    const result = executeTransform(frame, {
      steps: [{ type: "unnest", field: "items" }],
    });

    // "a" has empty array → 1 row with null; "b" has 1 item → 1 row
    expect(result.data.records).toHaveLength(2);
    expect(result.data.records[0]!.values["x"]).toBeUndefined();
    expect(result.data.records[1]!.values["x"]).toBe(1);
  });

  test("flat array → _value column", () => {
    const frame: DataFrame = {
      fields: [
        { name: "id", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
        { name: "tags", type: DataFieldType.List, repeated: true, identifier: false, derived: false },
      ],
      records: [
        { id: "a", values: { id: "a", tags: ["alpha", "beta", "gamma"] } },
      ],
    };

    const result = executeTransform(frame, {
      steps: [{ type: "unnest", field: "tags" }],
    });

    expect(result.data.records).toHaveLength(3);
    expect(result.data.records[0]!.values["_value"]).toBe("alpha");
    expect(result.data.records[1]!.values["_value"]).toBe("beta");
    expect(result.data.records[2]!.values["_value"]).toBe("gamma");
  });

  test("non-array field → pass through unchanged", () => {
    const frame: DataFrame = {
      fields: [
        { name: "id", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
        { name: "score", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "a", values: { id: "a", score: 42 } },
      ],
    };

    const result = executeTransform(frame, {
      steps: [{ type: "unnest", field: "score" }],
    });

    // Non-array → 1 row with null nested fields (no expansion)
    expect(result.data.records).toHaveLength(1);
    expect(result.data.records[0]!.values["id"]).toBe("a");
  });

  test("unnest + compute pipeline", () => {
    const frame = makeNestedFrame();
    const result = executeTransform(frame, {
      steps: [
        { type: "unnest", field: "exercises" },
        {
          type: "compute",
          columns: [
            { name: "volume", expression: "sets * reps * weight" },
          ],
        },
      ],
    });

    expect(result.data.records).toHaveLength(3);
    // Bench Press: 3 * 10 * 80 = 2400
    expect(result.data.records[0]!.values["volume"]).toBe(2400);
    // Squat: 4 * 8 * 120 = 3840
    expect(result.data.records[1]!.values["volume"]).toBe(3840);
  });
});
