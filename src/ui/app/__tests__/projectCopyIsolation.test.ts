import { tick } from "svelte";
import { get } from "svelte/store";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";
import { dataFrame, dataSource } from "src/lib/stores/dataframe";
import { fileSystem } from "src/lib/stores/fileSystem";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
type IFile = import("src/lib/filesystem/filesystem").IFile;
type IFileSystem = import("src/lib/filesystem/filesystem").IFileSystem;
import { registerFileEvents } from "src/events";

jest.mock("src/lib/stores/fileSystem", () => ({ fileSystem: require("svelte/store").writable() }));
jest.mock("src/lib/datasources/dataview/host", () => ({ getAPI: () => undefined, isPluginEnabled: () => false }));
const Provider = require("../DataFrameProvider.svelte").default as new (options: { target: HTMLElement; props: { project: import("src/settings/settings").ProjectDefinition } }) => { $destroy(): void };

async function settle() { for (let i = 0; i < 8; i++) { await tick(); await Promise.resolve(); } }

test("an already open provider excludes first and changed copy roots from file events", async () => {
  settings.set(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  const fs = new InMemFileSystem({});
  await fs.create("Task.md", "---\nstatus: todo\n---\n");
  (fileSystem as unknown as { set(value: IFileSystem): void }).set(fs);
  const project = { ...DEFAULT_PROJECT, id: "p", name: "Project", dataSource: { kind: "folder" as const, config: { path: "", recursive: true } } };
  const target = document.createElement("div");
  const mounted = new Provider({ target, props: { project } });
  let created!: (file: IFile) => Promise<void>;
  registerFileEvents({ onCreate: callback => { created = callback; }, onChange: () => {}, onRename: () => {}, onDelete: () => {} });
  try {
    await settle();
    const initial = get(dataSource);
    expect(get(dataFrame).records.map(record => record.id)).toEqual(["Task.md"]);
    const hash = "a".repeat(64);
    const oldCopy = `CopiesA/Projects/${hash}/Project.md`;
    settings.updatePreferences({ ...get(settings).preferences, projectFiles: { root: "CopiesA", autoSync: false } });
    await settle();
    expect(get(dataSource)).not.toBe(initial);
    await created(await fs.create(oldCopy, "# configuration"));
    expect(get(dataSource)?.includes(oldCopy)).toBe(false);
    expect(get(dataFrame).records.map(record => record.id)).toEqual(["Task.md"]);

    const newCopy = `CopiesB/Backups/${hash}/${hash}.md`;
    settings.updatePreferences({ ...get(settings).preferences, projectFiles: { root: "CopiesB", autoSync: false, previousRoots: ["CopiesA"] } });
    await settle();
    await created(await fs.create(newCopy, "# snapshot"));
    await created(fs.getFile(oldCopy)!);
    expect(get(dataSource)?.includes(newCopy)).toBe(false);
    expect(get(dataSource)?.includes(oldCopy)).toBe(false);
    expect(get(dataFrame).records.map(record => record.id)).toEqual(["Task.md"]);

    const current = get(dataSource);
    settings.updatePreferences({ ...get(settings).preferences, projectFiles: { root: "CopiesB", autoSync: true, previousRoots: ["CopiesA"] } });
    await settle();
    expect(get(dataSource)).toBe(current);
  } finally {
    mounted.$destroy();
    target.remove();
    dataSource.set(undefined);
    settings.set(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  }
});
