import {
  brokenCopyPath,
  readRawSettings,
  settingsFilePath,
  writeBrokenCopy,
  type BrokenCopyAdapter,
} from "src/lib/settings/brokenBackup";

/**
 * #195 — the copy must outlive the file it was copied from.
 *
 * The defect these cover was found by running the plugin, not by reading it:
 * the copy lived inside `data.json`, and the first ordinary save after the
 * corruption — onboarding creating the demo project — rewrote that file whole.
 */

interface Fake extends BrokenCopyAdapter {
  files: Map<string, string>;
  writeFails: boolean;
  readFails: boolean;
}

function makeAdapter(): Fake {
  const fake: Fake = {
    files: new Map<string, string>(),
    writeFails: false,
    readFails: false,
    async write(path: string, data: string): Promise<void> {
      if (fake.writeFails) throw new Error("EACCES");
      fake.files.set(path, data);
    },
    async read(path: string): Promise<string> {
      if (fake.readFails) throw new Error("EIO");
      const found = fake.files.get(path);
      if (found === undefined) throw new Error("ENOENT");
      return found;
    },
    async exists(path: string): Promise<boolean> {
      return fake.files.has(path);
    },
  };
  return fake;
}

// Not a real config path: Obsidian's config folder is user-configurable, and the
// lint rule that says so is right — nothing here depends on the folder's name.
const DIR = "vault-config/plugins/obs-projects-plus";

describe("#195 — the forensic copy of unreadable settings", () => {
  it("is written beside data.json, not inside it", async () => {
    const adapter = makeAdapter();
    adapter.files.set(`${DIR}/data.json`, '{"projects": "not-an-array"}');

    const raw = await readRawSettings(adapter, DIR);
    const path = await writeBrokenCopy(
      adapter,
      DIR,
      raw ?? "",
      "projects is not an array",
      new Date("2026-09-05T18:44:00.000Z")
    );

    expect(path).toBe(`${DIR}/data.broken-2026-09-05T18-44-00-000Z.json`);
    // The settings file itself is untouched: the copy is a second file.
    expect(adapter.files.get(`${DIR}/data.json`)).toBe(
      '{"projects": "not-an-array"}'
    );
    const copy = JSON.parse(adapter.files.get(path ?? "") ?? "{}") as {
      __broken_backup_raw: string;
      __broken_backup_reason: string;
    };
    expect(copy.__broken_backup_raw).toBe('{"projects": "not-an-array"}');
    expect(copy.__broken_backup_reason).toBe("projects is not an array");
  });

  it("survives the write that used to delete it", async () => {
    const adapter = makeAdapter();
    adapter.files.set(`${DIR}/data.json`, '{"projects": "not-an-array"}');

    const raw = await readRawSettings(adapter, DIR);
    const path = await writeBrokenCopy(
      adapter,
      DIR,
      raw ?? "",
      "wrong shape",
      new Date("2026-09-05T18:44:00.000Z")
    );

    // What onboarding does moments later: settings are saved, and saveData
    // rewrites data.json whole.
    await adapter.write(`${DIR}/data.json`, '{"projects": [{"name": "Demo"}]}');

    expect(adapter.files.has(path ?? "")).toBe(true);
  });

  it("a second corruption does not overwrite the first copy", async () => {
    const adapter = makeAdapter();
    adapter.files.set(`${DIR}/data.json`, "first");
    const first = await writeBrokenCopy(
      adapter,
      DIR,
      "first",
      "r",
      new Date("2026-09-05T18:44:00.000Z")
    );
    const second = await writeBrokenCopy(
      adapter,
      DIR,
      "second",
      "r",
      new Date("2026-09-05T19:01:02.000Z")
    );

    expect(first).not.toBe(second);
    // The FIRST copy is the one holding real data; the second may already be a
    // copy of restored defaults.
    expect(
      JSON.parse(adapter.files.get(first ?? "") ?? "{}").__broken_backup_raw
    ).toBe("first");
  });

  it("two copies in the same millisecond do not collide", async () => {
    const adapter = makeAdapter();
    const at = new Date("2026-09-05T18:44:00.000Z");

    const first = await writeBrokenCopy(adapter, DIR, "first", "r", at);
    const second = await writeBrokenCopy(adapter, DIR, "second", "r", at);

    expect(first).not.toBe(second);
    expect(
      JSON.parse(adapter.files.get(first ?? "") ?? "{}").__broken_backup_raw
    ).toBe("first");
    expect(
      JSON.parse(adapter.files.get(second ?? "") ?? "{}").__broken_backup_raw
    ).toBe("second");
  });

  it("writes anyway when the adapter cannot answer whether the name is taken", async () => {
    const adapter = makeAdapter();
    adapter.exists = () => Promise.reject(new Error("EIO"));

    const path = await writeBrokenCopy(adapter, DIR, "payload", "r", new Date());

    // Losing the copy would be worse than overwriting a name that probably is
    // not there.
    expect(path).not.toBeNull();
  });

  it("reports a failed write instead of assuming one", async () => {
    const adapter = makeAdapter();
    adapter.writeFails = true;

    const path = await writeBrokenCopy(adapter, DIR, "payload", "r", new Date());

    expect(path).toBeNull();
  });

  it("has no path at all when the plugin directory is unknown", async () => {
    const adapter = makeAdapter();

    expect(brokenCopyPath(undefined, new Date())).toBeNull();
    expect(settingsFilePath(undefined)).toBeNull();
    expect(await readRawSettings(adapter, undefined)).toBeNull();
    expect(
      await writeBrokenCopy(adapter, undefined, "p", "r", new Date())
    ).toBeNull();
  });

  it("returns null rather than throwing when the file cannot be read back", async () => {
    const adapter = makeAdapter();
    adapter.files.set(`${DIR}/data.json`, "whatever");
    adapter.readFails = true;

    expect(await readRawSettings(adapter, DIR)).toBeNull();
  });

  it("names a file every host accepts", async () => {
    const path = brokenCopyPath(DIR, new Date("2026-09-05T18:44:00.000Z"));

    // Colons are legal in a vault path but not in a Windows filename, and the
    // vault is a real directory on disk.
    expect(path).not.toContain(":");
    expect(path?.endsWith(".json")).toBe(true);
  });
});
