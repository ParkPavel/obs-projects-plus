import { readFileSync } from "fs";
import { resolve } from "path";
import vm from "vm";
import ts from "typescript";
import { readRawSettings, settingsFilePath, writeBrokenCopy, writeConflictCopy, writeConflictNote } from "../brokenBackup";
import { saveCheckedSettings } from "../settingsCheckedSave";
import { canonical } from "../settingsVerify";
import { createSettingsWriter, SETTINGS_WRITE_REFUSED } from "../settingsWriter";

const DIR = "CustomConfig/plugins/projects";
const PATH = `${DIR}/data.json`;
const ORIGINAL = '{"projects": [\n повреждённые ``` bytes';
type Fault = "throw" | "noop" | "truncate" | "read" | "none";
function disk(fault: Fault) {
  const files = new Map([[PATH, ORIGINAL]]);
  const host = {
    files, fault,
    exists: async (path: string) => files.has(path),
    mkdir: async (_path: string) => {},
    append: async (path: string, suffix: string) => { files.set(path, (files.get(path) ?? "") + suffix); },
    write: async (path: string, text: string) => {
      if (host.fault === "throw") throw new Error("EACCES backup only");
      if (host.fault !== "noop") files.set(path, host.fault === "truncate" ? text.slice(0, 7) : text);
    },
    read: async (path: string) => {
      if (host.fault === "read" && path !== PATH) throw new Error("EIO copy readback");
      const text = files.get(path);
      if (text === undefined) throw new Error("ENOENT");
      return text;
    },
    process: jest.fn(async (path: string, update: (raw: string) => string) => {
      const next = update(await host.read(path));
      files.set(path, next);
      return next;
    }),
  };
  return host;
}

const copies = [
  { name: "broken JSON", copy: (d: ReturnType<typeof disk>) => writeBrokenCopy(d, DIR, ORIGINAL, "invalid", new Date()) },
  { name: "conflict JSON", copy: (d: ReturnType<typeof disk>) => writeConflictCopy(d, DIR, ORIGINAL, new Date()) },
  { name: "recovery note", copy: (d: ReturnType<typeof disk>) => writeConflictNote(d, ORIGINAL, new Date(), PATH) },
];

describe.each(copies)("verified $name preservation", ({ copy }) => {
  test.each<Fault>(["throw", "noop", "truncate", "read"])("does not promise a copy after %s", async (fault) => {
    const d = disk(fault);
    expect(await copy(d)).toBeNull();
    expect(d.files.get(PATH)).toBe(ORIGINAL);
  });
  test("reports only a readable complete copy", async () => {
    const d = disk("none");
    const path = await copy(d);
    expect(path).not.toBeNull();
    const copyText = await d.read(path!);
    expect(copyText.includes(ORIGINAL) || JSON.parse(copyText).__broken_backup_raw === ORIGINAL).toBe(true);
    expect(d.files.get(PATH)).toBe(ORIGINAL);
  });
});

test("a silent Vault.create cannot be mistaken for a verified recovery note", async () => {
  const d = disk("none");
  const vault = { createFolder: async (_path: string) => {}, create: jest.fn(async (_path: string, _text: string) => {}) };
  expect(await writeConflictNote(d, ORIGINAL, new Date(), PATH, vault)).toBeNull();
  expect(vault.create).toHaveBeenCalledTimes(2); // folder and root fallback
  expect(d.files.get(PATH)).toBe(ORIGINAL);
});

test("verifies Vault.create through adapter.read and falls back from a silent folder write", async () => {
  const d = disk("none");
  const vault = {
    createFolder: async (_path: string) => {},
    create: async (path: string, text: string) => { if (!path.includes("/")) await d.write(path, text); },
  };
  const path = await writeConflictNote(d, ORIGINAL, new Date(), PATH, vault);
  expect(path).not.toBeNull();
  expect(path).not.toContain("/");
  expect(await d.read(path!)).toContain(ORIGINAL);
});

// Execute the actual two main.ts method bodies, selected by the TypeScript AST.
// Loading the entire Obsidian plugin would substitute its host and UI imports;
// this narrow harness keeps recovery and checked-save code intact and supplies
// their real persistence functions plus an observable adapter.
const source = readFileSync(resolve(__dirname, "../../../main.ts"), "utf8");
const ast = ts.createSourceFile("main.ts", source, ts.ScriptTarget.Latest, true);
const plugin = ast.statements.find((n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && n.name?.text === "ProjectsPlusPlugin")!;
const methods = plugin.members.filter(n => ts.isMethodDeclaration(n) && ["copyBrokenSettings", "saveSettingsWithCheck"].includes(n.name.getText(ast)));
if (methods.length !== 2) throw new Error("main recovery methods not found");
const compiled = ts.transpileModule(`class RecoveryProbe { ${methods.map(n => n.getText(ast)).join("\n")} }`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
interface Recovery {
  app: { vault: { adapter: ReturnType<typeof disk> } };
  manifest: { dir: string };
  confirmedOnDisk: string | null;
  confirmedRawOnDisk: string | null;
  scheduleSettingsReconciliation: jest.Mock;
  copyBrokenSettings(reason: string): Promise<string | null>;
  saveSettingsWithCheck(value: unknown): Promise<void | typeof SETTINGS_WRITE_REFUSED>;
}
function recovery(d: ReturnType<typeof disk>): Recovery {
  const Constructor = vm.runInNewContext(`${compiled}; RecoveryProbe`, {
    readRawSettings, writeBrokenCopy, settingsFilePath, saveCheckedSettings, SETTINGS_WRITE_REFUSED,
    console: { error: jest.fn() }, Date,
  }) as new () => Recovery;
  const p = new Constructor();
  Object.assign(p, { app: { vault: { adapter: d } }, manifest: { dir: DIR }, confirmedOnDisk: null, confirmedRawOnDisk: null, scheduleSettingsReconciliation: jest.fn() });
  return p;
}

describe("actual main recovery and checked writer boundary", () => {
  test.each<Fault>(["throw", "noop", "truncate", "read"])("does not authorize overwriting the only original after %s", async (fault) => {
    const d = disk(fault), p = recovery(d);
    p.confirmedOnDisk = canonical({ projects: ["stale"] });
    p.confirmedRawOnDisk = ORIGINAL; // stale recovery state must not grant permission either
    expect(await p.copyBrokenSettings("invalid")).toBeNull();
    expect(p.confirmedRawOnDisk).toBeNull();
    expect(p.confirmedOnDisk).toBeNull();
    expect(await p.saveSettingsWithCheck({ projects: [] })).toBe(SETTINGS_WRITE_REFUSED);
    expect(d.files.get(PATH)).toBe(ORIGINAL);
    expect(p.scheduleSettingsReconciliation).toHaveBeenCalledTimes(1);
  });

  test("keeps the latest queued edit and saves only after the original copy is verified", async () => {
    const d = disk("noop"), p = recovery(d);
    const defaults = { projects: [] as string[] };
    const older = { projects: ["older"] }, latest = { projects: ["latest"] };
    await p.copyBrokenSettings("invalid");
    const writer = createSettingsWriter({
      save: (value: typeof defaults) => p.saveSettingsWithCheck(value),
      verify: async value => canonical(JSON.parse(d.files.get(PATH)!)) === canonical(value) ? "confirmed" : "diverged",
    });
    try {
      writer.prime(defaults); writer.pushNow(older); await writer.flush();
      expect(d.files.get(PATH)).toBe(ORIGINAL);
      expect(writer.status().kind).toBe("diverged");
      expect(writer.hasPending()).toBe(true);
      writer.push(latest);
      d.fault = "none";
      const path = await p.copyBrokenSettings("invalid");
      expect(JSON.parse(await d.read(path!)).__broken_backup_raw).toBe(ORIGINAL);
      await writer.withExclusive("PPP-106", async () => ({ kind: "restore", settings: older }));
      await writer.flush();
      expect(JSON.parse(d.files.get(PATH)!)).toEqual(latest);
      expect(writer.status().kind).toBe("idle");
    } finally { writer.dispose(); }
  });
});
