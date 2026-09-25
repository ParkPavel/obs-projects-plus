// The settings tab offers only controls that something reads. "Link behavior"
// lost its last reader in v3.0.8 (aba5fbd); openRecord.ts fixes the decision
// that a click opens the note and there is no setting (#189).
//
// `obsidian` is mocked with a Setting that records what the tab renders, and
// the module under test is pulled in with require() after jest.mock(), as in
// dashboardWidgets.test.ts.

const mockRendered: string[] = [];

jest.mock("obsidian", () => {
  const chain = (): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) => (...args: unknown[]) => {
          if (prop === "addOption" && typeof args[0] === "string") mockRendered.push(`option:${args[0]}`);
          if (prop === "addOptions" && args[0] && typeof args[0] === "object") {
            for (const key of Object.keys(args[0] as object)) mockRendered.push(`option:${key}`);
          }
          return chain();
        },
      }
    );
  class Setting {
    constructor(_el: unknown) {}
    name = "";
    setName(name: string) { this.name = name; mockRendered.push(`name:${name}`); return this; }
    setDesc() { return this; }
    setHeading() { mockRendered.push(`heading:${this.name}`); return this; }
    addButton(cb: (mockControl: unknown) => void) { cb(chain()); return this; }
    addDropdown(cb: (mockControl: unknown) => void) { cb(chain()); return this; }
    addText(cb: (mockControl: unknown) => void) { cb(chain()); return this; }
    addToggle(cb: (mockControl: unknown) => void) { cb(chain()); return this; }
  }
  class PluginSettingTab {
    containerEl = { empty: () => undefined };
    plugin: unknown;
    constructor(_app: unknown, plugin: unknown) { this.plugin = plugin; }
  }
  return { Setting, PluginSettingTab, Platform: { isMacOS: false } };
});

// Every component the tab mounts, so a test can see which were destroyed.
const mockMounted: Array<{ $destroy: jest.Mock }> = [];
jest.mock("src/ui/settings/Projects.svelte", () =>
  jest.fn().mockImplementation(() => { const c = { $set: jest.fn(), $destroy: jest.fn() }; mockMounted.push(c); return c; }));
jest.mock("src/ui/settings/Archives.svelte", () =>
  jest.fn().mockImplementation(() => { const c = { $set: jest.fn(), $destroy: jest.fn() }; mockMounted.push(c); return c; }));

jest.mock("src/lib/stores/settings", () => {
  const { writable } = require("svelte/store");
  const { DEFAULT_SETTINGS } = require("src/settings/settings");
  return { settings: writable(DEFAULT_SETTINGS) };
});

const { ProjectsSettingTab } = require("src/ui/settings/settings");

function renderTab(): string[] {
  mockRendered.length = 0;
  const tab = new ProjectsSettingTab({}, { manifest: { version: "0.0.0" } });
  tab.display();
  return [...mockRendered];
}

describe("settings tab", () => {
  test("offers no Link behavior control", () => {
    const out = renderTab();
    expect(out.filter((r) => r.includes("link-behavior"))).toEqual([]);
    expect(out).not.toContain("option:open-editor");
    expect(out).not.toContain("option:open-note");
  });

  test("still renders the neighbouring general settings", () => {
    const out = renderTab();
    expect(out).toContain("name:settings.general.size-limit.name");
    expect(out).toContain("name:settings.general.start-of-week.name");
  });

  // Catalogue guideline: general settings first, without a heading, and no
  // top-level heading named after the plugin; "About" belongs at the end.
  test("opens with the general settings, not with a heading", () => {
    const out = renderTab();
    expect(out[0]).toBe("name:settings.general.size-limit.name");
  });

  test("the About section comes last, under one heading", () => {
    const out = renderTab();
    const headings = out.filter((r) => r.startsWith("heading:"));
    expect(headings[headings.length - 1]).toBe("heading:settings.about.title");
    expect(headings.filter((h) => h.startsWith("heading:settings.about."))).toEqual(["heading:settings.about.title"]);
    expect(out.indexOf("heading:settings.about.title")).toBeGreaterThan(out.indexOf("heading:settings.archives.name"));
  });

  test("redisplaying or hiding the tab destroys the components it mounted", () => {
    mockMounted.length = 0;
    const tab = new ProjectsSettingTab({}, { manifest: { version: "0.0.0" } });
    tab.display();
    const first = [...mockMounted];
    tab.display();
    expect(first.every((c) => c.$destroy.mock.calls.length === 1)).toBe(true);
    tab.hide();
    expect(mockMounted.every((c) => c.$destroy.mock.calls.length === 1)).toBe(true);
  });

  test.each(["en", "ru", "uk", "zh-CN"])("%s carries no link-behavior translation", (locale) => {
    const bundle = require(`src/lib/stores/translations/${locale}.json`);
    const general = bundle.translation?.settings?.general ?? {};
    expect(general).not.toHaveProperty("link-behavior");
  });
});
