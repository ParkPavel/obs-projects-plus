import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import { ProjectView } from "src/customViewApi";
import { customViews } from "src/lib/stores/customViews";
import { settings } from "src/lib/stores/settings";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS, DEFAULT_VIEW } from "src/settings/settings";
import View from "../View.svelte";

type OpenProps = import("src/customViewApi").ProjectViewProps;
type ViewApi = import("src/lib/viewApi").ViewApi;
jest.mock("src/ui/components/RecordCardView/RecordCardView.svelte", () => require("src/ui/components/EmptyState/EmptyState.svelte"));

class ProbeView extends ProjectView {
  opened: OpenProps[] = [];
  onOpen(props: OpenProps) { this.opened.push(props); }
  getViewType() { return "probe"; }
  getDisplayName() { return "Probe"; }
  getIcon() { return "file"; }
}

beforeEach(() => {
  jest.useFakeTimers();
  if (!HTMLElement.prototype.empty) HTMLElement.prototype.empty = function() { this.replaceChildren(); };
});
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); });

function fixture() {
  const first = { ...DEFAULT_VIEW, id: "first-view", name: "First view", type: "probe", config: { original: true } };
  const second = { ...DEFAULT_VIEW, id: "second-view", name: "Second view", type: "probe", config: { untouched: true } };
  const p1 = { ...DEFAULT_PROJECT, id: "first-project", name: "First", views: [first] };
  const p2 = { ...DEFAULT_PROJECT, id: "second-project", name: "Second", views: [second] };
  settings.set({ ...DEFAULT_SETTINGS, projects: [p1,p2] });
  const probe = new ProbeView(); customViews.set({ probe });
  const save = jest.fn((project: string, view: string, config: Record<string,unknown>) => settings.updateViewConfig(project,view,config));
  const rendered = render(View, { project: p1, view: first, frame: { fields: [], records: [] }, readonly: false, api: {} as ViewApi, onConfigChange: save });
  return { rendered, probe, save, first, second, p1, p2 };
}

test("an old view's deferred config reaches its original project/view after a project switch", async () => {
  const f = fixture(); await tick();
  const original = f.probe.opened[0]!;
  setTimeout(() => original.saveConfig({ interval: "week" }),0);
  await f.rendered.component.$set({ project: f.p2, view: f.second }); await tick();
  jest.advanceTimersByTime(1);
  expect(f.save).toHaveBeenCalledWith(f.p1.id,f.first.id,{ interval: "week" });
  expect(get(settings).projects.find(p=>p.id===f.p2.id)!.views[0]!.config).toEqual({ untouched: true });
});

test("an old view's filter keeps original ownership and the latest unrelated settings", async () => {
  const f = fixture(); await tick();
  const original = f.probe.opened[0]!;
  await f.rendered.component.$set({ project: f.p2, view: f.second }); await tick();
  settings.updateViewConfig(f.p1.id,f.first.id,{ latest: 7 });
  const filter = { conjunction: "or" as const, conditions: [] };
  original.saveViewFilter!(filter);
  const first = get(settings).projects.find(p=>p.id===f.p1.id)!.views[0]!;
  expect(first.filter).toEqual(filter);
  expect(first.config).toEqual({ latest: 7 });
  expect(get(settings).projects.find(p=>p.id===f.p2.id)!.views[0]!.filter).toEqual(f.second.filter);
});

test("a deferred filter ignores an original view deleted after navigation", async () => {
  const f = fixture(); await tick();
  const original = f.probe.opened[0]!;
  await f.rendered.component.$set({ project: f.p2, view: f.second }); await tick();
  settings.updateProject({ ...f.p1, views: [] });
  expect(()=>original.saveViewFilter!({ conjunction: "or", conditions: [] })).not.toThrow();
  expect(get(settings).projects.find(p=>p.id===f.p1.id)!.views).toEqual([]);
  expect(get(settings).projects.find(p=>p.id===f.p2.id)!.views[0]!.filter).toEqual(f.second.filter);
});
