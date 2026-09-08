import {
  brokenCopyPath,
  conflictCopyPath,
  readRawSettings,
  settingsFilePath,
  writeBrokenCopy,
  writeConflictCopy,
  writeConflictNote,
  CONFLICT_NOTE_FOLDER,
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
  dirs: string[];
  /** Paths whose write must fail, to stage a folder that cannot be used. */
  refuse: (path: string) => boolean;
}

function makeAdapter(): Fake {
  const fake: Fake = {
    files: new Map<string, string>(),
    writeFails: false,
    readFails: false,
    dirs: [],
    refuse: () => false,
    async mkdir(path: string): Promise<void> {
      fake.dirs.push(path);
    },
    async write(path: string, data: string): Promise<void> {
      if (fake.writeFails || fake.refuse(path)) throw new Error("EACCES");
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

  it("does not depend on the adapter being able to answer `exists`", async () => {
    // Two reviews met here. The first said never to write a path whose absence
    // cannot be established; the second found that two callbacks in the same
    // millisecond both see the timestamped name as free. Refusing to write was
    // the wrong lever for either — the name now carries a random token, so
    // absence follows from how it was built and the copy survives an adapter
    // that cannot answer.
    const adapter = makeAdapter();
    adapter.exists = async () => {
      throw new Error("EIO");
    };

    const path = await writeConflictCopy(adapter, DIR, "theirs", new Date());

    expect(path).not.toBeNull();
    expect(adapter.files.get(path as string)).toBe("theirs");
  });

  it("gives two copies of the same millisecond two different names", async () => {
    // The concurrency the pre-merge review named: overlapping external-change
    // callbacks, each preserving a different version, both reporting success.
    // The second must not replace the first — it is the first that holds what
    // the user is being sent to look for.
    const adapter = makeAdapter();
    const at = new Date("2026-09-08T04:38:32.011Z");

    const [first, second] = await Promise.all([
      writeConflictCopy(adapter, DIR, "one", at),
      writeConflictCopy(adapter, DIR, "two", at),
    ]);

    expect(first).not.toBe(second);
    expect(adapter.files.get(first as string)).toBe("one");
    expect(adapter.files.get(second as string)).toBe("two");
  });

  it("leaves the broken copy's own answer intact", async () => {
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

  it("falls back to a note the app can open when no file can be written beside data.json", async () => {
    // #211: the console fallback is desktop-only and `isDesktopOnly` is false,
    // so on a phone a payload that only reaches the console is a recovery path
    // that does not exist. A note at the vault root does.
    const adapter = makeAdapter();

    const path = await writeConflictNote(adapter, '{"version":4}', new Date());

    expect(path).not.toBeNull();
    expect(path?.endsWith(".md")).toBe(true);
    // Markdown, so it opens; fenced, so the payload survives being rendered.
    const note = adapter.files.get(path as string) as string;
    expect(note).toContain("```json");
    expect(note).toContain('{"version":4}');
    // And it says how to get back, because a file nobody knows how to use is
    // the same broken promise one step later.
    expect(note).toContain("data.json");
  });

  it("names the settings file the caller gave it, and never assembles one", async () => {
    // The configuration folder is whatever the user set it to — the lint rule
    // that says so is right, and this branch is also the one where the path may
    // be unknown. So it is passed in, and its absence changes the wording
    // rather than producing a guess.
    const adapter = makeAdapter();

    const named = await writeConflictNote(
      adapter,
      "x",
      new Date(),
      `${DIR}/data.json`
    );
    expect(adapter.files.get(named as string)).toContain(`${DIR}/data.json`);

    const unnamed = await writeConflictNote(adapter, "x", new Date(), null);
    const text = adapter.files.get(unnamed as string) as string;
    expect(text).toContain("configuration directory");
    // Assembled rather than written out: the repository's own lint rule forbids
    // the literal, and it is right — which is precisely what this asserts the
    // note does not do.
    expect(text).not.toContain([".", "obsidian/"].join(""));
  });

  it("goes in a folder of its own, not loose in the vault root", async () => {
    // The fifth review pass: this is a real vault note, so a project whose
    // source is the vault root lists it as a record — `FolderDataSource.includes`
    // admits everything under an empty project path. A folder does not make
    // that impossible, but it takes the common case out of the way.
    const adapter = makeAdapter();

    const path = await writeConflictNote(adapter, "theirs", new Date());

    expect(adapter.dirs).toContain(CONFLICT_NOTE_FOLDER);
    expect(path?.startsWith(`${CONFLICT_NOTE_FOLDER}/`)).toBe(true);
  });

  it("says plainly that a project may list it, instead of claiming nothing reads it", async () => {
    // The claim was mine and it was false; the fix is the sentence as much as
    // the folder.
    const adapter = makeAdapter();
    const path = await writeConflictNote(adapter, "theirs", new Date());

    expect(adapter.files.get(path as string)).toContain(
      "will list it as a record"
    );
  });

  it("falls back to the vault root when the folder cannot be used", async () => {
    // Worse placed, still readable on a phone — which is the entire reason this
    // path exists.
    const adapter = makeAdapter();
    adapter.refuse = (path) => path.startsWith(`${CONFLICT_NOTE_FOLDER}/`);

    const path = await writeConflictNote(adapter, "theirs", new Date());

    expect(path).not.toBeNull();
    expect(path?.includes("/")).toBe(false);
    expect(adapter.files.get(path as string)).toContain("theirs");
  });

  it("fences the payload longer than anything inside it", async () => {
    // A project name or a widget's text may contain backticks — including three
    // of them. A fixed ```-fence closes early there, and the note's own
    // instruction ("copy everything between the fences") then hands the reader
    // a truncated file: the recovery path quietly stops recovering.
    const adapter = makeAdapter();
    const payload = '{"projects":[{"name":"``` tricky ````"}]}';

    const path = await writeConflictNote(adapter, payload, new Date());
    const note = adapter.files.get(path as string) as string;

    expect(note).toContain(payload);
    // Five backticks: one more than the longest run the payload holds.
    expect(note).toContain("`````json");
    // …and what closes the block is the same fence, not a shorter one.
    const opening = note.slice(note.indexOf("`````json"));
    expect(opening.split("`````").length - 1).toBe(2);
  });

  it("gives two notes of the same millisecond two different names", async () => {
    const adapter = makeAdapter();
    const at = new Date("2026-09-08T04:38:32.011Z");

    const [first, second] = await Promise.all([
      writeConflictNote(adapter, "one", at),
      writeConflictNote(adapter, "two", at),
    ]);

    expect(first).not.toBe(second);
  });

  it("reports a note that could not be written, rather than promising it", async () => {
    const adapter = makeAdapter();
    adapter.writeFails = true;

    expect(await writeConflictNote(adapter, "theirs", new Date())).toBeNull();
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
