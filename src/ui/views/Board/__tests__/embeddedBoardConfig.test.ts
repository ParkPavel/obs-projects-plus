import { cleanup, render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { DEFAULT_PROJECT } from "src/settings/settings";
import BoardView from "../BoardView.svelte";
import { settings } from "src/lib/stores/settings";
import { DataFieldType } from "src/lib/dataframe/dataframe";

jest.mock("src/ui/modals/createNoteModal", () => ({ CreateNoteModal: jest.fn() }));
jest.mock("src/lib/record/openRecord", () => ({ activateRecord: jest.fn() }));
jest.mock("../components", () => ({ Board: require("./fixtures/EmbeddedBoardProbe.svelte").default }));
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: jest.requireActual("src/ui/components/Layout/ViewLayout.svelte").default,
  ViewContent: jest.requireActual("src/ui/components/Layout/ViewContent.svelte").default,
}));

afterEach(() => { cleanup(); jest.restoreAllMocks(); });
const props = () => ({
  project: { ...DEFAULT_PROJECT, id: "project", name: "Project" },
  frame: { fields: ["status", "priority"].map(name => ({ name, type: DataFieldType.String, identifier: false, derived: false, repeated: false, typeConfig: { options: ["low", "high"] } })), records: [] },
  readonly: false, api: {} as import("src/lib/viewApi").ViewApi,
  getRecordColor: () => null, sortRecords: (records: readonly import("src/lib/dataframe/dataframe").DataRecord[]) => [...records],
  getRecord: () => undefined, hasSort: false, hasFilter: false,
  config: { groupByField: "status" }, onConfigChange: jest.fn(), embedded: true,
});

test("mount and incoming grouping changes normalize embedded boards without writing or detaching", async () => {
  const p = props();
  const rendered = render(BoardView, p);
  await tick();
  expect(p.onConfigChange).not.toHaveBeenCalled();
  await rendered.component.$set({ config: { groupByField: "priority", persistedStatuses: ["old-status"] } });
  await tick();
  expect(p.onConfigChange).not.toHaveBeenCalled();
  expect(p.config).toEqual({ groupByField: "status" });
});

test("standalone boards retain automatic persisted-column initialization", async () => {
  const p = props();
  render(BoardView, { ...p, embedded: false });
  await tick();
  expect(p.onConfigChange).toHaveBeenCalledWith({ groupByField: "status", persistedStatuses: expect.any(Array) });
});

test("a read-only source cannot add column options to the host project's schema", async () => {
  const p = props();
  const write = jest.spyOn(settings, "updateFieldConfig");
  const rendered = render(BoardView, { ...p, dataReadOnly: true });
  await fireEvent.click(rendered.getByText("Probe column callback"));
  expect(write).not.toHaveBeenCalled();
  expect(p.onConfigChange).not.toHaveBeenCalled();
});

test.each([
  { embedded: true, dataReadOnly: false },
  { embedded: true, dataReadOnly: true },
  { embedded: false, dataReadOnly: true },
])("column reorder preserves source schema with embedded=$embedded, dataReadOnly=$dataReadOnly", async ({ embedded, dataReadOnly }) => {
  const p = props();
  const write = jest.spyOn(settings, "updateFieldConfig");
  const rendered = render(BoardView, { ...p, embedded, dataReadOnly });
  await fireEvent.click(rendered.getByText("Probe reorder callback"));
  expect(write).not.toHaveBeenCalled();
  expect(p.onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ columns: { high: { weight: 0 }, low: { weight: 1 } } }));
  expect(p.frame.fields[0]!.typeConfig.options).toEqual(["low", "high"]);
});
