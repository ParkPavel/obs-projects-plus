type App = import("obsidian").App;
type Service = import("./packageService").ProjectPackageService;
type Inspected = import("src/lib/projectFiles/packageInspect").InspectedProjectPackage;
import { PackageInspectionError } from "src/lib/projectFiles/packagePolicy";

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
    addButton(callback: (control: unknown) => void) {
      const button = document.createElement("button"); this.controlEl.append(button);
      const control = { setButtonText(value: string) { button.textContent = value; return control; }, setDisabled(value: boolean) { button.disabled = value; return control; }, onClick(fn: () => void) { button.addEventListener("click", fn); return control; } };
      callback(control); return this;
    }
  }
  return { Modal, FuzzySuggestModal, Setting, TFile: class {}, lastPicker: () => pickers.at(-1) };
});
const { ProjectPackageInspectModal } = require("./packageInspectModal") as typeof import("./packageInspectModal");
const { lastPicker } = require("obsidian") as { lastPicker(): { onChooseItem(file: { path: string }): void; getItems(): { path: string }[] } };
const beforeEmpty = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "empty");
let modal: InstanceType<typeof ProjectPackageInspectModal>, inspect: jest.Mock, dispose: jest.Mock;
const inspected = { archiveHash: "a".repeat(64), manifest: { projects: [{ name: "<img src=x onerror=alert(1)>", archived: false }], files: [{ role: "note", sourcePath: "Notes/Visit.md", bytes: 42 }], dependencies: [{ reference: "missing", resolved: false }] } } as unknown as Inspected;
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const button = () => modal.contentEl.querySelector("button")!;
beforeAll(() => Object.defineProperty(HTMLElement.prototype, "empty", { configurable: true, value: function(this: HTMLElement) { this.replaceChildren(); } }));
afterAll(() => { if (beforeEmpty) Object.defineProperty(HTMLElement.prototype, "empty", beforeEmpty); else Reflect.deleteProperty(HTMLElement.prototype, "empty"); });
beforeEach(() => {
  inspect = jest.fn(async () => inspected); dispose = jest.fn();
  modal = new ProjectPackageInspectModal({ vault: { getFiles: () => [{ path: "Incoming/Package.zip" }, { path: "Note.md" }] } } as unknown as App, { inspect, dispose } as unknown as Service);
  modal.open();
});
afterEach(() => { modal.close(); document.body.replaceChildren(); });

test("inspection needs no local project and displays names only as text with no apply action", async () => {
  button().click(); expect(lastPicker().getItems()).toEqual([{ path: "Incoming/Package.zip" }]);
  lastPicker().onChooseItem({ path: "Incoming/Package.zip" }); await settle();
  expect(inspect).toHaveBeenCalledWith("Incoming/Package.zip");
  expect(modal.contentEl.textContent).toContain("package-inspect.verified");
  expect(modal.contentEl.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(modal.contentEl.querySelector("img")).toBeNull();
  expect(modal.contentEl.textContent).toContain("Notes/Visit.md");
  expect(modal.contentEl.textContent).toContain("missing");
  expect(modal.contentEl.querySelectorAll("button").length).toBe(1);
});
test("unsupported formats have a specific status and clear the previous preview", async () => {
  button().click(); lastPicker().onChooseItem({ path: "Incoming/Good.zip" }); await settle();
  inspect.mockRejectedValueOnce(new PackageInspectionError("unsupported-zip"));
  button().click(); lastPicker().onChooseItem({ path: "Incoming/Compressed.zip" }); await settle();
  expect(modal.contentEl.textContent).toContain("package-inspect.unsupported-zip");
  expect(modal.contentEl.textContent).not.toContain("Notes/Visit.md");
});
test("closing during inspection cancels the service and prevents late UI updates", async () => {
  let finish!: (value: Inspected) => void;
  inspect.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  button().click(); lastPicker().onChooseItem({ path: "Incoming/Package.zip" });
  expect(button().disabled).toBe(true);
  modal.close(); expect(dispose).toHaveBeenCalled(); finish(inspected); await settle();
  expect(modal.contentEl.childElementCount).toBe(0);
});
