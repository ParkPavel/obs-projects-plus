import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { get, writable } from "svelte/store";
import { createSettingsWriter } from "src/lib/settings/settingsWriter";
import { canonical } from "src/lib/settings/settingsVerify";
import { reconcileSettings } from "src/lib/settings/settingsReconcile";
import { episodeOutcome } from "src/lib/settings/settingsEpisode";
import { migrateFormulaSettings, prepareFormulaMigration } from "../settingsMigration";

interface Value {
  version: number; projects: never[]; marker: string;
  formulaFields?: Array<{ name: string; expression: string; formulaVersion?: string }>;
}

// Exercise the actual main methods without importing Obsidian's entire UI graph.
// Only schema resolution is stubbed; writer, reconciliation and migration are real.
const source = ts.createSourceFile("main.ts", fs.readFileSync(path.resolve(__dirname, "../../../main.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(ts.isClassDeclaration)!;
const methods = ["onExternalSettingsChange", "takeAdoption", "decideExternalChange", "prepareCurrentFormulas", "noteFileAsSeen"].map(name => {
  const member = declaration.members.find(member => member.name?.getText(source) === name);
  if (!member) throw new Error(`Main method missing: ${name}`);
  return member.getText(source);
});
const controller = ts.transpileModule(`class MainControl { ${methods.join("\n")} }\nMainControl;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

test.each([false, true])("external formula adoption persists once and protects a newer disk version (concurrent=%s)", async concurrent => {
  const memory: Value = { version: 4, projects: [], marker: "before" };
  const external: Value = { version: 4, projects: [], marker: "external", formulaFields: [{ name: "answer", expression: '"2" < "10"' }] };
  let disk = JSON.stringify(external), writes = 0;
  const backups = new Map<string, string>();
  const settings = writable(memory);
  const Controller = vm.runInNewContext(controller, {
    get, settings, reconcileSettings, episodeOutcome, canonical, migrateFormulaSettings, prepareFormulaMigration,
    DEFAULT_SETTINGS: { version: 4 }, SETTINGS_SUPERSEDED: "PPP-102",
    migrateSettings: (value: Value) => ({ right: value }), either: { isLeft: () => false },
    settingsFilePath: () => "plugin/data.json", i18n: writable({ t: (key: string) => key }),
    Notice: class {}, console: { debug: () => {} },
  }) as new () => { confirmedOnDisk: string | null; onExternalSettingsChange(): Promise<void> };
  const plugin = new Controller();
  Object.assign(plugin, {
    manifest: { dir: "plugin" }, confirmedOnDisk: canonical(memory), pendingAdoption: null,
    readSettingsFile: async () => disk, announce: () => {},
    preserveConflicting: () => { throw new Error("Unexpected conflict"); },
    app: { vault: { adapter: {
      exists: async (file: string) => backups.has(file), read: async (file: string) => backups.get(file),
      write: async (file: string, text: string) => {
        backups.set(file, text);
        if (concurrent && file.endsWith(".report.json")) disk = JSON.stringify({ ...external, marker: "newer" });
      },
    } } },
  });
  const writer = createSettingsWriter<Value>({
    save: async value => { disk = JSON.stringify(value); writes++; },
    verify: async value => canonical(JSON.parse(disk)) === canonical(value) ? "confirmed" : "diverged",
    beforeWrite: async () => canonical(JSON.parse(disk)) === plugin.confirmedOnDisk,
  });
  Object.assign(plugin, { settingsWriter: writer });
  writer.prime(memory);
  const unsubscribe = settings.subscribe(value => writer.push(value));
  try {
    await plugin.onExternalSettingsChange(); await writer.flush();
    if (concurrent) {
      expect((JSON.parse(disk) as Value).marker).toBe("newer");
      expect(writes).toBe(0);
    } else {
      expect((JSON.parse(disk) as Value).formulaFields?.[0]?.formulaVersion).toBe("unified-v1");
      expect(writes).toBe(1);
      expect([...backups.values()]).toContain(JSON.stringify(external));
      await plugin.onExternalSettingsChange(); await writer.flush();
      expect(writes).toBe(1); expect(backups.size).toBe(2);
    }
  } finally { unsubscribe(); writer.dispose(); }
});
