// src/ui/views/Database/engine/transformPivot.test.ts

import { executeTransform } from "./transformExecutor";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { TransformPipeline } from "./transformTypes";

// ── Helpers ──────────────────────────────────────────────────

function makeSalesFrame(): DataFrame {
  return {
    fields: [
      { name: "region", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "product", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "revenue", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "1", values: { region: "North", product: "Widget", revenue: 100 } },
      { id: "2", values: { region: "North", product: "Gadget", revenue: 200 } },
      { id: "3", values: { region: "South", product: "Widget", revenue: 150 } },
      { id: "4", values: { region: "South", product: "Gadget", revenue: 300 } },
      { id: "5", values: { region: "North", product: "Widget", revenue: 50 } },
    ],
  };
}

function makeSingleCategoryFrame(): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
      { name: "status", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "hours", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "1", values: { name: "Alice", status: "Done", hours: 5 } },
      { id: "2", values: { name: "Bob", status: "Active", hours: 8 } },
      { id: "3", values: { name: "Alice", status: "Active", hours: 3 } },
    ],
  };
}

// ── PIVOT Tests ──────────────────────────────────────────────

describe("executeTransform — PIVOT", () => {
  const pipeline: TransformPipeline = {
    steps: [
      {
        type: "pivot",
        categoryField: "product",
        valueField: "revenue",
        aggregation: "SUM",
      },
    ],
  };

  test("pivots long data into wide format", () => {
    const result = executeTransform(makeSalesFrame(), pipeline);

    // 2 unique row-keys: "North" and "South" (by "region")
    expect(result.data.records.length).toBe(2);
  });

  test("category values become columns", () => {
    const result = executeTransform(makeSalesFrame(), pipeline);
    const fieldNames = result.data.fields.map((f) => f.name);

    expect(fieldNames).toContain("Gadget");
    expect(fieldNames).toContain("Widget");
  });

  test("row key fields are preserved", () => {
    const result = executeTransform(makeSalesFrame(), pipeline);
    const fieldNames = result.data.fields.map((f) => f.name);

    expect(fieldNames).toContain("region");
    expect(fieldNames).not.toContain("product");
    expect(fieldNames).not.toContain("revenue");
  });

  test("aggregates multi-value cells with SUM", () => {
    const result = executeTransform(makeSalesFrame(), pipeline);

    // North + Widget: 100 + 50 = 150
    const northRow = result.data.records.find((r) => r.values["region"] === "North");
    expect(northRow?.values["Widget"]).toBe(150);
    expect(northRow?.values["Gadget"]).toBe(200);
  });

  test("single value cells are not aggregated", () => {
    const result = executeTransform(makeSalesFrame(), pipeline);

    const southRow = result.data.records.find((r) => r.values["region"] === "South");
    expect(southRow?.values["Widget"]).toBe(150);
    expect(southRow?.values["Gadget"]).toBe(300);
  });

  test("pivot with AVG aggregation", () => {
    const avgPipeline: TransformPipeline = {
      steps: [
        {
          type: "pivot",
          categoryField: "product",
          valueField: "revenue",
          aggregation: "AVG",
        },
      ],
    };

    const result = executeTransform(makeSalesFrame(), avgPipeline);
    const northRow = result.data.records.find((r) => r.values["region"] === "North");

    // North + Widget: (100 + 50) / 2 = 75
    expect(northRow?.values["Widget"]).toBe(75);
  });

  test("pivot with COUNT aggregation", () => {
    const countPipeline: TransformPipeline = {
      steps: [
        {
          type: "pivot",
          categoryField: "product",
          valueField: "revenue",
          aggregation: "COUNT",
        },
      ],
    };

    const result = executeTransform(makeSalesFrame(), countPipeline);
    const northRow = result.data.records.find((r) => r.values["region"] === "North");

    // North has 2 Widget entries, 1 Gadget
    expect(northRow?.values["Widget"]).toBe(2);
    expect(northRow?.values["Gadget"]).toBe(1);
  });

  test("sorts category columns alphabetically", () => {
    const result = executeTransform(makeSalesFrame(), pipeline);
    const catFields = result.data.fields.filter(
      (f) => f.name !== "region"
    );

    expect(catFields[0]?.name).toBe("Gadget");
    expect(catFields[1]?.name).toBe("Widget");
  });

  test("handles missing values gracefully", () => {
    const frame: DataFrame = {
      fields: [
        { name: "key", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
        { name: "cat", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
        { name: "val", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "1", values: { key: "A", cat: "X", val: 10 } },
        { id: "2", values: { key: "A", cat: "Y", val: undefined } },
        { id: "3", values: { key: "B", cat: "X", val: 20 } },
      ],
    };

    const result = executeTransform(frame, {
      steps: [{ type: "pivot", categoryField: "cat", valueField: "val", aggregation: "SUM" }],
    });

    const rowA = result.data.records.find((r) => r.values["key"] === "A");
    expect(rowA?.values["X"]).toBe(10);
    // Y has undefined → null or 0
  });

  test("empty frame returns empty result", () => {
    const emptyFrame: DataFrame = {
      fields: [
        { name: "cat", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
        { name: "val", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [],
    };

    const result = executeTransform(emptyFrame, pipeline);
    expect(result.data.records.length).toBe(0);
  });

  test("pivot with multiple row-key fields", () => {
    const result = executeTransform(makeSingleCategoryFrame(), {
      steps: [{ type: "pivot", categoryField: "status", valueField: "hours", aggregation: "SUM" }],
    });

    // row-key = "name" (identifier)
    expect(result.data.records.length).toBe(2);
    const aliceRow = result.data.records.find((r) => r.values["name"] === "Alice");
    expect(aliceRow?.values["Done"]).toBe(5);
    expect(aliceRow?.values["Active"]).toBe(3);
  });
});
