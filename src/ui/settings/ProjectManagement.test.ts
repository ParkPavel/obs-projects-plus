import { tick } from "svelte";
import { get } from "svelte/store";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";

jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string) => key }) }));
jest.mock("src/lib/stores/settings", () => {
  const store = require("svelte/store").writable(require("src/settings/settings").DEFAULT_SETTINGS);
  return { settings: Object.assign(store, { archiveProject: jest.fn(), restoreArchive: jest.fn() }) };
});
const Panel = require("./ProjectManagement.svelte").default;
const settle = async () => { for (let i = 0; i < 4; i++) await tick(); };
function mount() {
  const target = document.createElement("div"); document.body.append(target);
  const actions = { onCreate: jest.fn(), onImport: jest.fn(), onOpen: jest.fn(() => true), onShare: jest.fn(), onCopies: jest.fn(), onConfiguration: jest.fn() };
  const component = new Panel({ target, props: actions });
  const button = (key: string) => Array.from(target.querySelectorAll("button")).find(button => button.textContent === "project-manager." + key)!;
  return { target, component, actions, button, destroy: () => { component.$destroy(); target.remove(); } };
}
beforeEach(() => { settings.set({ ...DEFAULT_SETTINGS, projects: [{ ...DEFAULT_PROJECT, id: "p", name: "Alpha" }], archives: [{ ...DEFAULT_PROJECT, id: "q", name: "Archived" }] }); jest.clearAllMocks(); });

test("project actions target the selected project, search survives store refresh, and names render as text", async () => {
  const view = mount();
  try {
    view.button("share").click(); await settle(); expect(view.actions.onShare).toHaveBeenCalledWith("p");
    view.button("open").click(); await settle(); expect(view.actions.onOpen).toHaveBeenCalledWith("p");
    const input = view.target.querySelector("input")!; input.focus(); input.value = "Alpha"; input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
    settings.set({ ...get(settings), projects: [{ ...DEFAULT_PROJECT, id: "p", name: "Alpha <img src=x>" }] }); await tick();
    expect(view.target.querySelector("input")).toBe(input); expect(input.value).toBe("Alpha");
    expect(view.target.textContent).toContain("Alpha <img src=x>"); expect(view.target.querySelector("img")).toBeNull();
    view.button("archive").click(); await settle(); expect(settings.archiveProject).toHaveBeenCalledWith("p");
  } finally { view.destroy(); }
});

test("a pending operation stays accessible for recovery while conflicting actions are disabled", async () => {
  const view = mount();
  try {
    settings.set({ ...get(settings), preferences: { ...get(settings).preferences, projectFiles: { root: "Copies", autoSync: false, pendingImport: { format: "obs-projects-plus/pending-import", schemaVersion: 1, id: "a".repeat(64), archiveHash: "b".repeat(64), journal: "Copies/journal.json", paths: ["Imported/Note.md"] } } } }); await tick();
    expect(view.button("create").disabled).toBe(true); expect(view.button("share").disabled).toBe(true);
    view.button("pending-action").click(); await tick(); expect(view.actions.onImport).toHaveBeenCalledTimes(1);
    const detached = view.button("copies"); view.destroy(); detached.click(); expect(view.actions.onCopies).not.toHaveBeenCalled();
  } finally { view.component.$destroy(); view.target.remove(); }
});
