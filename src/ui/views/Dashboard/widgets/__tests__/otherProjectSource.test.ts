/**
 * A chart or a stats block may read ANOTHER project as its own data (3.6.0).
 *
 * Personal finances show the massage room's income by month; the room is a
 * separate project. Until now only `database-call` could read another
 * project, and a chart could reach one only through a join onto its own
 * rows (calc-charts-map). `widget.config.dataProjectId` names the project;
 * its preloaded frame replaces this project's as the block's input, and the
 * block's own scope and pipeline run over it. While that frame is not ready
 * the block has a state to show, never this project's numbers.
 */

import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
import type { ProjectDefinition } from "src/settings/settings";
import type { WidgetDefinition } from "../../types";
import type { ExternalSourceState } from "../../dashboardPreload";
import { collectReferencedSourceIds } from "../../dashboardPreload";
import { computeHostFrames } from "../hostFrames";
import { otherProjectNotice } from "../linkedSourceState";

const frame = (field: string, values: number[]): DataFrame =>
  ({
    fields: [{ name: field, type: DataFieldType.Number, repeated: false, identifier: false, derived: false }],
    records: values.map((v, i) => ({ id: `${field}${i}.md`, values: { [field]: v } })),
  }) as unknown as DataFrame;

const own = frame("amount", [1, 2]);
const room = frame("price", [3000, 3500, 4000]);

const widget = (type: WidgetDefinition["type"], config: Record<string, unknown>): WidgetDefinition =>
  ({ id: "w", type, title: "", position: { x: 0, y: 0, w: 1, h: 1 }, config }) as unknown as WidgetDefinition;

const NONE: TransformPipeline = { steps: [] };

function run(w: WidgetDefinition, states: ReadonlyMap<string, ExternalSourceState>) {
  return computeHostFrames({
    widget: w, frame: own, fields: own.fields, pipeline: NONE,
    rightFrames: new Map(), sourceStates: states, parts: [], sources: [],
  });
}

const ready = new Map<string, ExternalSourceState>([["room", { status: "ready", frame: room } as ExternalSourceState]]);
const loading = new Map<string, ExternalSourceState>([["room", { status: "loading" } as ExternalSourceState]]);

describe("chart and stats read another project", () => {
  test.each(["chart", "stats"] as const)("%s: the other project's rows are the input", (type) => {
    const f = run(widget(type, { dataProjectId: "room" }), ready);
    expect(f.transformedFrame.records.map((r) => r.values["price"])).toEqual([3000, 3500, 4000]);
    expect(f.otherProject?.kind).toBe("ready");
  });

  test("its pipeline runs over the other project's rows", () => {
    const sum: TransformPipeline = { steps: [{ type: "aggregate", columns: [{ sourceField: "price", outputName: "total", function: "SUM" }] }] };
    const f = computeHostFrames({
      widget: widget("stats", { dataProjectId: "room" }), frame: own, fields: own.fields, pipeline: sum,
      rightFrames: new Map(), sourceStates: ready, parts: [], sources: [],
    });
    expect(f.transformedFrame.records[0]!.values["total"]).toBe(10500);
  });

  test("while loading: a state, and none of this project's numbers", () => {
    const f = run(widget("chart", { dataProjectId: "room" }), loading);
    expect(f.otherProject?.kind).toBe("loading");
    expect(f.transformedFrame.records).toHaveLength(0);
  });

  test("without dataProjectId nothing changes", () => {
    const f = run(widget("chart", {}), ready);
    expect(f.otherProject).toBeNull();
    expect(f.transformedFrame.records).toHaveLength(2);
  });

  test("other types ignore it (database-call has its own sourceConfig)", () => {
    const f = run(widget("data-table", { dataProjectId: "room" }), ready);
    expect(f.otherProject).toBeNull();
    expect(f.transformedFrame.records).toHaveLength(2);
  });

  test("the dashboard preloads the project a chart or stats block reads", () => {
    const project = { id: "fin", fieldConfig: {} } as unknown as ProjectDefinition;
    expect(collectReferencedSourceIds([widget("stats", { dataProjectId: "room" })], project)).toContain("room");
  });
});

describe("the block says why it shows nothing", () => {
  test("loading, unavailable and error each have a screen notice; ready and none have none", () => {
    expect(otherProjectNotice({ kind: "loading", projectId: "room" })?.icon).toBe("loader");
    expect(otherProjectNotice({ kind: "unavailable", projectId: "room" })?.vars).toEqual({ id: "room" });
    expect(otherProjectNotice({ kind: "error", projectId: "room", message: "boom" })?.hint).toBe("boom");
    expect(otherProjectNotice({ kind: "ready", projectId: "room", frame: room })).toBeNull();
    expect(otherProjectNotice(null)).toBeNull();
  });
});
