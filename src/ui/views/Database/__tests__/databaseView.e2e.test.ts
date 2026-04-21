// src/ui/views/Database/__tests__/databaseView.e2e.test.ts
// End-to-end integration tests for Database View data workflow.
// Tests the full chain: DataFrame → Pipeline → Aggregation → Charts → Formatting

import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataFrame, DataField, DataRecord } from "src/lib/dataframe/dataframe";
import { executeTransform } from "../engine/transformExecutor";
import { computeAggregations } from "../engine/aggregation";
import { computeChartData } from "../engine/chartDataPipeline";
import { computeRowStyles, cellStyleToCSS } from "../engine/conditionalFormat";
import {
  computeBacklinks,
  enrichWithBacklinks,
  extractWikiLinks,
  resolveRelations,
} from "../engine/relationResolver";
import { computeRollup } from "../engine/rollup";
import { migrateTableConfig, isLegacyTableConfig } from "../migration";
import { WIDGET_TEMPLATES } from "../widgetTemplates";
import type {
  DatabaseViewConfig,
  ChartConfig,
  AggregationConfig,
  ConditionalFormat,
} from "../types";
import type { TransformPipeline } from "../engine/transformTypes";

// ── Test Data ────────────────────────────────────────────────

function makeProjectFrame(): DataFrame {
  const fields: DataField[] = [
    { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
    { name: "status", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
    { name: "priority", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    { name: "budget", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    { name: "deadline", type: DataFieldType.Date, repeated: false, identifier: false, derived: false },
    { name: "done", type: DataFieldType.Boolean, repeated: false, identifier: false, derived: false },
    { name: "assignee", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
  ];

  const records: DataRecord[] = [
    {
      id: "Projects/Alpha.md",
      values: { name: "[[Projects/Alpha|Alpha]]", status: "Active", priority: 1, budget: 50000, deadline: "2026-06-01", done: false, assignee: "Alice" },
    },
    {
      id: "Projects/Beta.md",
      values: { name: "[[Projects/Beta|Beta]]", status: "Active", priority: 2, budget: 30000, deadline: "2026-07-15", done: false, assignee: "Bob" },
    },
    {
      id: "Projects/Gamma.md",
      values: { name: "[[Projects/Gamma|Gamma]]", status: "Completed", priority: 1, budget: 20000, deadline: "2026-03-01", done: true, assignee: "Alice" },
    },
    {
      id: "Projects/Delta.md",
      values: { name: "[[Projects/Delta|Delta]]", status: "On Hold", priority: 3, budget: 15000, deadline: "2026-09-01", done: false, assignee: "Carol" },
    },
    {
      id: "Projects/Epsilon.md",
      values: { name: "[[Projects/Epsilon|Epsilon]]", status: "Active", priority: 2, budget: 45000, deadline: "2026-08-01", done: false, assignee: "Bob" },
    },
    {
      id: "Projects/Zeta.md",
      values: { name: "[[Projects/Zeta|Zeta]]", status: "Completed", priority: 1, budget: 10000, deadline: "2026-02-15", done: true, assignee: "Carol" },
    },
  ];

  return { fields, records };
}

function makeRelationFrame(): DataFrame {
  const fields: DataField[] = [
    { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
    { name: "related", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
    { name: "score", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
  ];

  const records: DataRecord[] = [
    { id: "A.md", values: { name: "A", related: "[[B]], [[C]]", score: 10 } },
    { id: "B.md", values: { name: "B", related: "[[A]]", score: 20 } },
    { id: "C.md", values: { name: "C", related: "[[A]], [[B]]", score: 30 } },
    { id: "D.md", values: { name: "D", related: "", score: 5 } },
  ];

  return { fields, records };
}

// ── E2E: Full Pipeline Workflow ──────────────────────────────

describe("E2E: Pipeline → Aggregation → Formatting", () => {
  const frame = makeProjectFrame();

  test("filter → group-by → aggregate chain", () => {
    // Step 1: Filter to Active projects
    const filterPipeline: TransformPipeline = {
      steps: [
        {
          type: "filter",
          conditions: {
            conditions: [
              { field: "status", operator: "is" as const, value: "Active", enabled: true },
            ],
          },
        },
      ],
    };
    const filtered = executeTransform(frame, filterPipeline);
    expect(filtered.data.records).toHaveLength(3);
    expect(filtered.meta.stepsExecuted).toBe(1);

    // Step 2: Group by assignee
    const groupPipeline: TransformPipeline = {
      steps: [{ type: "group-by", fields: ["assignee"] }],
    };
    const grouped = executeTransform(filtered.data, groupPipeline);
    expect(grouped.data.records.length).toBeGreaterThanOrEqual(2); // Alice, Bob

    // Step 3: Aggregate budget per assignee
    const aggPipeline: TransformPipeline = {
      steps: [
        { type: "group-by", fields: ["assignee"] },
        {
          type: "aggregate",
          columns: [
            { sourceField: "budget", outputName: "total_budget", function: "SUM" },
            { sourceField: "budget", outputName: "avg_budget", function: "AVG" },
          ],
        },
      ],
    };
    const aggregated = executeTransform(filtered.data, aggPipeline);
    expect(aggregated.meta.stepsExecuted).toBe(2);
    expect(aggregated.data.records.length).toBe(2); // Alice(1), Bob(2)

    // Verify Alice budget = 50000, Bob budget = 30000 + 45000 = 75000
    const alice = aggregated.data.records.find(
      (r) => r.values["assignee"] === "Alice"
    );
    const bob = aggregated.data.records.find(
      (r) => r.values["assignee"] === "Bob"
    );
    expect(alice?.values["total_budget"]).toBe(50000);
    expect(bob?.values["total_budget"]).toBe(75000);
    expect(bob?.values["avg_budget"]).toBe(37500);
  });

  test("compute step adds derived columns", () => {
    const pipeline: TransformPipeline = {
      steps: [
        {
          type: "compute",
          columns: [
            { name: "budget_k", expression: "budget / 1000" },
            { name: "priority_score", expression: "100 / priority" },
          ],
        },
      ],
    };
    const result = executeTransform(frame, pipeline);
    expect(result.data.records[0]?.values["budget_k"]).toBe(50);
    expect(result.data.records[0]?.values["priority_score"]).toBe(100); // priority=1 → 100
    expect(result.data.records[1]?.values["budget_k"]).toBe(30);
    expect(result.data.records[1]?.values["priority_score"]).toBe(50); // priority=2 → 50
    expect(result.derivedFields.some((f) => f.name === "budget_k")).toBe(true);
  });

  test("footer aggregation on full dataset", () => {
    const aggConfig: AggregationConfig = {
      budget: "sum",
      priority: "avg",
      name: "count",
      done: "count_checked",
    };

    const result = computeAggregations(frame, aggConfig);
    expect(result["budget"]?.value).toBe(170000);
    expect(result["name"]?.value).toBe(6);
    expect(result["done"]?.value).toBe(2);
    expect(result["priority"]?.formattedValue).toBeDefined();
  });

  test("conditional format produces valid CSS", () => {
    const formats: ConditionalFormat[] = [
      {
        id: "f1",
        field: "status",
        conditions: [
          {
            operator: "is" as const,
            value: "Active",
            style: { backgroundColor: "#d4edda", bold: true },
          },
          {
            operator: "is" as const,
            value: "On Hold",
            style: { backgroundColor: "#fff3cd", textColor: "#856404" },
          },
        ],
      },
    ];

    // Active record should match first rule
    const activeStyles = computeRowStyles(formats, frame.records[0]!);
    expect(activeStyles["status"]).toBeDefined();
    expect(activeStyles["status"]?.backgroundColor).toBe("#d4edda");
    expect(activeStyles["status"]?.bold).toBe(true);

    // On Hold record should match second rule
    const holdStyles = computeRowStyles(formats, frame.records[3]!);
    expect(holdStyles["status"]?.backgroundColor).toBe("#fff3cd");

    // CSS output should be safe
    const css = cellStyleToCSS(activeStyles["status"]!);
    expect(css).toContain("background-color: #d4edda");
    expect(css).toContain("font-weight: 700");
    expect(css).not.toContain("script"); // XSS safety check

    // Completed record should NOT match Active or On Hold
    const completedStyles = computeRowStyles(formats, frame.records[2]!);
    expect(completedStyles["status"]).toBeUndefined();
  });
});

// ── E2E: Chart Data Pipeline ─────────────────────────────────

describe("E2E: Chart data pipeline", () => {
  const frame = makeProjectFrame();

  test("pie chart: status distribution by count", () => {
    const config: ChartConfig = {
      chartType: "pie",
      xAxis: {
        property: "status",
        sortBy: "value",
        sortOrder: "desc",
        omitZero: false,
      },
      yAxis: {
        property: "count",
        aggregation: "count",
      },
      style: {
        colorScheme: "auto",
        height: "medium",
        showGrid: false,
        showLabels: true,
        showLegend: true,
        showValues: true,
      },
    };

    const data = computeChartData(frame, config);
    expect(data.labels).toContain("Active");
    expect(data.labels).toContain("Completed");
    expect(data.labels).toContain("On Hold");
    expect(data.series).toHaveLength(1);
    expect(data.series[0]?.name).toBe("Count");

    // Total should be 6
    const total = data.series[0]!.values.reduce((s: number, v) => s + (v ?? 0), 0);
    expect(total).toBe(6);

    // Active = 3, Completed = 2, On Hold = 1
    const activeIdx = data.labels.indexOf("Active");
    expect(data.series[0]!.values[activeIdx]).toBe(3);
  });

  test("bar chart: budget sum by assignee, sorted desc", () => {
    const config: ChartConfig = {
      chartType: "bar",
      xAxis: {
        property: "assignee",
        sortBy: "value",
        sortOrder: "desc",
        omitZero: true,
      },
      yAxis: {
        property: "budget",
        aggregation: "sum",
      },
      style: {
        colorScheme: "auto",
        height: "medium",
        showGrid: true,
        showLabels: true,
        showLegend: false,
        showValues: true,
      },
    };

    const data = computeChartData(frame, config);
    expect(data.labels.length).toBe(3); // Alice, Bob, Carol

    // Values should be sorted desc
    const values = data.series[0]!.values;
    for (let i = 1; i < values.length; i++) {
      expect((values[i - 1] ?? 0)).toBeGreaterThanOrEqual(values[i] ?? 0);
    }

    // Bob: 30000 + 45000 = 75000 (highest)
    expect(data.labels[0]).toBe("Bob");
    expect(values[0]).toBe(75000);
  });

  test("line chart: cumulative budget", () => {
    const config: ChartConfig = {
      chartType: "line",
      xAxis: {
        property: "assignee",
        sortBy: "label",
        sortOrder: "asc",
        omitZero: false,
      },
      yAxis: {
        property: "budget",
        aggregation: "sum",
        cumulative: true,
      },
      style: {
        colorScheme: "auto",
        height: "medium",
        showGrid: true,
        showLabels: true,
        showLegend: false,
        showValues: false,
        smooth: true,
      },
    };

    const data = computeChartData(frame, config);
    const values = data.series[0]!.values;

    // Cumulative: each value >= previous
    for (let i = 1; i < values.length; i++) {
      expect((values[i] ?? 0)).toBeGreaterThanOrEqual(values[i - 1] ?? 0);
    }

    // Last value should be total budget = 170000
    expect(values[values.length - 1]).toBe(170000);
  });

  test("chart pipeline respects omitZero", () => {
    // Create frame with a zero-budget record
    const frameWithZero: DataFrame = {
      fields: makeProjectFrame().fields,
      records: [
        ...makeProjectFrame().records,
        {
          id: "Projects/Zero.md",
          values: { name: "Zero", status: "Draft", priority: 4, budget: 0, deadline: "2026-12-01", done: false, assignee: "Nobody" },
        },
      ],
    };

    const config: ChartConfig = {
      chartType: "bar",
      xAxis: { property: "assignee", sortBy: "label", sortOrder: "asc", omitZero: true },
      yAxis: { property: "budget", aggregation: "sum" },
      style: { colorScheme: "auto", height: "medium", showGrid: false, showLabels: true, showLegend: false, showValues: false },
    };

    const data = computeChartData(frameWithZero, config);
    expect(data.labels).not.toContain("Nobody");
  });
});

// ── E2E: Relations + Rollups ─────────────────────────────────

describe("E2E: Relation resolution → Rollup", () => {
  const frame = makeRelationFrame();

  test("extract and resolve wiki-links, then rollup scores", () => {
    // Step 1: Extract links
    const linksA = extractWikiLinks("[[B]], [[C]]");
    expect(linksA).toEqual(["B", "C"]);

    const linksD = extractWikiLinks("");
    expect(linksD).toEqual([]);

    // Step 2: Resolve relations for record A
    const resolutionA = resolveRelations(frame, "related");
    const resultA = resolutionA.find((r) => r.sourceId === "A.md");
    expect(resultA).toBeDefined();
    expect(resultA!.relations).toHaveLength(2);
    expect(resultA!.relations[0]?.target?.values["name"]).toBe("B");
    expect(resultA!.relations[1]?.target?.values["name"]).toBe("C");

    // Record D has no relations — resolveRelations excludes it
    const resultD = resolutionA.find((r) => r.sourceId === "D.md");
    expect(resultD).toBeUndefined();

    // Step 3: Rollup scores from A's relations (B=20, C=30)
    const rollupSum = computeRollup(frame.records[0]!, {
      relationField: "related",
      targetField: "score",
      function: "sum",
    }, frame);
    expect(rollupSum.value).toBe(50); // 20 + 30

    const rollupAvg = computeRollup(frame.records[0]!, {
      relationField: "related",
      targetField: "score",
      function: "avg",
    }, frame);
    expect(rollupAvg.value).toBe(25); // (20 + 30) / 2

    const rollupCount = computeRollup(frame.records[0]!, {
      relationField: "related",
      targetField: "score",
      function: "count",
    }, frame);
    expect(rollupCount.value).toBe(2);

    // Record D: no relations → rollup should be 0 or null
    const rollupEmpty = computeRollup(frame.records[3]!, {
      relationField: "related",
      targetField: "score",
      function: "sum",
    }, frame);
    expect(rollupEmpty.value === 0 || rollupEmpty.value === null).toBe(true);
  });

  test("bi-directional backlinks: enrichWithBacklinks", () => {
    // A links to B and C; B links to A
    const frame: DataFrame = {
      fields: [
        { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
        { name: "related", type: DataFieldType.Relation, repeated: true, identifier: false, derived: false },
      ],
      records: [
        { id: "A.md", values: { name: "A", related: "[[B]] [[C]]" } },
        { id: "B.md", values: { name: "B", related: "[[A]]" } },
        { id: "C.md", values: { name: "C", related: "" } },
        { id: "D.md", values: { name: "D", related: "" } },
      ],
    };

    // computeBacklinks: B should be linked from A, A should be linked from B
    const result = computeBacklinks(frame, "related");
    expect(result.fieldName).toBe("related_backlinks");
    expect(result.backlinks.get("B.md")).toContain("A.md");
    expect(result.backlinks.get("C.md")).toContain("A.md");
    expect(result.backlinks.get("A.md")).toContain("B.md");
    expect(result.backlinks.has("D.md")).toBe(false);

    // enrichWithBacklinks: adds derived field + values
    const enriched = enrichWithBacklinks(frame, ["related"]);
    expect(enriched.fields.find((f: DataField) => f.name === "related_backlinks")).toBeDefined();
    expect(enriched.fields.find((f: DataField) => f.name === "related_backlinks")?.derived).toBe(true);

    // B's backlinks should contain [[A]]
    const recordB = enriched.records.find((r: DataRecord) => r.id === "B.md");
    expect(recordB?.values["related_backlinks"]).toBeDefined();
    expect(recordB?.values["related_backlinks"]).toContain("[[A]]");

    // C's backlinks should contain [[A]]
    const recordC = enriched.records.find((r: DataRecord) => r.id === "C.md");
    expect(recordC?.values["related_backlinks"]).toContain("[[A]]");

    // D has no backlinks — field absent or undefined
    const recordD = enriched.records.find((r: DataRecord) => r.id === "D.md");
    expect(recordD?.values["related_backlinks"]).toBeUndefined();
  });
});

// ── E2E: Config Migration + Templates ────────────────────────

describe("E2E: Config migration → template application", () => {
  test("legacy TableConfig migrates and produces valid DatabaseViewConfig", () => {
    const legacy = {
      fieldConfig: { name: { width: 250 }, budget: { width: 120, pinned: true } },
      sortField: "budget",
      sortAsc: false,
      orderFields: ["name", "budget", "status", "deadline"],
    };

    expect(isLegacyTableConfig(legacy)).toBe(true);

    const config = migrateTableConfig(legacy);

    // Structure checks
    expect(config.layoutVersion).toBe(1);
    expect(config.layoutMode).toBe("stack");
    expect(config.widgets).toHaveLength(1);
    expect(config.widgets[0]?.type).toBe("data-table");
    expect(config.showWidgetToolbar).toBe(true);

    // Table config preserved
    expect(config.table.fieldConfig?.["budget"]?.pinned).toBe(true);
    expect(config.table.sortField).toBe("budget");
    expect(config.table.sortAsc).toBe(false);
    expect(config.table.orderFields).toEqual(["name", "budget", "status", "deadline"]);
  });

  test("DatabaseViewConfig is NOT detected as legacy", () => {
    const dbConfig: DatabaseViewConfig = {
      widgets: [{ id: "w1", type: "data-table", title: "Table", layout: { x: 0, y: 0, w: 12, h: 6 }, config: {} }],
      layoutMode: "stack",
      layoutVersion: 1,
      table: {},
      showWidgetToolbar: true,
      compactMode: false,
    };
    expect(isLegacyTableConfig(dbConfig as unknown as Record<string, unknown>)).toBe(false);
  });

  test("widget templates produce valid WidgetDefinitions", () => {
    expect(WIDGET_TEMPLATES.length).toBeGreaterThanOrEqual(3);

    for (const template of WIDGET_TEMPLATES) {
      expect(template.id).toBeDefined();
      expect(template.widgets.length).toBeGreaterThan(0);

      for (const widget of template.widgets) {
        expect(widget.id).toBeTruthy();
        expect(["data-table", "chart", "stats", "comparison", "checklist", "view-port"]).toContain(widget.type);
        expect(widget.layout.w).toBeGreaterThan(0);
        expect(widget.layout.h).toBeGreaterThan(0);
      }
    }
  });

  test("dashboard template includes stats + chart + table", () => {
    const dashboard = WIDGET_TEMPLATES.find((t) => t.id === "dashboard");
    expect(dashboard).toBeDefined();

    const types = dashboard!.widgets.map((w) => w.type);
    expect(types).toContain("stats");
    expect(types).toContain("chart");
    expect(types).toContain("data-table");
  });
});

// ── E2E: Multi-step pipeline with compute + filter + aggregate ─

describe("E2E: Complex multi-step pipeline", () => {
  const frame = makeProjectFrame();

  test("compute → filter → group-by → aggregate", () => {
    const pipeline: TransformPipeline = {
      steps: [
        // Step 1: Compute a "budget per priority" column
        {
          type: "compute",
          columns: [{ name: "budget_per_prio", expression: "budget / priority" }],
        },
        // Step 2: Filter only non-completed (use string field; boolean needs is-not-checked)
        {
          type: "filter",
          conditions: {
            conditions: [
              { field: "status", operator: "is-not" as const, value: "Completed", enabled: true },
            ],
          },
        },
        // Step 3: Group by status
        { type: "group-by", fields: ["status"] },
        // Step 4: Aggregate
        {
          type: "aggregate",
          columns: [
            { sourceField: "budget", outputName: "total", function: "SUM" },
            { sourceField: "budget", outputName: "avg", function: "AVG" },
          ],
        },
      ],
    };

    const result = executeTransform(frame, pipeline);

    // Should have executed all 4 steps
    expect(result.meta.stepsExecuted).toBe(4);

    // Non-completed: Active(3) + On Hold(1) = 4 records before group-by
    // After group-by + aggregate: Active, On Hold
    expect(result.data.records.length).toBe(2);

    const active = result.data.records.find((r) => r.values["status"] === "Active");
    const onHold = result.data.records.find((r) => r.values["status"] === "On Hold");

    // Active: 50000 + 30000 + 45000 = 125000
    expect(active?.values["total"]).toBe(125000);

    // On Hold: 15000
    expect(onHold?.values["total"]).toBe(15000);
    expect(onHold?.values["avg"]).toBe(15000); // single record
  });

  test("pipeline preserves execution metadata", () => {
    const pipeline: TransformPipeline = {
      steps: [
        { type: "compute", columns: [{ name: "doubled", expression: "budget * 2" }] },
        { type: "filter", conditions: { conditions: [{ field: "status", operator: "is" as const, value: "Active", enabled: true }] } },
      ],
    };

    const result = executeTransform(frame, pipeline);

    expect(result.meta.inputRowCount).toBe(6);
    expect(result.meta.outputRowCount).toBe(3);
    expect(result.meta.stepsExecuted).toBe(2);
    expect(result.meta.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.meta.warnings).toEqual([]);
  });
});

// ── E2E: Security scenarios ──────────────────────────────────

describe("E2E: Security — CSS injection prevention", () => {
  test("malicious color values are sanitized", () => {
    const formats: ConditionalFormat[] = [
      {
        id: "evil",
        field: "status",
        conditions: [
          {
            operator: "is" as const,
            value: "Active",
            style: {
              backgroundColor: "red; background-image: url(evil)",
              textColor: "#ff0000",
            },
          },
        ],
      },
    ];

    const record: DataRecord = {
      id: "test.md",
      values: { status: "Active" },
    };

    const styles = computeRowStyles(formats, record);
    const css = cellStyleToCSS(styles["status"]!);

    // Malicious backgroundColor should be stripped (doesn't match SAFE_COLOR)
    expect(css).not.toContain("url(evil)");
    expect(css).not.toContain("background-image");

    // Valid textColor should be preserved
    expect(css).toContain("color: #ff0000");
  });
});
