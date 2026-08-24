// #118 — axis A (scope) and its position relative to axis C (transform).
// The order is the behavioral contract of FILTER_ORDER_ADR.md: scope narrows
// the frame BEFORE the pipeline runs, which is an inversion of the pre-#118
// wiring and is exactly what these tests pin.

import { applyWidgetScope, widgetScopeFilter } from "../widgetScope";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { FilterDefinition } from "src/settings/settings";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";

const frame = (rows: Array<Record<string, unknown>>): DataFrame =>
  ({
    fields: [
      { name: "status", type: DataFieldType.String },
      { name: "amount", type: DataFieldType.Number },
    ],
    records: rows.map((values, i) => ({ id: `r${i}`, path: `r${i}.md`, values })),
  }) as unknown as DataFrame;

const isDone: FilterDefinition = {
  conjunction: "and",
  conditions: [
    { field: "status", operator: "is", value: "done" },
  ] as unknown as FilterDefinition["conditions"],
};

const SAMPLE = [
  { status: "done", amount: 1 },
  { status: "open", amount: 2 },
  { status: "done", amount: 3 },
];

describe("#118 widgetScopeFilter", () => {
  it("returns undefined when there is no subFilter", () => {
    expect(widgetScopeFilter({})).toBeUndefined();
    expect(widgetScopeFilter(undefined)).toBeUndefined();
  });

  it("returns undefined for a filter that would remove nothing", () => {
    expect(widgetScopeFilter({ subFilter: { conditions: [] } })).toBeUndefined();
  });

  it("recognises a groups-only filter as a real scope", () => {
    const groupsOnly: FilterDefinition = {
      conjunction: "and",
      conditions: [],
      groups: [isDone],
    };

    expect(widgetScopeFilter({ subFilter: groupsOnly })).toBe(groupsOnly);
  });
});

describe("#118 applyWidgetScope", () => {
  it("narrows the frame by the widget subFilter", () => {
    const result = applyWidgetScope(frame(SAMPLE), { subFilter: isDone });

    expect(result.records.map((r) => r.values["amount"])).toEqual([1, 3]);
  });

  it("returns the same frame when there is no scope", () => {
    const input = frame(SAMPLE);

    expect(applyWidgetScope(input, {})).toBe(input);
  });

  it("applies a groups-only scope instead of silently passing everything", () => {
    const groupsOnly: FilterDefinition = {
      conjunction: "and",
      conditions: [],
      groups: [isDone],
    };
    const result = applyWidgetScope(frame(SAMPLE), { subFilter: groupsOnly });

    expect(result.records).toHaveLength(2);
  });
});

describe("#118 order invariant — A runs before C", () => {
  // What separates the two orders is which rows the pipeline ever sees.
  // `meta.inputRowCount` reports exactly that, so it is the honest probe:
  // under A→C the pipeline is fed the scoped frame, under C→A the full one.
  const pipeline: TransformPipeline = {
    steps: [
      {
        type: "aggregate",
        columns: [{ sourceField: "amount", outputName: "total", function: "SUM" }],
      },
    ],
  };

  it("feeds the pipeline only the rows that survived the scope", () => {
    const scoped = applyWidgetScope(frame(SAMPLE), { subFilter: isDone });
    const result = executeTransform(scoped, pipeline);

    expect(result.meta.inputRowCount).toBe(2);
    expect(result.data.records).toHaveLength(2);
  });

  it("differs from the reversed order, so the inversion cannot regress silently", () => {
    const aThenC = executeTransform(
      applyWidgetScope(frame(SAMPLE), { subFilter: isDone }),
      pipeline
    );
    const cThenA = executeTransform(frame(SAMPLE), pipeline);

    // Pre-#118 wiring ran the pipeline over every row before scope narrowed it.
    expect(aThenC.meta.inputRowCount).toBe(2);
    expect(cThenA.meta.inputRowCount).toBe(3);
  });

  it("keeps scope and pipeline composable — scoping twice changes nothing", () => {
    const once = applyWidgetScope(frame(SAMPLE), { subFilter: isDone });
    const twice = applyWidgetScope(once, { subFilter: isDone });

    expect(twice.records).toHaveLength(once.records.length);
  });
});
