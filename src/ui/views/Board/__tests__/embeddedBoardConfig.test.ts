import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DEFAULT_PROJECT } from "src/settings/settings";
import BoardView from "../BoardView.svelte";

jest.mock("src/ui/modals/createNoteModal", () => ({ CreateNoteModal: jest.fn() }));
jest.mock("src/lib/record/openRecord", () => ({ activateRecord: jest.fn() }));
jest.mock("../components", () => ({ Board: require("src/ui/components/EmptyState/EmptyState.svelte").default }));
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: jest.requireActual("src/ui/components/Layout/ViewLayout.svelte").default,
  ViewContent: jest.requireActual("src/ui/components/Layout/ViewContent.svelte").default,
}));

afterEach(cleanup);
const props = () => ({
  project: { ...DEFAULT_PROJECT, id: "project", name: "Project" },
  frame: { fields: ["status", "priority"].map(name => ({ name, type: "string" as const, identifier: false, derived: false, repeated: false })), records: [] },
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
