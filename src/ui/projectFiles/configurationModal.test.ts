export {};
type App = import("obsidian").App;
type Service = import("./configurationService").ProjectConfigurationService;
type Preview = import("./configurationService").ConfigurationApplyPreview;
jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string) => key }) }));
jest.mock("src/lib/stores/settings", () => ({ settings: require("svelte/store").writable(require("src/settings/settings").DEFAULT_SETTINGS) }));
jest.mock("obsidian", () => {
  const document = globalThis.document, pickers: unknown[] = [];
  class Modal {
    contentEl = document.createElement("div"); containerEl = { addClass() {} }; app: unknown;
    constructor(app: unknown) { this.app = app; } setTitle() {} onOpen() {} onClose() {}
    open() { document.body.append(this.contentEl); this.onOpen(); } close() { this.onClose(); this.contentEl.remove(); }
  }
  class FuzzySuggestModal extends Modal { constructor(app: unknown) { super(app); pickers.push(this); } }
  class Setting {
    controlEl = document.createElement("div"); constructor(target: HTMLElement) { target.append(this.controlEl); }
    addButton(callback: (control: unknown) => void) {
      const button = document.createElement("button"); this.controlEl.append(button);
      const control = { setButtonText(value: string) { button.textContent = value; return control; }, setCta() { return control; }, setDisabled(value: boolean) { button.disabled = value; return control; }, onClick(fn: () => void) { button.addEventListener("click", fn); return control; } };
      callback(control); return this;
    }
  }
  return { Modal, FuzzySuggestModal, Setting, lastPicker: () => pickers.at(-1) };
});
const { ProjectConfigurationModal } = require("./configurationModal") as typeof import("./configurationModal");
const { lastPicker } = require("obsidian") as { lastPicker(): { onChooseItem(file: { path: string }): void } };
const empty = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "empty");
beforeAll(() => Object.defineProperty(HTMLElement.prototype, "empty", { configurable: true, value: function(this: HTMLElement) { this.replaceChildren(); } }));
afterAll(() => { if (empty) Object.defineProperty(HTMLElement.prototype, "empty", empty); else Reflect.deleteProperty(HTMLElement.prototype, "empty"); });
let modal: InstanceType<typeof ProjectConfigurationModal>, preview: jest.Mock, apply: jest.Mock, dispose: jest.Mock;
const value: Preview = { path: "Project/config.json", mode: "draft", projectId: "p", name: "Project", sourceHash: "a".repeat(64), settingsRevision: "b".repeat(64), changes: Array.from({ length: 23 }, (_, i) => ({ location: ["field" + i], before: "old", after: "<img src=x onerror=alert(1)>" })) };
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const button = (key: string) => Array.from(modal.contentEl.querySelectorAll("button")).find(item => item.textContent === key)!;
beforeEach(() => {
  preview = jest.fn(async () => value); apply = jest.fn(async () => ({ backup: "Copies/Backups/old.md", copyUpdated: true })); dispose = jest.fn();
  modal = new ProjectConfigurationModal({ vault: { getFiles: () => [] }, workspace: { openLinkText: jest.fn() } } as unknown as App, { preview, apply, dispose, eligible: () => true } as unknown as Service, "draft"); modal.open();
});
afterEach(() => { modal.close(); document.body.replaceChildren(); });
test("read-only diff is paginated and text-safe; only explicit Apply submits the captured revision", async () => {
  expect(button("project-configuration.apply").disabled).toBe(true);
  button("project-configuration.choose").click(); lastPicker().onChooseItem({ path: value.path }); await settle();
  expect(preview).toHaveBeenCalledWith(value.path, "draft"); expect(apply).not.toHaveBeenCalled(); expect(modal.contentEl.querySelector("img")).toBeNull();
  expect(modal.contentEl.querySelectorAll("li")).toHaveLength(20);
  button("package-inspect.binding-next").click(); expect(modal.contentEl.querySelectorAll("li")).toHaveLength(3);
  button("project-configuration.apply").click(); await settle(); expect(apply).toHaveBeenCalledWith(value); expect(modal.contentEl.textContent).toContain("project-configuration.applied");
});
test("closing retires pending inspection and suppresses late activation controls", async () => {
  let finish!: (value: Preview) => void; preview.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  button("project-configuration.choose").click(); lastPicker().onChooseItem({ path: value.path }); modal.close(); finish(value); await settle();
  expect(dispose).toHaveBeenCalled(); expect(modal.contentEl.childElementCount).toBe(0); expect(apply).not.toHaveBeenCalled();
});
