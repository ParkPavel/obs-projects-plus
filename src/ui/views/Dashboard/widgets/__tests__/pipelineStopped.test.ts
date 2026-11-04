import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { computeHostFrames } from "../hostFrames";
import { resolveExternalFrame } from "src/lib/externalFrameResolver";
import { executeTransformCached, getTransformCacheSize, invalidateTransformCache } from "src/lib/dashboard-engine/transformCache";
type WidgetDefinition = import("../../types").WidgetDefinition;

jest.mock("src/lib/dashboard-engine/transformBudget", () => {
  const actual = jest.requireActual("src/lib/dashboard-engine/transformBudget");
  return { ...actual, createTransformBudget: (context: object | undefined, start: number) => actual.createTransformBudget({ ...context, workLimit: 10 }, start) };
});
jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string) => key }) }));
jest.mock("../WidgetSetupWizard.svelte", () => require("src/ui/views/Board/__tests__/fixtures/ButtonStub.svelte"));
jest.mock("../LegacyWidgetPlaceholder.svelte", () => require("src/ui/views/Board/__tests__/fixtures/ButtonStub.svelte"));
jest.mock("src/lib/datasources/folder/datasource", () => ({ FolderDataSource: jest.fn() }));
jest.mock("src/lib/datasources/tag/datasource", () => ({ TagDataSource: jest.fn() }));
jest.mock("src/lib/datasources/dataview/datasource", () => ({ DataviewDataSource: jest.fn() }));
const Content = require("../WidgetContent.svelte").default;
const frame = { fields: [{ name: "amount", type: DataFieldType.Number, repeated: false, derived: false, identifier: false }],
  records: Array.from({ length: 5 }, (_, id) => ({ id: `${id}.md`, values: { amount: id } })) };
const pipeline = { steps: [{ type: "compute" as const, columns: [{ name: "computed", expression: "amount + 1" }] }] };
const widget = { id: "stopped", type: "chart", title: "Chart", config: {} } as WidgetDefinition;
const host = () => computeHostFrames({ widget, frame, fields: frame.fields, pipeline, rightFrames: new Map(), sourceStates: new Map(), parts: [], sources: [] });
afterEach(() => { cleanup(); invalidateTransformCache(); });

test("an incomplete host frame is accompanied by a visible notice instead of plausible chart data", async () => {
  const frames = host(); expect(frames.pipelineStopped).toBe("work-limit");
  const body = jest.fn().mockImplementation(() => ({ $$: { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }, $set() {}, $on() { return () => {}; }, $destroy() {} }));
  const view = render(Content, { props: { widget, readonly: false, ctx: frames, entry: { component: body, props: () => ({}) } } }); await tick();
  expect(view.getByRole("status")).toHaveTextContent("views.dashboard.pipeline.execution-stopped");
  expect(view.getByRole("status")).toHaveTextContent("views.dashboard.pipeline.execution.work-limit"); expect(body).not.toHaveBeenCalled();
  view.component.$set({ ctx: { ...frames, pipelineStopped: undefined } }); await tick();
  expect(view.queryByRole("status")).toBeNull(); expect(body).toHaveBeenCalledTimes(1);
});
test("a default execution stopped by its deadline/work ceiling is not cached", () => {
  expect(executeTransformCached(frame, pipeline).meta.stopped).toBe("work-limit");
  expect(getTransformCacheSize()).toBe(0);
});
test("a linked block cannot acquire the partial result of an interrupted transformation", async () => {
  const { FolderDataSource } = require("src/lib/datasources/folder/datasource");
  FolderDataSource.mockImplementation(() => ({ queryAll: async () => frame }));
  const project = { id: "p", name: "Project", dataSource: { kind: "folder", config: { path: "p" } }, views: [{ id: "dashboard", name: "Overview", type: "dashboard", config: { widgets: [{ id: "source", type: "database-call", title: "Source", config: {}, transform: pipeline }] } }] };
  const result = await resolveExternalFrame("p::block:dashboard:source", { fileSystem: {}, preferences: {}, projects: [project], dataviewApi: undefined, app: undefined } as never);
  expect(result).toBeNull();
});
