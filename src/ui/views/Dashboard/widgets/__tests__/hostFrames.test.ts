/**
 * #184 — the canonical order, proved by running it instead of by reading it.
 *
 * `R_filterOrder.invariant.test.ts` pins `enrich → A → C` by searching a file
 * for `applyWidgetScope(enrichedFrame` ahead of `executeTransform(scope.frame`.
 * That is a real guard against the one-line regression it was written for, and
 * it is all a substring can do: it proves two calls appear in an order in some
 * text, never that swapping them would change an answer. Its own docstring says
 * the behavioural proof lives elsewhere.
 *
 * Moving the frame math into `hostFrames.ts` made "elsewhere" reachable. The
 * first test below feeds the composition a frame where A-before-C and
 * C-before-A give **different totals**, so the order is asserted by result.
 */

import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { FilterDefinition } from "src/settings/settings";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
import type { WidgetDefinition } from "../../types";

import { computeHostFrames, enrichForWidget } from "../hostFrames";

const frame = (rows: Array<Record<string, unknown>>): DataFrame =>
  ({
    fields: [
      { name: "status", type: DataFieldType.String },
      { name: "bucket", type: DataFieldType.String },
      { name: "amount", type: DataFieldType.Number },
    ],
    records: rows.map((values, i) => ({ id: `r${i}`, path: `r${i}.md`, values })),
  }) as unknown as DataFrame;

const isOpen: FilterDefinition = {
  conjunction: "and",
  conditions: [
    { field: "status", operator: "is", value: "open" },
  ] as unknown as FilterDefinition["conditions"],
};

/** Total `amount` per bucket. Bucket X holds one open row and one done row. */
const sumByBucket: TransformPipeline = {
  steps: [
    { type: "group-by", fields: ["bucket"] },
    {
      type: "aggregate",
      columns: [{ sourceField: "amount", outputName: "total", function: "SUM" }],
    },
  ] as unknown as TransformPipeline["steps"],
};

/**
 * The fixture is built so the two orders cannot agree.
 *
 * Bucket X straddles the filter: one `open` row worth 10 and one `done` row
 * worth 100. Scope-then-group gives X = 10; group-then-scope gives X = 110,
 * and no later filtering can take the 100 back out of a total that already
 * absorbed it. That irreversibility is the point — it is why the order is a
 * contract and not a preference.
 */
const SAMPLE = [
  { status: "open", bucket: "X", amount: 10 },
  { status: "done", bucket: "X", amount: 100 },
  { status: "open", bucket: "Y", amount: 1 },
];

const widget = (config: Record<string, unknown>): WidgetDefinition =>
  ({
    id: "w1",
    type: "data-table",
    title: "T",
    layout: { x: 0, y: 0, w: 4, h: 4 },
    config,
  }) as unknown as WidgetDefinition;

const run = (config: Record<string, unknown>, pipeline: TransformPipeline) =>
  computeHostFrames({
    widget: widget(config),
    frame: frame(SAMPLE),
    fields: frame(SAMPLE).fields,
    pipeline,
    rightFrames: new Map(),
    sourceStates: new Map(),
    // #184: a widget that names no source. `resolveNamedSource` hands the
    // enriched frame straight back, so every assertion below is about the
    // order and nothing else.
    parts: [],
    sources: [],
  });

const totalFor = (f: DataFrame, bucket: string) =>
  f.records.find((r) => r.values["bucket"] === bucket)?.values["total"];

describe("#184 — the order is a result, not a position in a file", () => {
  it("scope narrows BEFORE the pipeline aggregates, and the total says so", () => {
    // X = 10: the `done` row was gone before the sum ran.
    // X = 110 would mean the sum saw it -- axis C ahead of axis A, the pre-#118
    // wiring, and the one regression this invariant exists to catch. No
    // substring search can tell those two numbers apart.
    const out = run({ subFilter: isOpen }, sumByBucket);

    expect(out.scope.applied).toBe(true);
    expect(totalFor(out.transformedFrame, "X")).toBe(10);
    expect(totalFor(out.transformedFrame, "X")).not.toBe(110);
    expect(totalFor(out.transformedFrame, "Y")).toBe(1);
  });

  it("without a scope the same pipeline sees everything — the control", () => {
    // Proves the 10 above came from the scope and not from the fixture.
    // `applied` is true here too, and that is not a bug: it means "nothing is
    // left for the block to apply", which is exactly true when there is no
    // filter at all. False is reserved for a scope that was DEFERRED.
    const out = run({}, sumByBucket);

    expect(out.scope.applied).toBe(true);
    expect(totalFor(out.transformedFrame, "X")).toBe(110);
  });

  it("reports what the pipeline was given, not what it produced", () => {
    // `pipelineInputRowCount` is what tells a block "the pipeline hid all your
    // rows" apart from "there were none". After a scope it must count the
    // SCOPED rows — reporting 3 here would blame the pipeline for the filter.
    expect(run({ subFilter: isOpen }, sumByBucket).pipelineInputRowCount).toBe(2);
  });

  it("leaves a scope it cannot evaluate for the block, rather than emptying it", () => {
    // #118's own refutation, kept live at the composition level: a filter that
    // names a column the pipeline CREATES cannot run ahead of the pipeline.
    // Running it there would match nothing and empty the widget, so axis A is
    // deferred and `applied` says so.
    const namesPipelineColumn: FilterDefinition = {
      conjunction: "and",
      conditions: [
        { field: "total", operator: "is", value: "11" },
      ] as unknown as FilterDefinition["conditions"],
    };
    const out = run({ subFilter: namesPipelineColumn }, sumByBucket);

    expect(out.scope.applied).toBe(false);
    expect(totalFor(out.transformedFrame, "X")).toBe(110);
  });

  it("an empty pipeline is not a pipeline that ran", () => {
    const out = run({ subFilter: isOpen }, { steps: [] } as unknown as TransformPipeline);
    expect(out.transformedFrame.records).toHaveLength(2);
    expect(out.pipelineInputRowCount).toBe(2);
  });
});

describe("#184 — enrichment happens, and only when it has to", () => {
  it("returns the very same frame when no field is a stored Relation", () => {
    // `toBe`, not `toEqual`: enrichment allocating a copy on every widget on
    // every keystroke is the reason this guard is worth a test.
    const f = frame(SAMPLE);
    expect(enrichForWidget(f, f.fields)).toBe(f);
  });

  it("skips a DERIVED relation field — it is the output of enrichment, not input", () => {
    // Enriching from a derived relation would feed the resolver its own
    // product. `!f.derived` is the guard, and this is what it is for.
    const f = frame(SAMPLE);
    const derivedRelation = {
      ...f,
      fields: [
        ...f.fields,
        { name: "backlinks", type: DataFieldType.Relation, derived: true },
      ],
    } as unknown as DataFrame;

    expect(enrichForWidget(derivedRelation, derivedRelation.fields)).toBe(derivedRelation);
  });
});

describe("#184 — sourceId reaches every widget type, projectId does not", () => {
  // The two halves of `WidgetSourceConfig` have different reach, and that is a
  // decision rather than an oversight (see the comment on `sourceId` in
  // types.ts). Adversarial review flagged the asymmetry; this pins it so the
  // next reader finds the answer instead of the question.
  const parts = [
    { id: "s1", frame: { fields: [], records: [{ id: "r0", values: {} }] } as unknown as DataFrame },
  ];
  const sources = [{ kind: "folder", id: "s1", config: { path: "X", recursive: false } }] as never[];

  const narrowed = (type: string) =>
    computeHostFrames({
      widget: {
        id: "w",
        type,
        title: "T",
        layout: { x: 0, y: 0, w: 4, h: 4 },
        config: {},
        sourceConfig: { projectId: "", sourceId: "s1" },
      } as unknown as WidgetDefinition,
      frame: frame(SAMPLE),
      fields: frame(SAMPLE).fields,
      pipeline: { steps: [] } as unknown as TransformPipeline,
      rightFrames: new Map(),
      sourceStates: new Map(),
      parts,
      sources,
    });

  it("narrows a chart by a named source, the same as a table", () => {
    // `r0` is the only id the part carries, so a widget honouring `sourceId`
    // keeps exactly that row out of the three in the fixture.
    for (const type of ["data-table", "chart", "checklist", "database-call"]) {
      const out = narrowed(type);
      expect({ type, ids: out.enrichedFrame.records.map((r) => r.id) }).toEqual({ type, ids: ["r0"] });
    }
  });

  it("but still refuses to read another PROJECT for anything but database-call", () => {
    // The gate that already existed and must not have moved: `isExternal` is
    // what decides whether a block reads a foreign project's frame.
    const chart = narrowed("chart");
    expect(chart.dbCall.isExternal).toBe(false);
  });
});
