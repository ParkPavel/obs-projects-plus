import { webcrypto } from "node:crypto";
import { TextEncoder, TextDecoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS, type LatestProjectsPluginSettings } from "src/settings/settings";
import { binaryDigest } from "../package";
import { textDigest } from "../document";
import { createProjectConfiguration } from "../projectConfiguration";
import { installProjectPackage, resumeProjectInstallation, rollbackProjectInstallation, type InstallationStorage, type InstallationPrimary, type ProjectInstallationPlan } from "../packageInstallation";

const saved = { crypto: window.crypto, TextEncoder: window.TextEncoder, TextDecoder: window.TextDecoder };
const encoder = new TextEncoder(), decoder = new TextDecoder();
beforeAll(() => { for (const [key, value] of Object.entries({ crypto: webcrypto, TextEncoder, TextDecoder })) Object.defineProperty(window, key, { value, configurable: true }); });
afterAll(() => { for (const [key, value] of Object.entries(saved)) Object.defineProperty(window, key, { value, configurable: true }); });
async function fixture() {
  const project = { ...DEFAULT_PROJECT, id: "new-project", name: "Imported" };
  const configuration = { projectId: project.id, path: "Imported/Project settings/config.json", owner: "owner-1", baseRevision: await textDigest(JSON.stringify(project)), sha256: "" };
  const content = new Map([["Imported/Note.md", encoder.encode("Note")], [configuration.path, encoder.encode(await createProjectConfiguration(project, configuration.owner))]]);
  const files = await Promise.all([...content].map(async ([path, bytes]) => ({ path, bytes: bytes.length, sha256: await binaryDigest(bytes) })));
  configuration.sha256 = files[1]!.sha256;
  const plan: ProjectInstallationPlan = { format: "obs-projects-plus/installation", schemaVersion: 1, owner: "owner-1", archivePath: "Package.zip", archiveHash: "a".repeat(64), root: "Imported", copyRoot: "Copies", projects: [{ project, archived: false, configuration }], files };
  const data = new Map<string, Uint8Array>(), folders = new Set<string>();
  let current: LatestProjectsPluginSettings = { ...DEFAULT_SETTINGS, projects: [], archives: [], preferences: { ...DEFAULT_SETTINGS.preferences, projectFiles: { root: "Copies", autoSync: false } } };
  const primary: InstallationPrimary = {
    read: jest.fn(async () => current),
    commit: jest.fn(async (expected, candidate) => { if (current !== expected) return "stale"; current = candidate; return "confirmed"; }),
  };
  const storage: InstallationStorage = {
    read: jest.fn(async path => data.has(path) ? decoder.decode(data.get(path)) : null),
    create: jest.fn(async (path, text) => { if (data.has(path)) throw Error("occupied"); data.set(path, encoder.encode(text)); }),
    replace: jest.fn(async (path, expected, text) => { if (decoder.decode(data.get(path)) !== expected) throw Error("changed"); data.set(path, encoder.encode(text)); }),
    mkdir: jest.fn(async path => { if (data.has(path)) throw Error("parent file"); folders.add(path); }),
    kind: jest.fn(async path => data.has(path) ? "file" : folders.has(path) ? "folder" : null),
    readBinary: jest.fn(async path => data.get(path) ?? null),
    createBinary: jest.fn(async (path, bytes) => {
      if (path.startsWith("Imported/")) {
        expect(current.preferences.projectFiles?.pendingImport?.paths).toContain(path);
        expect(current.projects).toHaveLength(0);
      }
      if (data.has(path)) throw Error("occupied"); data.set(path, new Uint8Array(bytes));
    }),
    recover: jest.fn(async (path, destination) => { if (data.has(destination)) throw Error("recovery occupied"); data.set(destination, data.get(path)!); data.delete(path); }),
  };
  const run = () => installProjectPackage(storage, primary, plan, content, "AppConfig");
  return { plan, content, data, primary, storage, run, current: () => current };
}

test("durable pending metadata precedes final files; activation follows verification and is idempotent", async () => {
  const f = await fixture(), receipt = await f.run();
  expect(f.current().projects.map(p => p.id)).toEqual(["new-project"]);
  expect(f.current().preferences.projectFiles?.pendingImport).toBeUndefined();
  expect(f.current().preferences.projectFiles?.installations).toEqual([receipt]);
  expect(JSON.parse(decoder.decode(f.data.get(receipt.journal))).state).toBe("complete");
  expect(await f.run()).toEqual(receipt);
  expect(f.storage.createBinary).toHaveBeenCalledTimes(4); expect(f.primary.commit).toHaveBeenCalledTimes(2);
});

test("a failure between acknowledged files resumes with the same identities and no duplicate project", async () => {
  const f = await fixture(), create = f.storage.createBinary;
  f.storage.createBinary = jest.fn(async (path, bytes) => { if (path.endsWith("config.json")) throw Error("interrupted"); return create(path, bytes); });
  await expect(f.run()).rejects.toThrow("interrupted");
  expect(f.current().projects).toHaveLength(0); expect(f.current().preferences.projectFiles?.pendingImport).toBeDefined();
  f.storage.createBinary = create;
  await resumeProjectInstallation(f.storage, f.primary, "AppConfig"); expect(f.current().projects).toHaveLength(1); expect(create).toHaveBeenCalledTimes(4);
});

test("a file created before its journal acknowledgment is retained and never automatically adopted", async () => {
  const f = await fixture(), replace = f.storage.replace;
  f.storage.replace = jest.fn(async () => { throw Error("lost acknowledgment"); });
  await expect(f.run()).rejects.toThrow("lost acknowledgment");
  f.storage.replace = replace;
  await expect(f.run()).rejects.toThrow("unacknowledged");
  const result = await rollbackProjectInstallation(f.storage, f.primary, "AppConfig");
  expect(result.retained).toEqual(["Imported/Note.md"]); expect(result.recovered).toEqual([]);
  expect(f.data.has("Imported/Note.md")).toBe(true); expect(f.current().preferences.projectFiles?.pendingImport).toBeUndefined();
});

test("rollback moves unchanged acknowledged bytes to recovery and retains user edits", async () => {
  const f = await fixture(), create = f.storage.createBinary;
  f.storage.createBinary = jest.fn(async (path, bytes) => { if (path.endsWith("config.json")) throw Error("interrupted"); return create(path, bytes); });
  await expect(f.run()).rejects.toThrow();
  const result = await rollbackProjectInstallation(f.storage, f.primary, "AppConfig");
  expect(result.recovered).toHaveLength(1); expect(decoder.decode(f.data.get(result.recovered[0]!))).toBe("Note");
  expect(f.data.has("Imported/Note.md")).toBe(false); expect(f.current().projects).toHaveLength(0);
  const g = await fixture(); g.storage.createBinary = jest.fn(async (path, bytes) => { if (path.endsWith("config.json")) throw Error("stop"); g.data.set(path, bytes); });
  await expect(g.run()).rejects.toThrow(); g.data.set("Imported/Note.md", encoder.encode("User edit"));
  expect((await rollbackProjectInstallation(g.storage, g.primary, "AppConfig")).retained).toEqual(["Imported/Note.md"]);
  expect(decoder.decode(g.data.get("Imported/Note.md"))).toBe("User edit");
});

test("foreign destinations and changed payloads refuse before journal or primary mutation", async () => {
  const f = await fixture(); f.data.set("Imported/Note.md", f.content.get("Imported/Note.md")!);
  await expect(f.run()).rejects.toThrow("destination occupied"); expect(f.primary.commit).not.toHaveBeenCalled(); expect(f.storage.create).not.toHaveBeenCalled();
  const g = await fixture(); g.content.set("Imported/Note.md", encoder.encode("other"));
  await expect(g.run()).rejects.toThrow("payload"); expect(g.primary.commit).not.toHaveBeenCalled();
});

test("unconfirmed publication leaves pending ownership; confirmed disk publication is recognized after restart", async () => {
  const f = await fixture(), commit = f.primary.commit;
  let count = 0;
  f.primary.commit = jest.fn(async (expected, candidate) => { if (++count === 2) return "failed"; return commit(expected, candidate); });
  await expect(f.run()).rejects.toThrow("publication unconfirmed"); expect(f.current().projects).toHaveLength(0);
  f.primary.commit = commit; await f.run(); expect(f.current().projects).toHaveLength(1);
  const g = await fixture(), realCommit = g.primary.commit;
  let n = 0; g.primary.commit = jest.fn(async (expected, candidate) => { const result = await realCommit(expected, candidate); return ++n === 2 ? "failed" : result; });
  await expect(g.run()).rejects.toThrow("publication unconfirmed");
  expect(g.current().projects).toHaveLength(1);
  g.primary.commit = realCommit; await g.run(); expect(g.current().projects).toHaveLength(1);
});

test("a changed immutable journal refuses resume and rollback without touching payloads", async () => {
  const f = await fixture(), create = f.storage.createBinary;
  f.storage.createBinary = jest.fn(async (path, bytes) => { if (path.startsWith("Imported/")) throw Error("stop"); return create(path, bytes); });
  await expect(f.run()).rejects.toThrow();
  const pending = f.current().preferences.projectFiles!.pendingImport!, value = JSON.parse(decoder.decode(f.data.get(pending.journal)));
  value.plan.owner = "foreign"; f.data.set(pending.journal, encoder.encode(JSON.stringify(value)));
  await expect(f.run()).rejects.toThrow(); await expect(rollbackProjectInstallation(f.storage, f.primary, "AppConfig")).rejects.toThrow();
  expect(f.storage.recover).not.toHaveBeenCalled(); expect(f.current().projects).toHaveLength(0);
});
