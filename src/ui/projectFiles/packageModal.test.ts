import { get } from "svelte/store";
type App = import("obsidian").App;
type Service = import("./packageService").ProjectPackageService;
type Prepared = import("src/lib/projectFiles/package").PreparedProjectPackage;

jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string) => key }) }));
jest.mock("src/lib/stores/settings", () => ({ settings: require("svelte/store").writable(require("src/settings/settings").DEFAULT_SETTINGS) }));
jest.mock("obsidian", () => {
  const document = globalThis.document;
  const pickers: unknown[] = [];
  class Modal {
    contentEl = document.createElement("div"); containerEl = { addClass() {} }; app: unknown;
    constructor(app: unknown) { this.app = app; }
    setTitle() {} onOpen() {} onClose() {}
    open() { document.body.append(this.contentEl); this.onOpen(); }
    close() { this.onClose(); this.contentEl.remove(); }
  }
  class FuzzySuggestModal extends Modal { constructor(app: unknown) { super(app); pickers.push(this); } }
  class Setting {
    controlEl = document.createElement("div");
    constructor(target: HTMLElement) { target.append(this.controlEl); }
    setName(value: string) { this.controlEl.dataset['name'] = value; return this; }
    setDesc(value: string) { this.controlEl.createEl("p", { text: value }); return this; }
    addButton(callback: (control: unknown) => void) {
      const button = document.createElement("button"); this.controlEl.append(button);
      const control = { setButtonText(value: string) { button.textContent = value; return control; }, setCta() { return control; }, setDisabled(value: boolean) { button.disabled = value; return control; }, onClick(fn: () => void) { button.addEventListener("click", fn); return control; } };
      callback(control); return this;
    }
  }
  return { Modal, FuzzySuggestModal, Setting, TFile: class {}, getAllTags: (cache: { tags: string[] }) => cache.tags, lastPicker: () => pickers.at(-1) };
});
const { ProjectPackageModal } = require("./packageModal") as typeof import("./packageModal");
const { settings } = require("src/lib/stores/settings") as typeof import("src/lib/stores/settings");
const { DEFAULT_PROJECT, DEFAULT_SETTINGS } = require("src/settings/settings") as typeof import("src/settings/settings");
const { lastPicker } = require("obsidian") as { lastPicker(): { onChooseItem(file: { path: string }): void; close(): void } };
const emptyBefore = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "empty");
let modal: InstanceType<typeof ProjectPackageModal>, prepare: jest.Mock, save: jest.Mock, dispose: jest.Mock, prepareShare: jest.Mock;
const capture = { manifest: { projects: [{ id: "p", name: "Project" }], dependencies: [{ reference: "missing", resolved: false }], files: [{ bytes: 3 }] } } as unknown as Prepared;
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const button = (name: string) => Array.from(modal.contentEl.querySelectorAll("button")).find(button => button.textContent === "project-package." + name)!;
beforeAll(() => Object.defineProperty(HTMLElement.prototype, "empty", { configurable: true, value: function(this: HTMLElement) { this.replaceChildren(); } }));
afterAll(() => { if (emptyBefore) Object.defineProperty(HTMLElement.prototype, "empty", emptyBefore); else Reflect.deleteProperty(HTMLElement.prototype, "empty"); });
beforeEach(() => {
  settings.set({ ...DEFAULT_SETTINGS, projects: [{ ...DEFAULT_PROJECT, id: "p", name: "Project" }, { ...DEFAULT_PROJECT, id: "q", name: "Other" }] });
  prepare = jest.fn(async () => capture); save = jest.fn(async () => ({ path: "Copies/Packages/template.zip" })); dispose = jest.fn();
  prepareShare = jest.fn(async () => ({ available: () => false, share: jest.fn() }));
  modal = new ProjectPackageModal({ vault: { getFiles: () => [] } } as unknown as App, { prepare, save, dispose, prepareShare, eligible: () => true } as unknown as Service);
  modal.open();
});
afterEach(() => { modal.close(); document.body.replaceChildren(); });

test("saving prepares Share but never sends automatically; only the direct Share click hands off bytes", async () => {
  const share = jest.fn(async () => "shared"); prepareShare.mockResolvedValueOnce({ available: () => true, share });
  button("preview").click(); await settle(); button("save").click();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(prepareShare).toHaveBeenCalled(); expect(share).not.toHaveBeenCalled();
  button("share").click(); expect(share).toHaveBeenCalledTimes(1); await settle();
  expect(modal.contentEl.textContent).toContain("project-package.shared");
});

test.each(["folder", "tag"])("selecting a %s adds its current group, excluding neighbours and protected files", async kind => {
  modal.close();
  const files = ["Work/A.md", "Work/sub/B.md", "Workshop/C.md", "Work/private.zip"].map(path => ({ path, extension: path.endsWith(".md") ? "md" : "zip" }));
  const app = { vault: { getFiles: () => files }, metadataCache: { getFileCache: (file: { path: string }) => ({ tags: file.path.startsWith("Work/") ? ["#work"] : ["#workshop"] }) } } as unknown as App;
  modal = new ProjectPackageModal(app, { prepare, save, dispose, prepareShare, eligible: (path: string) => !path.endsWith(".zip") } as unknown as Service, "q");
  modal.open();
  const select = modal.contentEl.querySelector("select")!; expect(select.value).toBe("q");
  Array.from(modal.contentEl.querySelectorAll("button")).find(button => button.textContent === "project-manager.include-" + kind)!.click();
  const picker = lastPicker() as unknown as { onChooseItem(value: string): void };
  files.push({ path: "Work/Late.md", extension: "md" });
  picker.onChooseItem(kind === "folder" ? "Work" : "#work");
  button("preview").click(); await settle();
  expect(prepare).toHaveBeenCalledWith("q", ["Work/A.md", "Work/sub/B.md", "Work/Late.md"]);
});

test("a project removed before opening is not silently replaced with another", () => {
  modal.close();
  modal = new ProjectPackageModal({} as App, { dispose } as unknown as Service, "removed"); modal.open();
  expect(modal.contentEl.querySelector('[role="alert"]')?.textContent).toBe("project-manager.project-missing");
  expect(modal.contentEl.querySelector("select")).toBeNull(); expect(prepare).not.toHaveBeenCalled();
});

test("saving requires explicit preview; selected files and missing dependencies are visible", async () => {
  expect(button("save").disabled).toBe(true);
  button("add-file").click(); lastPicker().onChooseItem({ path: "Notes/Visit.md" });
  expect(modal.contentEl.textContent).toContain("project-package.remove");
  button("preview").click(); await settle();
  expect(prepare).toHaveBeenCalledWith("p", ["Notes/Visit.md"]);
  expect(modal.contentEl.textContent).toContain("missing");
  expect(button("save").disabled).toBe(false);
  button("save").click(); await settle();
  expect(save).toHaveBeenCalledWith(capture);
  expect(modal.contentEl.textContent).toContain("project-package.saved");
});

test("removing a selected file or changing project invalidates the previous preview", async () => {
  button("add-file").click(); lastPicker().onChooseItem({ path: "Note.md" });
  button("preview").click(); await settle();
  button("remove").click(); expect(button("save").disabled).toBe(true);
  button("preview").click(); await settle();
  const select = modal.contentEl.querySelector("select")!; select.value = "q"; select.dispatchEvent(new Event("change"));
  expect(button("save").disabled).toBe(true);
  expect(save).not.toHaveBeenCalled();
});

test("pending work disables controls, closes cleanly and cannot publish after retirement", async () => {
  let finish!: (value: Prepared) => void;
  prepare.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  button("preview").click(); button("preview").click();
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(button("add-file").disabled).toBe(true);
  modal.close(); expect(dispose).toHaveBeenCalled();
  finish(capture); await settle();
  expect(modal.contentEl.childElementCount).toBe(0); expect(save).not.toHaveBeenCalled();
});

test("failed save requires a new preview and leaves the primary settings unchanged", async () => {
  const initial = get(settings);
  save.mockRejectedValueOnce(Error("read-back"));
  button("preview").click(); await settle(); button("save").click(); await settle();
  expect(button("save").disabled).toBe(true);
  expect(modal.contentEl.textContent).toContain("project-package.failed");
  expect(get(settings)).toBe(initial);
});
