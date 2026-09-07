import {
  brokenCopyPath,
  conflictCopyPath,
  readRawSettings,
  settingsFilePath,
  writeBrokenCopy,
  writeConflictCopy,
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

    const path = await writeBrokenCopy(
      adapter,
      DIR,
      "payload",
      "r",
      new Date()
    );

    // Losing the copy would be worse than overwriting a name that probably is
    // not there.
    expect(path).not.toBeNull();
  });

  it("reports a failed write instead of assuming one", async () => {
    const adapter = makeAdapter();
    adapter.writeFails = true;

    const path = await writeBrokenCopy(
      adapter,
      DIR,
      "payload",
      "r",
      new Date()
    );

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

describe("#200 — the copy of the version this session refused", () => {
  const OTHER = `{
  "version": 4,
  "projects": []
}
`;

  it("is written verbatim, so it can be renamed back over data.json", async () => {
    // The difference from the broken copy, and the reason for a second
    // function rather than a flag: that payload is evidence and is wrapped in
    // keys describing the failure. This one is valid settings somebody meant,
    // and wrapping it would destroy the only useful recovery there is.
    const adapter = makeAdapter();

    const path = await writeConflictCopy(
      adapter,
      DIR,
      OTHER,
      new Date("2026-09-07T11:07:48.265Z")
    );

    expect(path).not.toBeNull();
    expect(adapter.files.get(path as string)).toBe(OTHER);
  });

  it("says which of the two things happened, in the name", async () => {
    // The name is what the user reads in the notice. `data.broken-*` would be
    // a lie about a file that is perfectly well formed and simply belongs to
    // somebody else.
    const at = new Date("2026-09-07T11:07:48.265Z");

    expect(conflictCopyPath(DIR, at)).toContain("data.conflict-");
    expect(conflictCopyPath(DIR, at)).not.toContain("broken");
    expect(conflictCopyPath(DIR, at)).not.toContain(":");
  });

  it("never overwrites an earlier copy", async () => {
    const adapter = makeAdapter();
    const at = new Date("2026-09-07T11:07:48.265Z");

    const first = await writeConflictCopy(adapter, DIR, "first", at);
    const second = await writeConflictCopy(adapter, DIR, "second", at);

    expect(second).not.toBe(first);
    expect(adapter.files.get(first as string)).toBe("first");
    expect(adapter.files.get(second as string)).toBe("second");
  });

  it("refuses a name whose absence cannot be established", async () => {
    // From the adversarial review. #195 answers this the other way for the
    // broken copy — writing over a name that probably does not exist beats not
    // writing — and that answer is wrong here, because the CALLER overwrites
    // data.json once this reports success. A copy that silently replaced an
    // earlier one would take the last remaining version with it.
    const adapter = makeAdapter();
    adapter.exists = async () => {
      throw new Error("EIO");
    };

    expect(
      await writeConflictCopy(adapter, DIR, "theirs", new Date())
    ).toBeNull();
  });

  it("leaves the broken copy's opposite answer intact", async () => {
    // The two copies differ deliberately, so this pins that the #195 behaviour
    // was not changed underneath it while #200 was tightening its own.
    const adapter = makeAdapter();
    adapter.exists = async () => {
      throw new Error("EIO");
    };

    expect(
      await writeBrokenCopy(adapter, DIR, "payload", "reason", new Date())
    ).not.toBeNull();
  });

  it("reports failure instead of assuming it, both ways", async () => {
    // The caller shows a different code depending on this answer, because a
    // notice naming a file that was never written is the #195 defect one level
    // up — and here the stakes are higher: with no copy, the other version
    // exists only as data.json, which the next save overwrites.
    const adapter = makeAdapter();
    adapter.writeFails = true;

    expect(await writeConflictCopy(adapter, DIR, OTHER, new Date())).toBeNull();
    expect(
      await writeConflictCopy(makeAdapter(), undefined, OTHER, new Date())
    ).toBeNull();
  });
});
