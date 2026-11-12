import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";
import { app } from "src/lib/stores/obsidian";
import { getFilterValuesFromConditions } from "src/lib/helpers";
import DatabaseCallBlock from "../DatabaseCallBlock.svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
type ViewTab = import("../../../types").ViewTab;
type FilterCondition = import("src/settings/settings").FilterCondition;

jest.mock("src/ui/views/Board/BoardView.svelte", () => require("./fixtures/CreationContextProbe.svelte"));
jest.mock("src/ui/views/Calendar/CalendarView.svelte", () => require("./fixtures/CreationContextProbe.svelte"));
jest.mock("src/ui/views/Gallery/GalleryView.svelte", () => require("./fixtures/CreationContextProbe.svelte"));
jest.mock("../DataTableContent.svelte", () => require("./fixtures/CreationContextProbe.svelte"));
jest.mock("src/lib/stores/settings", () => ({ settings: Object.assign(require("svelte/store").writable({ projects: [] }), { updateViewConfig: jest.fn() }) }));
jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }) }));
afterEach(cleanup);
const condition = (field: string, value: string): FilterCondition => ({ field, value, operator: "is", enabled: true });

it("passes the table tab's filtered records to its displayed table", async () => {
  const project = { ...DEFAULT_PROJECT, id: "own", name: "Own", views: [] };
  settings.set({ ...DEFAULT_SETTINGS, projects: [project] });
  const fields = [{ name: "status", type: DataFieldType.String, repeated: false, derived: false, identifier: false }];
  const frame = { fields, records: [
    { id: "open.md", values: { status: "open" } }, { id: "closed.md", values: { status: "closed" } },
  ] };
  const view = render(DatabaseCallBlock, { props: { project, frame, fields, api: {} as never, readonly: false, getRecordColor: () => null,
    sourceState: { kind: "parent", frame }, sourceReadOnly: false,
    config: { activeTabId: "tab", viewTabs: [{ id: "tab", label: "Table", viewType: "table", config: {},
      filter: { conjunction: "and", conditions: [condition("status", "open")] } }] } } });
  await tick(); await tick();
  expect(JSON.parse(view.container.querySelector("[data-record-ids]")!.textContent!)).toEqual(["open.md"]);
});

it.each<ViewTab["viewType"]>(["table", "board", "calendar", "gallery"])("%s receives required block and nested tab constraints for creation", async viewType => {
  const tab = { id: "tab", label: viewType, viewType, config: {}, filter: { conjunction: "and", conditions: [condition("status", "open")], groups: [{ conjunction: "and", conditions: [condition("channel", "web")] }] } };
  const project = { ...DEFAULT_PROJECT, id: "own", name: "Own project", views: [] };
  settings.set({ ...DEFAULT_SETTINGS, projects: [project] });
  const record = { id: "Own/A.md", values: { type: "visit", paid: false, status: "open", channel: "web" } };
  const fields = Object.keys(record.values).map(name => ({ name, type: name === "paid" ? DataFieldType.Boolean : DataFieldType.String, identifier: false, derived: false, repeated: false }));
  const frame = { fields, records: [record] };
  const view = render(DatabaseCallBlock, { props: { project, frame, fields, api: {} as never, readonly: false, getRecordColor: () => null,
    sourceState: { kind: "parent", frame }, sourceReadOnly: false,
    config: { activeTabId: "tab", viewTabs: [tab], subFilter: { conjunction: "and", conditions: [condition("type", "visit"), { field: "paid", operator: "is-not-checked", enabled: true }] } },
  } });
  await tick(); await tick();
  const probe = view.container.querySelector("[data-create-context]"); expect(probe).not.toBeNull();
  const conditions = JSON.parse(probe!.textContent!) as FilterCondition[];
  expect(getFilterValuesFromConditions(conditions)).toEqual({ type: "visit", paid: false, status: "open", channel: "web" });
});

it.each(["filter", "readonly", "writer"])("invalidates a first-record draft on %s change and ignores its late completion", async change => {
  const previous = get(app); app.set({ vault: { getAbstractFileByPath: () => null } } as never);
  const project = { ...DEFAULT_PROJECT, id: "own", name: "Own", views: [] };
  settings.set({ ...DEFAULT_SETTINGS, projects: [project] });
  let resolve!: () => void;
  const addRecord = jest.fn().mockReturnValueOnce(new Promise<void>(done => { resolve = done; })).mockResolvedValue(undefined);
  const frame = { fields: [], records: [] }, api = { addRecord } as never;
  const config = { activeTabId: "tab", viewTabs: [{ id: "tab", label: "Table", viewType: "table", config: {} }], subFilter: { conjunction: "and", conditions: [condition("type", "visit")] } };
  try {
    const view = render(DatabaseCallBlock, { props: { project, frame, fields: [], api, readonly: false, getRecordColor: () => null,
      sourceState: { kind: "parent", frame }, sourceReadOnly: false, config } });
    const flush = async () => { await tick(); await tick(); await tick(); };
    await flush(); view.getByRole("button", { name: "Add first record" }).click(); await flush();
    view.container.querySelector<HTMLButtonElement>("[data-note-save]")!.click(); await flush();
    expect(addRecord).toHaveBeenCalledTimes(1);
    view.component.$set(change === "filter" ? { config: { ...config, subFilter: { conjunction: "and", conditions: [condition("type", "call")] } } }
      : change === "readonly" ? { sourceReadOnly: true } : { api: { addRecord: jest.fn().mockResolvedValue(undefined) } as never });
    await flush(); expect(view.container.querySelector("[data-note-draft]")).toBeNull();
    if (change === "readonly") { view.component.$set({ sourceReadOnly: false }); await flush(); }
    view.getByRole("button", { name: "Add first record" }).click(); await flush();
    const fresh = view.container.querySelector("[data-note-draft]"); expect(fresh).not.toBeNull();
    resolve(); await flush(); expect(view.container.querySelector("[data-note-draft]")).toBe(fresh);
  } finally { cleanup(); app.set(previous); }
});

it.each([false, true])("the first table note keeps its context and draft until acknowledgement; failure=%s", async fails => {
  const previous = get(app);
  app.set({ vault: { getAbstractFileByPath: () => null } } as never);
  const project = { ...DEFAULT_PROJECT, id: "own", name: "Own project", views: [] };
  settings.set({ ...DEFAULT_SETTINGS, projects: [project] });
  let resolve!: () => void, reject!: (error: Error) => void;
  const pending = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  const addRecord = jest.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined), frame = { fields: [], records: [] };
  try {
    const view = render(DatabaseCallBlock, { props: { project, frame, fields: [], api: { addRecord } as never, readonly: false, getRecordColor: () => null,
      sourceState: { kind: "parent", frame }, sourceReadOnly: false,
      config: { activeTabId: "tab", viewTabs: [{ id: "tab", label: "Table", viewType: "table", config: {}, filter: { conjunction: "and", conditions: [condition("status", "open")] } }],
        subFilter: { conjunction: "and", conditions: [condition("type", "visit"), { field: "paid", operator: "is-not-checked", enabled: true }] } },
    } });
    await tick(); await tick();
    view.getByRole("button", { name: "Add first record" }).click(); await tick(); await tick();
    const input = view.container.querySelector<HTMLInputElement>("[data-note-draft] input")!; expect(input).not.toBeNull();
    input.value = "New visit"; input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await tick(); await tick();
    expect(addRecord).toHaveBeenCalledTimes(1);
    expect(addRecord.mock.calls[0]![0].values).toMatchObject({ type: "visit", paid: false, status: "open" });
    expect(input.isConnected).toBe(true); expect(input.value).toBe("New visit");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await tick();
    expect(addRecord).toHaveBeenCalledTimes(1);
    if (fails) {
      reject(new Error("write refused")); await tick(); await tick(); await tick();
      expect(input.isConnected).toBe(true); expect(input.value).toBe("New visit");
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await tick(); await tick();
      expect(addRecord).toHaveBeenCalledTimes(2);
    } else resolve();
    await tick(); await tick(); await tick();
    expect(view.container.querySelector("[data-note-draft]")).toBeNull();
  } finally { cleanup(); app.set(previous); }
});
