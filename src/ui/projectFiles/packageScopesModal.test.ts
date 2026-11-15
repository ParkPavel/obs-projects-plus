type App = import("obsidian").App;
type Preview = import("./packageService").PackageDestinationPreview;
jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string) => key }) }));
jest.mock("obsidian", () => {
  const document = globalThis.document;
  class Modal {
    contentEl = document.createElement("div"); containerEl = { addClass() {} }; app: unknown;
    constructor(app: unknown) { this.app = app; }
    setTitle() {} onOpen() {} onClose() {}
    open() { document.body.append(this.contentEl); this.onOpen(); }
    close() { this.onClose(); this.contentEl.remove(); }
  }
  class Setting {
    controlEl = document.createElement("div"); desc = document.createElement("p");
    constructor(target: HTMLElement) { target.append(this.controlEl); this.controlEl.append(this.desc); }
    setName(value: string) { this.controlEl.setAttribute("aria-label", value); return this; }
    setDesc(value: DocumentFragment) { this.desc.replaceChildren(value); return this; }
    addToggle(callback: (control: unknown) => void) {
      const input = document.createElement("input"); input.type = "checkbox"; this.controlEl.append(input);
      const control = { toggleEl: input, setValue(value: boolean) { input.checked = value; return control; }, setDisabled(value: boolean) { input.disabled = value; return control; }, onChange(fn: (value: boolean) => void) { input.addEventListener("change", () => fn(input.checked)); return control; } };
      callback(control); return this;
    }
    addButton(callback: (control: unknown) => void) {
      const button = document.createElement("button"); this.controlEl.append(button);
      const control = { setCta() { return control; }, setButtonText(value: string) { button.textContent = value; return control; }, setDisabled(value: boolean) { button.disabled = value; return control; }, onClick(fn: () => void) { button.addEventListener("click", fn); return control; } };
      callback(control); return this;
    }
  }
  return { Modal, Setting };
});
const { ProjectPackageScopesModal } = require("./packageScopesModal") as typeof import("./packageScopesModal");
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
const preview = (): Preview => ({ configuration: { projects: [{ project: { id: "p", name: "<img src=x onerror=alert(1)>" }, archived: true }] }, scopeReview: {
  choices: [], issues: [], rows: Array.from({ length: 14 }, (_, i) => ({ projectId: "p", location: ["additionalSources", i, "config"], revision: "a".repeat(64), kind: "folder", value: `Imported/Work${i}`, recursive: false, context: "Source", existingCandidates: 0, status: "pending" })),
} }) as unknown as Preview;
let modal: InstanceType<typeof ProjectPackageScopesModal>, submit: jest.Mock;
const buttons = (key: string) => Array.from(modal.contentEl.querySelectorAll("button")).filter(button => button.textContent === "package-inspect." + key);
const toggles = () => Array.from(modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
const choose = (input: HTMLInputElement, value: boolean) => { input.checked = value; input.dispatchEvent(new Event("change")); };
beforeEach(() => { submit = jest.fn(); modal = new ProjectPackageScopesModal({} as App, preview(), submit); modal.open(); });
afterEach(() => { modal.close(); document.body.replaceChildren(); });

test("all rules are reachable, with default-off native toggles and stable navigation", () => {
  expect(toggles()).toHaveLength(12); expect(toggles().every(input => !input.checked)).toBe(true);
  expect(toggles()[0]!.getAttribute("aria-label")).toBe("package-inspect.scope-keep-rule");
  choose(toggles()[0]!, true); expect(submit).not.toHaveBeenCalled();
  const next = buttons("binding-next")[0]!; next.click(); expect(toggles()).toHaveLength(2); expect(next.disabled).toBe(true);
  expect(buttons("binding-next")[0]).toBe(next); buttons("binding-previous")[0]!.click(); expect(toggles()[0]!.checked).toBe(true);
  expect(modal.contentEl.textContent).toContain("package-inspect.scope-pending-check");
  buttons("binding-recheck")[0]!.click(); expect(submit).toHaveBeenCalledWith([{ projectId: "p", location: ["additionalSources", 0, "config"], revision: "a".repeat(64), mode: "keep-rule" }]);
});

test("rule text is untrusted text, and folder recursion/tag hierarchy are explicit", () => {
  expect(modal.contentEl.querySelector("img")).toBeNull(); expect(modal.contentEl.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(modal.contentEl.textContent).toContain("package-inspect.scope-direct");
  modal.close(); const p = preview();
  const tag = { ...p.scopeReview.rows[0]!, kind: "tag" as const, hierarchy: true, value: "#work" }; delete tag.recursive;
  modal = new ProjectPackageScopesModal({} as App, { ...p, scopeReview: { ...p.scopeReview, rows: [tag] } }, submit); modal.open();
  expect(modal.contentEl.textContent).toContain("package-inspect.scope-hierarchy");
});

test("source errors and rules that cannot be displayed fully cannot be acknowledged", () => {
  modal.close(); const p = preview();
  modal = new ProjectPackageScopesModal({} as App, { ...p, scopeReview: { ...p.scopeReview, rows: [{ ...p.scopeReview.rows[0]!, status: "blocked", blockedReason: "long-rule", kind: "query", value: "q".repeat(100000) }] } }, submit); modal.open();
  expect(toggles()[0]!.disabled).toBe(true); choose(toggles()[0]!, true);
  expect(modal.contentEl.textContent).toContain("package-inspect.scope-blocked-long-rule"); expect(modal.contentEl.textContent!.length).toBeLessThan(10000);
  buttons("binding-recheck")[0]!.click(); expect(submit).toHaveBeenCalledWith([]);
});

test("stale revisions are unchecked and require an explicit fresh toggle", () => {
  modal.close(); const p = preview(), row = p.scopeReview.rows[0]!;
  const stale = { projectId: row.projectId, location: row.location, revision: "b".repeat(64), mode: "keep-rule" as const };
  modal = new ProjectPackageScopesModal({} as App, { ...p, scopeReview: { ...p.scopeReview, choices: [stale], rows: [{ ...row, status: "invalid" }] } }, submit); modal.open();
  expect(toggles()[0]!.checked).toBe(false); expect(modal.contentEl.textContent).toContain("package-inspect.scope-invalid");
  choose(toggles()[0]!, true); buttons("binding-recheck")[0]!.click(); expect(submit).toHaveBeenCalledWith([{ ...stale, revision: row.revision }]);
});

test("reset removes orphan choices and closure discards edits and late callbacks", () => {
  choose(toggles()[0]!, true); buttons("binding-reset-all")[0]!.click(); expect(toggles()[0]!.checked).toBe(false);
  buttons("binding-recheck")[0]!.click(); expect(submit).toHaveBeenCalledWith([]); submit.mockClear();
  modal.close(); modal = new ProjectPackageScopesModal({} as App, preview(), submit); modal.open();
  const input = toggles()[0]!, recheck = buttons("binding-recheck")[0]!; choose(input, true); modal.close(); choose(input, true); recheck.click(); expect(submit).not.toHaveBeenCalled();
});
