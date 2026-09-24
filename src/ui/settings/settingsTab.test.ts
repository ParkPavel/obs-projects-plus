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
    setName(name: string) { mockRendered.push(`name:${name}`); return this; }
    setDesc() { return this; }
    setHeading() { return this; }
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

jest.mock("src/ui/settings/Projects.svelte", () => jest.fn().mockImplementation(() => ({ $set: jest.fn() })));
jest.mock("src/ui/settings/Archives.svelte", () => jest.fn().mockImplementation(() => ({ $set: jest.fn() })));

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

  test.each(["en", "ru", "uk", "zh-CN"])("%s carries no link-behavior translation", (locale) => {
    const bundle = require(`src/lib/stores/translations/${locale}.json`);
    const general = bundle.translation?.settings?.general ?? {};
    expect(general).not.toHaveProperty("link-behavior");
  });
});
