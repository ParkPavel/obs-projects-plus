import "@testing-library/jest-dom";
import { tick } from "svelte";
import { get } from "svelte/store";
import { enter, optionRows, tap } from "src/ui/components/fields/__tests__/support/comboKit";
type StoredSettings = import("src/settings/settings").LatestProjectsPluginSettings;
jest.mock("obsidian", () => {
  const document = globalThis.document;
  class Setting {
    controlEl: HTMLElement;
    row: HTMLElement;
    constructor(target: HTMLElement) { this.row = document.createElement("div"); this.row.className = "setting-item"; this.controlEl = document.createElement("div"); this.controlEl.className = "setting-item-control"; this.row.append(this.controlEl); target.append(this.row); }
    setName(name: string) { this.row.dataset["name"] = name; return this; }
    setDesc() { return this; } setHeading() { return this; }
    addText(callback: (control: unknown) => void) {
      const input = document.createElement("input"); this.controlEl.append(input);
      const control = { setValue(value: string) { input.value = value; return control; }, setPlaceholder(value: string) { input.placeholder = value; return control; }, onChange(write: (value: string) => void) { input.addEventListener("input", () => write(input.value)); return control; } };
      callback(control); return this;
    }
    addDropdown(callback: (control: unknown) => void) {
      const input = document.createElement("select"); this.controlEl.append(input);
      const control = { addOption(value: string, label: string) { const option = document.createElement("option"); option.value = value; option.textContent = label; input.append(option); return control; }, setValue(value: string) { input.value = value; return control; }, onChange(write: (value: string) => void) { input.addEventListener("change", () => write(input.value)); return control; } };
      callback(control); return this;
    }
    addToggle(callback: (control: unknown) => void) { const control = { setValue() { return control; }, onChange() { return control; } }; callback(control); return this; }
    addButton(callback: (control: unknown) => void) { const control = { setButtonText() { return control; }, setCta() { return control; }, onClick() { return control; } }; callback(control); return this; }
  }
  class PluginSettingTab {
    containerEl = Object.assign(document.createElement("div"), { empty(this: HTMLElement) { this.replaceChildren(); } });
    constructor() { document.body.appendChild(this.containerEl); }
  }
  return { ...jest.requireActual("src/__mocks__/obsidian"), Setting, PluginSettingTab };
});
jest.mock("src/ui/settings/Projects.svelte", () => jest.fn().mockImplementation(() => ({ $set() {}, $destroy() {} })));
jest.mock("src/ui/settings/Archives.svelte", () => jest.fn().mockImplementation(() => ({ $set() {}, $destroy() {} })));
// Preserve the real compiled components across TS→Svelte default import interop.
jest.mock("src/ui/components/fields/NumberField.svelte", () => ({ __esModule: true, default: jest.requireActual("src/ui/components/fields/NumberField.svelte").default }));
jest.mock("src/ui/components/fields/SelectField.svelte", () => ({ __esModule: true, default: jest.requireActual("src/ui/components/fields/SelectField.svelte").default }));
jest.mock("src/lib/stores/i18n", () => { const { writable } = require("svelte/store"); return { i18n: writable({ t: (key: string) => key }) }; });
jest.mock("src/lib/stores/settings", () => {
  const { writable } = require("svelte/store"), { DEFAULT_SETTINGS } = require("src/settings/settings");
  const store = writable(DEFAULT_SETTINGS);
  return { settings: Object.assign(store, { updatePreferences: jest.fn((preferences: unknown) => store.update((current: object) => ({ ...current, preferences }))) }) };
});
const { settings } = require("src/lib/stores/settings");
const { DEFAULT_SETTINGS } = require("src/settings/settings");
const { ProjectsSettingTab } = require("./settings");
const flush = async () => { await tick(); await tick(); await tick(); };
let tab: InstanceType<typeof ProjectsSettingTab>;
beforeEach(() => { settings.set(DEFAULT_SETTINGS); settings.updatePreferences.mockClear(); tab = new ProjectsSettingTab({}, { manifest: { version: "3.7.2" } }); tab.display(); });
afterEach(() => { tab.hide(); document.body.replaceChildren(); });
const limit = () => tab.containerEl.querySelector('[data-name="settings.general.size-limit.name"] input') as HTMLInputElement;
const type = async (input: HTMLInputElement, text: string) => { input.value = text; input.dispatchEvent(new Event("input", { bubbles: true })); await flush(); };

test("all four platform choices use the shared original-input selector", () => {
  expect(tab.containerEl.querySelectorAll(".ppp-option-field input[role=combobox]")).toHaveLength(4);
  expect(tab.containerEl.querySelectorAll("select")).toHaveLength(0);
});
test("an invalid/incomplete size draft cannot truncate or reset the preference, a valid commit saves once", async () => {
  const input = limit(); input.focus(); await type(input, "25bad"); input.blur(); await flush();
  expect(settings.updatePreferences).not.toHaveBeenCalled();
  input.focus(); await type(input, "-"); input.blur(); await flush(); expect(settings.updatePreferences).not.toHaveBeenCalled();
  input.focus(); await type(input, "500"); input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); input.blur(); await flush();
  expect(settings.updatePreferences).toHaveBeenCalledTimes(1); expect((get(settings) as StoredSettings).preferences.projectSizeLimit).toBe(500);
});
test("a translated first-day label saves only its canonical code and keeps the same input", async () => {
  const input = tab.containerEl.querySelector('[data-name="settings.general.start-of-week.name"] input') as HTMLInputElement;
  expect(input).not.toBeNull(); await enter(input); await flush();
  const option = optionRows().find(row => row.textContent === "settings.general.start-of-week.options.sunday");
  expect(option).toBeDefined(); tap(option!); await flush(); input.blur(); await flush();
  expect(settings.updatePreferences).toHaveBeenCalledTimes(1); expect((get(settings) as StoredSettings).preferences.locale.firstDayOfWeek).toBe("sunday");
  expect(tab.containerEl.querySelector('[data-name="settings.general.start-of-week.name"] input')).toBe(input);
});
test("hidden controls cannot write their retired preference snapshot", async () => {
  const input = limit(); tab.hide(); settings.updatePreferences.mockClear();
  await type(input, "900"); input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await flush();
  expect(settings.updatePreferences).not.toHaveBeenCalled();
});
test("an external preference refresh updates an untouched common input without writing", async () => {
  const current = get(settings) as StoredSettings;
  settings.set({ ...current, preferences: { ...current.preferences, projectSizeLimit: 1200 } }); await flush();
  expect(limit().value).toBe("1200"); expect(settings.updatePreferences).not.toHaveBeenCalled();
});
test("a size commit preserves a different preference changed externally while the tab was open", async () => {
  const current = get(settings) as StoredSettings;
  settings.set({ ...current, preferences: { ...current.preferences, animationBehavior: "instant" } });
  const input = limit(); input.focus(); await type(input, "500"); input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await flush();
  expect((get(settings) as StoredSettings).preferences.animationBehavior).toBe("instant");
});
