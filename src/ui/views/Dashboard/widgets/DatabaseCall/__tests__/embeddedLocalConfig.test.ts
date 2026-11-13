import { cleanup, render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS, DEFAULT_VIEW } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";
import { resolveTabView, scopeTabFrame } from "../linkedView";
import { localTabWithConfig } from "../embeddedView";
type ViewTab = import("../../../types").ViewTab;
type ViewApi = import("src/lib/viewApi").ViewApi;
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
import DatabaseCallBlock from "../DatabaseCallBlock.svelte";
import { isMobileDevice } from "src/lib/stores/ui";
import { close as closeDrawer, isOpenNow } from "src/lib/stores/agendaDrawer";

// Break the heavy view import cycles, while mounting the actual block, shared
// settings panel, settings controls, configChange dispatcher and local-fork path.
jest.mock("src/ui/views/Board/BoardView.svelte", () => require("src/ui/components/EmptyState/EmptyState.svelte"));
jest.mock("src/ui/views/Calendar/CalendarView.svelte", () => require("src/ui/components/EmptyState/EmptyState.svelte"));
jest.mock("src/ui/views/Gallery/GalleryView.svelte", () => require("src/ui/components/EmptyState/EmptyState.svelte"));
jest.mock("../DataTableContent.svelte", () => require("src/ui/components/EmptyState/EmptyState.svelte"));
jest.mock("src/ui/modals/createNoteModal", () => ({ CreateNoteModal: jest.fn() }));
jest.mock("src/lib/stores/ui", () => ({ ...jest.requireActual("src/lib/stores/ui"), isMobileDevice: require("svelte/store").writable(false) }));
jest.mock("src/lib/stores/i18n", () => ({
  i18n: require("svelte/store").writable({ t: (key: string, options?: { name?: string }) => options?.name ? `${key} ${options.name}` : key }),
}));
jest.mock("src/lib/stores/settings", () => ({
  settings: Object.assign(require("svelte/store").writable({ projects: [] }), { updateViewConfig: jest.fn() }),
}));

afterEach(() => { cleanup(); (isMobileDevice as import("svelte/store").Writable<boolean>).set(false); });
const source = {
  ...DEFAULT_VIEW, id: "source-view", name: "Publication plan", type: "board",
  config: { groupByField: "status", thumbnailLayout: "none", custom: { retained: 7 } },
  filter: { conjunction: "and" as const, conditions: [{ field: "status", operator: "is" as const, value: "open", enabled: true }] },
  sort: { criteria: [{ field: "rank", order: "desc" as const, enabled: true }] },
};
const linked = (id: string): ViewTab => ({ id, label: id, viewType: "board", linkedViewId: source.id, config: { groupByField: "stale" } });

test.each<[ViewTab["viewType"], string, string, string]>([
  ["board", 'select[data-board-option="thumbnail-layout"]', "thumbnailLayout", "top"],
  ["calendar", 'select[data-calendar-option="interval"]', "interval", "week"],
  ["gallery", 'select[data-gallery-option="layout"]', "layout", "masonry"],
])("%s: the block's actual settings control changes one local tab, never the source or follower", async (viewType, selector, key, value) => {
  const selectedSource = { ...source, type: viewType };
  const project = { ...DEFAULT_PROJECT, id: "source-project", name: "Source project", views: [selectedSource] };
  settings.set({ ...DEFAULT_SETTINGS, projects: [project] });
  const frame: DataFrame = { fields: [], records: [] };
  const tabs = [linked("first"), linked("second")].map(tab => ({ ...tab, viewType }));
  const config = { activeTabId: "first", viewTabs: tabs, customBlockValue: 42 };
  const rendered = render(DatabaseCallBlock, {
    frame, fields: [], api: {} as ViewApi, readonly: false, getRecordColor: () => null,
    config, sourceReadOnly: true,
    sourceState: { kind: "ready", projectId: project.id, frame },
  });
  const changed = jest.fn();
  rendered.component.$on("configChange", changed);
  const button = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="settings-menu.tabs.view-config"]')!;
  await fireEvent.click(button);
  await tick();
  expect(document.querySelector("[data-local-settings-hint]")?.textContent).toContain("local-settings-hint");
  await fireEvent.change(document.querySelector(selector)!, { target: { value } });
  expect(changed).toHaveBeenCalledTimes(1);
  const result = changed.mock.calls[0]![0].detail as typeof config;
  expect(result.customBlockValue).toBe(42);
  expect(result.viewTabs[0]!.linkedViewId).toBeUndefined();
  expect(result.viewTabs[0]!.config).toEqual({ ...source.config, [key]: value });
  expect(result.viewTabs[0]!.filter).toEqual(source.filter);
  expect(result.viewTabs[0]!.sort).toEqual(source.sort);
  expect(result.viewTabs[1]).toBe(tabs[1]);
  expect(resolveTabView(result.viewTabs[1]!, [selectedSource]).config).toBe(source.config);
  expect(get(settings).projects[0]!.views[0]!.config).toEqual(source.config);
  expect(settings.updateViewConfig).not.toHaveBeenCalled();
  // Once saved/reloaded, the local tab no longer follows subsequent source edits.
  const reloaded = JSON.parse(JSON.stringify(result.viewTabs[0])) as ViewTab;
  expect(resolveTabView(reloaded, [{ ...selectedSource, config: { [key]: "changed" } }]).config[key]).toBe(value);
});

test("local forks deep-copy nested settings, filter and sort, retaining the narrowed record scope", () => {
  const config = { ...source.config, thumbnailLayout: "top" };
  const first = localTabWithConfig(linked("first"), [source], config);
  expect(first.config["custom"]).not.toBe(source.config.custom);
  expect(first.filter).not.toBe(source.filter);
  expect(first.sort).not.toBe(source.sort);
  const frame = { fields: [], records: [
    { id: "open", values: { status: "open", rank: 1 } },
    { id: "closed", values: { status: "done", rank: 2 } },
  ] } as DataFrame;
  expect(scopeTabFrame(frame, resolveTabView(first, [source]), false).frame.records.map(r => r.id)).toEqual(["open"]);
  expect(localTabWithConfig({ ...linked("missing"), linkedViewId: "gone" }, [], { color: "blue" }).linkedViewId).toBeUndefined();
});

test("the mobile block header opens its own calendar drawer without opening the host project", async () => {
  (isMobileDevice as import("svelte/store").Writable<boolean>).set(true);
  const project = { ...DEFAULT_PROJECT, id: "host", name: "Host" };
  const frame: DataFrame = { fields: [], records: [] };
  const key = "block:host:widget:calendar-tab";
  const rendered = render(DatabaseCallBlock, {
    project, frame, fields: [], api: {} as ViewApi, readonly: false, getRecordColor: () => null,
    widgetId: "widget", config: { viewTabs: [{ id: "calendar-tab", label: "Calendar", viewType: "calendar", config: {} }] },
  });
  try {
    const button = rendered.container.querySelector<HTMLButtonElement>("[data-embedded-agenda-toggle]")!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(button);
    expect(isOpenNow(key)).toBe(true);
    expect(isOpenNow(project.id)).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
  } finally { closeDrawer(key); }
});
