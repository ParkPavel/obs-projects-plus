import { saveCheckedSettings, type SettingsWriteBase } from "../settingsCheckedSave";
import { canonical } from "../settingsVerify";
import { createSettingsWriter, SETTINGS_WRITE_REFUSED } from "../settingsWriter";

const PATH = "CustomConfig/plugins/projects/data.json";
const A = { version: 4, projects: ["A"], enabled: false, count: 0 };
const B = { ...A, projects: ["B-external"] };
const C = { ...A, projects: ["C-local"] };
const D = { ...A, projects: ["D-newer"] };
const basis = (value: unknown): SettingsWriteBase => ({ canonical: canonical(value), raw: null });

function disk(initial: string | null) {
  let raw = initial;
  const writes: string[] = [];
  const adapter = {
    exists: jest.fn(async (_path: string) => raw !== null),
    append: jest.fn(async (_path: string, suffix: string) => { raw = (raw ?? "") + suffix; }),
    process: jest.fn(async (_path: string, update: (text: string) => string) => {
      if (raw === null) throw new Error("ENOENT");
      const next = update(raw);
      if (next !== raw) { writes.push(next); raw = next; }
      return raw;
    }),
  };
  return { adapter, writes, get: () => raw, replace: (value: string | null) => { raw = value; } };
}

describe("checked save at the host process boundary", () => {
  it("preserves the JSON contract, false/zero, and uses the supplied custom config path", async () => {
    const d = disk(JSON.stringify(A));
    await expect(saveCheckedSettings(d.adapter, PATH, basis(A), C)).resolves.toBeUndefined();
    expect(JSON.parse(d.get()!)).toEqual(C);
    expect(d.writes).toHaveLength(1);
    expect(d.adapter.process).toHaveBeenCalledWith(PATH, expect.any(Function));
    expect(d.adapter.append).not.toHaveBeenCalled();
  });

  it("keeps formatting when the desired data is already there", async () => {
    const raw = JSON.stringify(A, null, "\t") + "\n";
    const d = disk(raw);
    await saveCheckedSettings(d.adapter, PATH, basis(A), { ...A });
    expect(d.get()).toBe(raw);
    expect(d.writes).toHaveLength(0);
  });

  it("refuses a version which arrives before the process callback", async () => {
    const d = disk(JSON.stringify(B));
    expect(await saveCheckedSettings(d.adapter, PATH, basis(A), C)).toBe(SETTINGS_WRITE_REFUSED);
    expect(JSON.parse(d.get()!)).toEqual(B);
    expect(d.writes).toHaveLength(0);
  });

  it("bootstraps a missing file without truncating an existing version", async () => {
    const d = disk(null);
    await saveCheckedSettings(d.adapter, PATH, basis(null), C);
    expect(d.adapter.append).toHaveBeenCalledWith(PATH, "");
    expect(JSON.parse(d.get()!)).toEqual(C);
    expect(d.writes).toHaveLength(1);
  });

  it("a concurrent first file is retained when it appears after exists", async () => {
    const d = disk(null);
    const append = d.adapter.append.getMockImplementation()!;
    d.adapter.append.mockImplementation(async (path, suffix) => {
      d.replace(JSON.stringify(B));
      await append(path, suffix);
    });
    expect(await saveCheckedSettings(d.adapter, PATH, basis(null), C)).toBe(SETTINGS_WRITE_REFUSED);
    expect(JSON.parse(d.get()!)).toEqual(B);
    expect(d.writes).toHaveLength(0);
  });

  it("does not continue into process when first-file append is refused", async () => {
    const d = disk(null);
    d.adapter.append.mockRejectedValue(new Error("EACCES"));
    await expect(saveCheckedSettings(d.adapter, PATH, basis(null), C)).rejects.toThrow("EACCES");
    expect(d.adapter.process).not.toHaveBeenCalled();
    expect(d.get()).toBeNull();
  });

  it("recreates a deleted file with a known session base, without blind truncation", async () => {
    const d = disk(null);
    await saveCheckedSettings(d.adapter, PATH, basis(A), C);
    expect(d.adapter.append).toHaveBeenCalledWith(PATH, "");
    expect(JSON.parse(d.get()!)).toEqual(C);
  });

  it("preserves a replacement arriving during deleted-file recreation", async () => {
    const d = disk(null);
    const append = d.adapter.append.getMockImplementation()!;
    d.adapter.append.mockImplementation(async (path, suffix) => {
      d.replace(JSON.stringify(B));
      await append(path, suffix);
    });
    expect(await saveCheckedSettings(d.adapter, PATH, basis(A), C)).toBe(SETTINGS_WRITE_REFUSED);
    expect(JSON.parse(d.get()!)).toEqual(B);
    expect(d.writes).toHaveLength(0);
  });

  it("a confirmed empty recovery base permits only those exact empty bytes", async () => {
    const d = disk("");
    const base = { canonical: null, raw: "" };
    d.replace(JSON.stringify(B));
    expect(await saveCheckedSettings(d.adapter, PATH, base, C)).toBe(SETTINGS_WRITE_REFUSED);
    expect(JSON.parse(d.get()!)).toEqual(B);
    d.replace("");
    await saveCheckedSettings(d.adapter, PATH, base, C);
    expect(JSON.parse(d.get()!)).toEqual(C);
  });

  it("does not create a missing file when the session base is unknown", async () => {
    const d = disk(null);
    await expect(saveCheckedSettings(d.adapter, PATH, { canonical: null, raw: null }, C)).rejects.toThrow("ENOENT");
    expect(d.adapter.append).not.toHaveBeenCalled();
    expect(d.get()).toBeNull();
  });

  it("allows recovery's exact damaged bytes, but refuses a different damaged version", async () => {
    const d = disk("{broken");
    const base = { canonical: null, raw: "{broken" };
    d.replace("{another");
    expect(await saveCheckedSettings(d.adapter, PATH, base, C)).toBe(SETTINGS_WRITE_REFUSED);
    expect(d.get()).toBe("{another");
    d.replace(base.raw);
    await saveCheckedSettings(d.adapter, PATH, base, C);
    expect(JSON.parse(d.get()!)).toEqual(C);
  });

  it("unknown base never grants permission for blind overwrite", async () => {
    const d = disk(JSON.stringify(B));
    expect(await saveCheckedSettings(d.adapter, PATH, { canonical: null, raw: null }, C)).toBe(SETTINGS_WRITE_REFUSED);
    expect(JSON.parse(d.get()!)).toEqual(B);
  });

  it("serializes before any file mutation", async () => {
    const d = disk(null);
    const cycle: Record<string, unknown> = {};
    cycle["self"] = cycle;
    await expect(saveCheckedSettings(d.adapter, PATH, basis(null), cycle)).rejects.toThrow();
    expect(d.adapter.append).not.toHaveBeenCalled();
    expect(d.adapter.process).not.toHaveBeenCalled();
  });

  it("propagates host refusal without a blind fallback", async () => {
    const d = disk(JSON.stringify(A));
    d.adapter.process.mockRejectedValue(new Error("EACCES"));
    await expect(saveCheckedSettings(d.adapter, PATH, basis(A), C)).rejects.toThrow("EACCES");
    expect(d.get()).toBe(JSON.stringify(A));
    expect(d.writes).toHaveLength(0);
    expect(d.adapter.append).not.toHaveBeenCalled();
  });

  it("does not claim success when a host skips the check callback", async () => {
    const d = disk(JSON.stringify(A));
    d.adapter.process.mockResolvedValue(JSON.stringify(A));
    await expect(saveCheckedSettings(d.adapter, PATH, basis(A), C)).rejects.toThrow("did not check");
  });
});

describe("#213 — the real writer, checked save and reconciliation", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("resumes a queued edit after bounded empty-file recovery instead of fencing forever", async () => {
    const d = disk(JSON.stringify(A));
    let base = basis(A);
    const writer = createSettingsWriter({
      save: (value: typeof A) => saveCheckedSettings(d.adapter, PATH, base, value),
      verify: async (value) => canonical(JSON.parse(d.get()!)) === canonical(value) ? "confirmed" : "diverged",
    });
    try {
      writer.prime(A);
      d.replace("");
      writer.pushNow(C); await writer.flush();
      expect(writer.status().kind).toBe("diverged");
      await writer.withExclusive("PPP-102", async () => {
        // settleUnreadable's bounded-empty release records exactly what it saw.
        base = { canonical: null, raw: d.get() };
        return { kind: "release" };
      });
      await writer.flush();
      expect(JSON.parse(d.get()!)).toEqual(C);
      expect(writer.status().kind).toBe("idle");
      expect(writer.hasPending()).toBe(false);
      expect(d.writes).toHaveLength(1);
    } finally { writer.dispose(); }
  });

  it("still verifies a host that calls the callback but silently refuses to write", async () => {
    const d = disk(JSON.stringify(A));
    d.adapter.process.mockImplementation(async (_path, update) => { update(d.get()!); return d.get()!; });
    const writer = createSettingsWriter({
      save: (value: typeof A) => saveCheckedSettings(d.adapter, PATH, basis(A), value),
      verify: async (value) => canonical(JSON.parse(d.get()!)) === canonical(value) ? "confirmed" : "not-written",
      retryDelaysMs: [],
    });
    try {
      writer.prime(A); writer.pushNow(C); await writer.flush();
      expect(writer.status().kind).toBe("failed");
      expect(writer.hasPending()).toBe(true);
      expect(JSON.parse(d.get()!)).toEqual(A);
    } finally { writer.dispose(); }
  });

  it("fences a different version arriving after process but before verification", async () => {
    const d = disk(JSON.stringify(A));
    const writer = createSettingsWriter({
      save: (value: typeof A) => saveCheckedSettings(d.adapter, PATH, basis(A), value),
      verify: async () => { d.replace(JSON.stringify(B)); return "diverged"; },
    });
    try {
      writer.prime(A); writer.pushNow(C); await writer.flush();
      expect(writer.status().kind).toBe("diverged");
      writer.retry(); jest.advanceTimersByTime(1000);
      expect(JSON.parse(d.get()!)).toEqual(B);
      expect(d.writes).toHaveLength(1);
    } finally { writer.dispose(); }
  });

  it("keeps B arriving after preflight, then restores the newest queued edit only after B is preserved", async () => {
    const d = disk(JSON.stringify(A));
    let base = basis(A);
    let race = true;
    const preserved: string[] = [];
    const refused = jest.fn();
    const writer = createSettingsWriter({
      beforeWrite: async () => {
        const matches = canonical(JSON.parse(d.get()!)) === base.canonical;
        if (race) { race = false; d.replace(JSON.stringify(B)); }
        return matches;
      },
      save: async (value: typeof A) => {
        const result = await saveCheckedSettings(d.adapter, PATH, base, value);
        if (result === SETTINGS_WRITE_REFUSED) refused();
        return result;
      },
      verify: async (value) => canonical(JSON.parse(d.get()!)) === canonical(value) ? "confirmed" : "diverged",
    });
    try {
      writer.prime(A); writer.pushNow(C); await writer.flush();
      expect(writer.status().kind).toBe("diverged");
      expect(writer.hasPending()).toBe(true);
      expect(refused).toHaveBeenCalledTimes(1);
      expect(d.writes).toHaveLength(0);
      writer.push(D); writer.retry();
      jest.advanceTimersByTime(1000);
      expect(JSON.parse(d.get()!)).toEqual(B);
      await writer.withExclusive("PPP-102", async () => {
        preserved.push(d.get()!);
        base = basis(B);
        return { kind: "restore", settings: C };
      });
      await writer.flush();
      expect(preserved.map((raw) => JSON.parse(raw))).toEqual([B]);
      expect(JSON.parse(d.get()!)).toEqual(D);
      expect(d.writes).toHaveLength(1);
      expect(writer.status().kind).toBe("idle");
    } finally { writer.dispose(); }
  });
});
