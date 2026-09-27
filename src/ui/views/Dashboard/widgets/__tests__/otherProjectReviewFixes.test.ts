/**
 * Codex review of 6e25566 (other-project source), two findings:
 * - an unresolved source (loading / unavailable / error) still ran the
 *   pipeline, so an aggregate produced a synthetic `total = 0` row;
 * - the picker vanished when no other project was left, so a stale
 *   `dataProjectId` (the project was deleted) could not be cleared.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
import type { WidgetDefinition } from "../../types";
import type { ExternalSourceState } from "../../dashboardPreload";
import { computeHostFrames } from "../hostFrames";
import DataProjectPicker from "../_shared/DataProjectPicker.svelte";

const own = {
  fields: [{ name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false }],
  records: [{ id: "a.md", values: { amount: 1 } }],
} as unknown as DataFrame;
const sum: TransformPipeline = { steps: [{ type: "aggregate", columns: [{ sourceField: "price", outputName: "total", function: "SUM" }] }] };
const widget = { id: "w", type: "stats", title: "", position: { x: 0, y: 0, w: 1, h: 1 }, config: { dataProjectId: "room" } } as unknown as WidgetDefinition;

test.each([
  ["loading", { status: "loading" }],
  ["unavailable", { status: "unavailable" }],
  ["error", { status: "error", message: "x" }],
])("%s: no rows even through an aggregate pipeline", (_name, state) => {
  const f = computeHostFrames({
    widget, frame: own, fields: own.fields, pipeline: sum, rightFrames: new Map(),
    sourceStates: new Map([["room", state as ExternalSourceState]]), parts: [], sources: [],
  });
  expect(f.transformedFrame.records).toHaveLength(0);
});

test("a stale project with no other project left keeps the picker, with a way back to this project", () => {
  const { container } = render(DataProjectPicker, { props: { value: "gone", availableSources: [] } });
  const options = Array.from(container.querySelectorAll("option")).map((o) => o.getAttribute("value"));
  expect(options).toEqual(["", "gone"]);
});

test("no other project and nothing chosen: no picker", () => {
  const { container } = render(DataProjectPicker, { props: { availableSources: [] } });
  expect(container.querySelector("select")).toBeNull();
});
