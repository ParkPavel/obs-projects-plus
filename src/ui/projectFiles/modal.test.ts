import { tick } from "svelte";
import { get, writable } from "svelte/store";
type Controller = import("./controller").ProjectFilesController;
type App = import("obsidian").App;
jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string) => key }) }));
jest.mock("src/lib/stores/settings", () => {
  const store = require("svelte/store").writable(require("src/settings/settings").DEFAULT_SETTINGS);
  return { settings: Object.assign(store, { updatePreferences: jest.fn((preferences: unknown) => store.update((value: object) => ({ ...value, preferences }))) }) };
});
jest.mock("src/ui/components/fields/TextField.svelte", () => ({ __esModule: true, default: jest.requireActual("src/ui/components/fields/TextField.svelte").default }));
jest.mock("obsidian", () => {
  const document = globalThis.document;
  class Modal {
    containerEl = { addClass() {} };
    contentEl = document.createElement("div");
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    setTitle() {} onOpen() {} onClose() {}
    open() { document.body.append(this.contentEl);this.onOpen(); }
    close() { this.onClose();this.contentEl.remove(); }
  }
  class Setting {
    controlEl = document.createElement("div");
    constructor(target: HTMLElement) { target.append(this.controlEl); }
    setName() { return this; } setDesc() { return this; }
    addToggle(callback: (value: unknown) => void) {
      const input = document.createElement("input");input.type = "checkbox";this.controlEl.append(input);
      const control = { setValue(value: boolean) { input.checked = value;return control; }, onChange(fn: (value: boolean) => void) { input.addEventListener("change", () => fn(input.checked));return control; } };
      callback(control);return this;
    }
    addButton(callback: (value: unknown) => void) {
      const button = document.createElement("button");this.controlEl.append(button);
      const control = { setButtonText(value: string) { button.textContent = value;return control; }, setCta() { return control; }, setDisabled(value: boolean) { button.disabled = value;return control; }, onClick(fn: () => void) { button.addEventListener("click", fn);return control; } };
      callback(control);return this;
    }
  }
  return { Modal, Setting, TFile: class {}, Platform: { isMacOS: false } };
});
const { ProjectFilesModal } = require("./modal") as typeof import("./modal");
const { settings } = require("src/lib/stores/settings") as typeof import("src/lib/stores/settings");
const { DEFAULT_SETTINGS } = require("src/settings/settings") as typeof import("src/settings/settings");
let modal: InstanceType<typeof ProjectFilesModal>;
let run: jest.Mock;
let status: import("svelte/store").Writable<import("./controller").ProjectFilesStatus>;
const settle = async () => { await tick();await tick(); };
const button = () => modal.contentEl.querySelector("button")!;
const input = () => modal.contentEl.querySelector("input:not([type=checkbox])") as HTMLInputElement;
const emptyDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "empty");
beforeAll(() => Object.defineProperty(HTMLElement.prototype, "empty", { configurable: true, value: function(this: HTMLElement) { this.replaceChildren(); } }));
afterAll(() => { if (emptyDescriptor) Object.defineProperty(HTMLElement.prototype, "empty", emptyDescriptor);else Reflect.deleteProperty(HTMLElement.prototype, "empty"); });
beforeEach(() => {
  settings.set(DEFAULT_SETTINGS);jest.mocked(settings.updatePreferences).mockClear();
  status = writable({ kind: "idle" });run = jest.fn(async () => undefined);
  modal = new ProjectFilesModal({ vault: { configDir: "Application config" } } as unknown as App, { status, runWithNotice: run } as unknown as Controller);
  modal.open();
});
afterEach(() => { modal.close();document.body.replaceChildren(); });

test("unchanged default folder still starts a verified copy and persists opt-in destination", async () => {
  button().click();await settle();
  expect(run).toHaveBeenCalledTimes(1);
  expect(get(settings).preferences.projectFiles).toEqual({ root: "Projects Plus", autoSync: false });
});
test("explicit action submits the actual field draft once with its original IME lifecycle", async () => {
  const field = input();field.focus();field.value = "Работа/Копии";field.dispatchEvent(new Event("input", { bubbles: true }));await settle();
  button().click();await settle();
  expect(get(settings).preferences.projectFiles?.root).toBe("Работа/Копии");
  expect(settings.updatePreferences).toHaveBeenCalledTimes(1);expect(run).toHaveBeenCalledTimes(1);
});
test("active composition and an unsafe folder cannot start a copy", async () => {
  const field = input();field.focus();field.dispatchEvent(new CompositionEvent("compositionstart"));
  field.value = "Копии";field.dispatchEvent(new Event("input", { bubbles: true }));await settle();
  button().click();await settle();expect(run).not.toHaveBeenCalled();
  field.dispatchEvent(new CompositionEvent("compositionend"));await settle();
  field.value = "Work/../Other";field.dispatchEvent(new Event("input", { bubbles: true }));await settle();
  button().click();await settle();expect(run).not.toHaveBeenCalled();expect(settings.updatePreferences).not.toHaveBeenCalled();
});
test("copying disables repeated actions, and closing retires the status subscription", async () => {
  status.set({ kind: "copying" });expect(button().disabled).toBe(true);
  button().click();await settle();expect(run).not.toHaveBeenCalled();
  modal.close();status.set({ kind: "failed" });expect(modal.contentEl.childElementCount).toBe(0);
});
