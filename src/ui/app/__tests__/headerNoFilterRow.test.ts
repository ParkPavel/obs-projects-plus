/**
 * chrome-filters — the view header carries no filter row, no filter button
 * and no filter popup; filtering lives in the settings Filters tab
 * (filtersTab.test.ts). What the header still owes the views is measured, not
 * assumed: App keeps measuring the room below the navbar and publishing it as
 * `--ppp-below-nav-h` (ios-l1), which the short-landscape bottom sheet reads.
 *
 * Two halves. The source half pins what the removal took away and what it had
 * to keep. The mounted half renders the real App shell — header, main area,
 * overlay layer — with the heavy view tree replaced by inert stand-ins (the
 * view content is not what this test is about), and reads the DOM.
 */

import "@testing-library/jest-dom";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { tick } from "svelte";

jest.mock("obsidian-dataview", () => ({ getAPI: () => undefined, isPluginEnabled: () => false }), { virtual: true });
jest.mock("src/ui/app/View.svelte", () => ({
  __esModule: true,
  default: jest.requireActual("src/__mocks__/obsidian-svelte.js").Icon,
}));
jest.mock("src/ui/app/DataFrameProvider.svelte", () => ({
  __esModule: true,
  default: jest.requireActual("src/__mocks__/obsidian-svelte.js").Icon,
}));
jest.mock("src/ui/app/ProjectsEmptyState.svelte", () => ({
  __esModule: true,
  default: jest.requireActual("src/__mocks__/obsidian-svelte.js").Icon,
}));
jest.mock("src/ui/app/onboarding/onboardingModal", () => ({
  OnboardingModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));
jest.mock("src/ui/app/onboarding/demoRun", () => ({
  createDemoWithNotices: jest.fn(() => Promise.resolve(null)),
}));

type Mounted = { $destroy(): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const SRC = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const APP = read("ui/app/App.svelte");
const NAVBAR = read("ui/components/Navigation/CompactNavBar.svelte");

describe("chrome-filters — the header filter row is gone (source)", () => {
  it("App renders no filter row, navbar filter button or filter popup", () => {
    expect(APP).not.toMatch(/ViewFilterBar/);
    expect(APP).not.toMatch(/ppp-nav-filter/);
    expect(APP).not.toMatch(/slot="filter"/);
    expect(APP).not.toMatch(/filterOpen|filterTriggerEl|activeFilterCount|handleViewFilterPillsChange/);
  });

  it("no orphan style for the removed row or button is left in App", () => {
    const style = APP.slice(APP.indexOf("<style"));
    expect(style).not.toMatch(/ppp-viewfilter|ppp-nav-filter|ppp-filterpills/);
  });

  it("the navbar has no filter slot any more", () => {
    expect(NAVBAR).not.toMatch(/<slot name="filter"/);
  });

  it("nothing outside the deleted files still imports the view filter bar", () => {
    const importers = ["ui/app/App.svelte", "ui/views/Dashboard/FilterBridge.svelte", "ui/components/FilterPills/FilterPills.svelte"]
      .filter((rel) => /import[^;]*ViewFilterBar/.test(read(rel)));
    expect(importers).toEqual([]);
  });

  it("the dashboard block filter keeps its shared pills", () => {
    expect(existsSync(join(SRC, "ui/components/FilterPills/FilterPills.svelte"))).toBe(true);
  });

  it("App still measures the room below the navbar and publishes it", () => {
    expect(APP).toMatch(/style:--ppp-below-nav-h=\{belowNav\}/);
    expect(APP).toMatch(/function measureBelowNav\(\)/);
    expect(APP).toMatch(/new ResizeObserver\(measureBelowNav\)/);
    // The view still fills what is left of the main column.
    expect(APP).toMatch(/class="ppp-view-fill"/);
    expect(APP.slice(APP.indexOf("<style"))).toMatch(/\.ppp-view-fill\s*\{[^}]*flex:\s*1 1 0/);
  });

  it("Save as source is reached through the settings panel", () => {
    expect(APP).toMatch(/on:saveFilterAsSource=\{\(event\) => handleSaveFilterAsSource\(event\.detail\)\}/);
    expect(APP).toMatch(/readonly=\{sourceReadonly\}/);
    expect(APP).toMatch(/sources=\{projectSources\}/);
    // The duplicate-name refusal keeps its code.
    expect(APP).toMatch(/SOURCE_NAME_TAKEN = "PPP-701"/);
  });
});

describe("chrome-filters — the header filter row is gone (mounted)", () => {
  const { app } = require("src/lib/stores/obsidian") as { app: { set(value: unknown): void } };
  const App = require("../App.svelte").default as ComponentClass;
  const originalHeight = window.innerHeight;

  function setHeight(h: number) {
    Object.defineProperty(window, "innerHeight", { value: h, configurable: true, writable: true });
  }

  beforeAll(() => {
    app.set({ vault: { on: () => ({}), offref: () => undefined } });
    (globalThis as unknown as { activeDocument: Document }).activeDocument = document;
  });

  afterEach(() => {
    setHeight(originalHeight);
    document.body.innerHTML = "";
  });

  function mount() {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const component = new App({ target, props: { projectId: undefined, viewId: undefined } });
    return {
      target,
      container: () => target.querySelector<HTMLElement>(".projects-container") as HTMLElement,
      destroy() {
        component.$destroy();
        target.remove();
      },
    };
  }

  it("renders the navbar with no filter button and no filter row anywhere", () => {
    const m = mount();
    expect(m.target.querySelector(".compact-navbar")).not.toBeNull();
    expect(m.target.querySelector(".ppp-nav-filter")).toBeNull();
    expect(m.target.querySelector(".ppp-viewfilter")).toBeNull();
    expect(m.target.querySelector(".ppp-filterpills")).toBeNull();
    // The shell keeps its two rows and the overlay layer.
    expect(m.target.querySelector(".projects-main")).not.toBeNull();
    expect(m.target.querySelector(".ppp-app-overlay")).not.toBeNull();
    m.destroy();
  });

  it("measures the room below the navbar and publishes it in rem", async () => {
    setHeight(640);
    const m = mount();
    await tick();
    // jsdom lays nothing out, so the main area's top is 0: the room is the window.
    expect(m.container().style.getPropertyValue("--ppp-below-nav-h")).toBe("40rem");

    setHeight(480);
    window.dispatchEvent(new Event("resize"));
    await tick();
    expect(m.container().style.getPropertyValue("--ppp-below-nav-h")).toBe("30rem");
    m.destroy();
  });
});
