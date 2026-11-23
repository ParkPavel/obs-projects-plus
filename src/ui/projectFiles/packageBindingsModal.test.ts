type App = import("obsidian").App;
type Preview = import("./packageService").PackageDestinationPreview;
import { configPathChoiceKey } from "src/lib/projectFiles/packagePathBindings";

jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string) => key }) }));
jest.mock("obsidian", () => {
  const document = globalThis.document, pickers: unknown[] = [];
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
    setName(value: string) { this.controlEl.setAttribute("aria-label", value); return this; }
    setDesc(value: string | DocumentFragment) { const desc = document.createElement("p"); if (typeof value === "string") desc.textContent = value; else desc.append(value); this.controlEl.append(desc); return this; }
    addButton(callback: (control: unknown) => void) {
      const button = document.createElement("button"); this.controlEl.append(button);
      const control = { buttonEl: button, setCta() { return control; }, setButtonText(value: string) { button.textContent = value; return control; }, setDisabled(value: boolean) { button.disabled = value; return control; }, onClick(fn: () => void) { button.addEventListener("click", fn); return control; } };
      callback(control); return this;
    }
  }
  return { Modal, FuzzySuggestModal, Setting, lastPicker: () => pickers.at(-1) };
});
const { ProjectPackageBindingsModal } = require("./packageBindingsModal") as typeof import("./packageBindingsModal");
type Target = import("src/lib/projectFiles/packagePathBindings").ConfigBindingTarget;
const { lastPicker } = require("obsidian") as { lastPicker(): { getItems(): Target[]; getItemText(target: Target): string; onChooseItem(target: Target): void; close(): void } };
const savedEmpty = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "empty"), savedWin = Object.getOwnPropertyDescriptor(Document.prototype, "win");
const savedFragment = Object.getOwnPropertyDescriptor(window, "createFragment"), savedEl = Object.getOwnPropertyDescriptor(window, "createEl");
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "empty", { configurable: true, value: function(this: HTMLElement) { this.replaceChildren(); } });
  Object.defineProperty(Document.prototype, "win", { configurable: true, get: function(this: Document) { return this.defaultView; } });
  Object.defineProperty(window, "createFragment", { configurable: true, value: () => document.createDocumentFragment() });
  Object.defineProperty(window, "createEl", { configurable: true, value: (tag: string) => document.createElement(tag) });
});
afterAll(() => {
  for (const [owner, key, saved] of [[HTMLElement.prototype, "empty", savedEmpty], [Document.prototype, "win", savedWin], [window, "createFragment", savedFragment], [window, "createEl", savedEl]] as const) {
    if (saved) Object.defineProperty(owner, key, saved); else Reflect.deleteProperty(owner, key);
  }
});
const preview = (): Preview => ({ root: "Imported", configuration: {
  projects: [{ project: { id: "p", name: "<img src=x onerror=alert(1)>" }, archived: false }], choices: [],
  targets: [{ path: "Local/t.md", kind: "file", origin: "existing" }, { path: "Imported/a.md", kind: "file", origin: "planned" }, { path: "Imported", kind: "folder", origin: "planned" }],
  bindings: Array.from({ length: 14 }, (_, i) => ({ projectId: "p", location: ["templates", i], source: `Missing/${i}.md`, kind: "file", purpose: "template", context: "", mode: "missing", defaultMode: "missing" })),
} }) as unknown as Preview;
let modal: InstanceType<typeof ProjectPackageBindingsModal>, submit: jest.Mock;
const buttons = (key: string) => Array.from(modal.contentEl.querySelectorAll("button")).filter(button => button.textContent === "package-inspect." + key);
beforeEach(() => { submit = jest.fn(); modal = new ProjectPackageBindingsModal({} as App, preview(), submit); modal.open(); });
afterEach(() => { modal.close(); document.body.replaceChildren(); });

test("all bindings are reachable through stable native pagination", () => {
  expect(buttons("binding-choose-file")).toHaveLength(12); expect(buttons("binding-previous")[0]!.disabled).toBe(true);
  const next = buttons("binding-next")[0]!; next.click();
  expect(buttons("binding-choose-file")).toHaveLength(2); expect(modal.contentEl.textContent).toContain("Missing/12.md");
  expect(modal.contentEl.textContent).not.toContain("Missing/0.md");
  expect(buttons("binding-next")[0]).toBe(next); expect(next.disabled).toBe(true);
  buttons("binding-previous")[0]!.click(); expect(modal.contentEl.textContent).toContain("Missing/0.md");
});

test("native picker is kind-filtered and explicit intent is submitted only on recheck", async () => {
  buttons("binding-choose-file")[0]!.click(); const picker = lastPicker();
  expect(picker.getItems().every(target => target.kind === "file")).toBe(true);
  const planned = picker.getItems().find(target => target.origin === "planned")!;
  expect(picker.getItemText(planned)).toContain("package-inspect.binding-planned");
  picker.onChooseItem(picker.getItems()[0]!); picker.close(); await Promise.resolve();
  expect(submit).not.toHaveBeenCalled(); expect(modal.contentEl.textContent).toContain("Local/t.md");
  expect(modal.contentEl.querySelector("img")).toBeNull(); expect(modal.contentEl.querySelector("wbr")).not.toBeNull();
  buttons("binding-recheck")[0]!.click();
  expect(submit).toHaveBeenCalledWith([expect.objectContaining({ projectId: "p", location: ["templates", 0], root: "Imported", source: "Missing/0.md", target: "Local/t.md", kind: "file", origin: "existing" })]);
});

test("reset restores package default rather than displaying an earlier explicit target", () => {
  modal.close(); const p = preview(), choice = { projectId: "p", location: ["templates", 0], root: "Imported", source: "Missing/0.md", target: "Local/t.md", kind: "file" as const, origin: "existing" as const };
  const changed = { ...p, configuration: { ...p.configuration, choices: [choice], bindings: [{ ...p.configuration.bindings[0]!, mode: "explicit" as const, target: choice.target, origin: choice.origin, defaultMode: "selected" as const, defaultTarget: "Imported/a.md" }] } };
  modal = new ProjectPackageBindingsModal({} as App, changed, submit); modal.open();
  expect(modal.contentEl.textContent).toContain("package-inspect.binding-verified");
  buttons("binding-default")[0]!.click();
  expect(modal.contentEl.textContent).toContain("Imported/a.md"); expect(modal.contentEl.textContent).not.toContain("Local/t.md");
  buttons("binding-recheck")[0]!.click(); expect(submit).toHaveBeenCalledWith([]);
});

test("closing discards local edits and prevents late picker or detached-button callbacks", () => {
  buttons("binding-choose-file")[0]!.click(); const picker = lastPicker(), detached = buttons("binding-recheck")[0]!;
  modal.close(); picker.onChooseItem(picker.getItems()[0]!); detached.click();
  expect(submit).not.toHaveBeenCalled(); expect(modal.contentEl.childElementCount).toBe(0);
});

test("reset-all clears stale choices that no longer correspond to visible fields", () => {
  modal.close(); const p = preview();
  const stale = { projectId: "p", location: ["unknown"], root: "Imported", source: "old", target: "Local/t.md", kind: "file" as const, origin: "existing" as const };
  expect(configPathChoiceKey(stale.projectId, stale.location)).not.toBe(configPathChoiceKey("p", ["templates", 0]));
  modal = new ProjectPackageBindingsModal({} as App, { ...p, configuration: { ...p.configuration, choices: [stale] } }, submit); modal.open();
  buttons("binding-reset-all")[0]!.click(); buttons("binding-recheck")[0]!.click();
  expect(submit).toHaveBeenCalledWith([]);
});
