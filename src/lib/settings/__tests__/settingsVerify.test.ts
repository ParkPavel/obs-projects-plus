import {
  canonical,
  classifyDisk,
  payloadMatches,
  stableStringify,
} from "src/lib/settings/settingsVerify";

/**
 * #199 — the comparison that decides whether a write really happened.
 *
 * Three ways to get this wrong, and two of them are worse than no check at all:
 * miss a write that did not land (the defect), call a good write a failure
 * because the host formatted the file its own way, or call somebody else's
 * write a failure and then overwrite it on retry.
 */

describe("#199 — verifying the settings write", () => {
  it("accepts the file the host wrote, whatever order it put the keys in", () => {
    const written = { version: 4, projects: [{ id: "a", name: "One" }] };
    const raw = '{\n  "projects": [{"name": "One", "id": "a"}],\n  "version": 4\n}\n';

    expect(payloadMatches(written, raw)).toBe(true);
  });

  it("compares what JSON would persist, not the object in memory", () => {
    // A Date is written as a string and read back as one. Comparing the live
    // object against that would fail a perfectly good save — and view config is
    // `Record<string, any>`, so a Date can legally be in there.
    const at = new Date("2026-09-06T12:00:00.000Z");
    const written = { config: { updatedAt: at, ratio: NaN, gone: undefined } };
    const raw = '{"config":{"updatedAt":"2026-09-06T12:00:00.000Z","ratio":null}}';

    expect(payloadMatches(written, raw)).toBe(true);
  });

  it("rejects the file that was never updated", () => {
    const previous = canonical({ version: 4, name: "Old name" });
    const written = { version: 4, name: "New name" };
    const raw = '{"version": 4, "name": "Old name"}';

    expect(classifyDisk(written, raw, previous)).toBe("not-written");
  });

  it("does not blame this writer for someone else's file", () => {
    // A second window or a synchroniser replaced data.json between the write
    // and the read-back. Retrying here would overwrite their change.
    const previous = canonical({ version: 4, name: "Old name" });
    const written = { version: 4, name: "Mine" };
    const raw = '{"version": 4, "name": "Theirs"}';

    expect(classifyDisk(written, raw, previous)).toBe("superseded");
  });

  it("without a previous snapshot, a mismatch is read as a failed write", () => {
    const written = { version: 4, name: "Mine" };

    expect(classifyDisk(written, '{"version":4,"name":"Other"}', null)).toBe(
      "not-written"
    );
  });

  it("rejects a half-written file rather than throwing on it", () => {
    const written = { version: 4, projects: [] };

    expect(classifyDisk(written, '{"version": 4, "projects": [', null)).toBe(
      "not-written"
    );
    expect(classifyDisk(written, "", null)).toBe("not-written");
  });

  it("keeps array order significant while key order is not", () => {
    const written = { views: ["a", "b"] };

    expect(payloadMatches(written, '{"views":["a","b"]}')).toBe(true);
    expect(payloadMatches(written, '{"views":["b","a"]}')).toBe(false);
  });

  it("distinguishes null from absent, which JSON does too", () => {
    expect(payloadMatches({ a: null }, '{"a":null}')).toBe(true);
    expect(payloadMatches({ a: null }, "{}")).toBe(false);
  });

  it("treats a value JSON cannot represent as never written", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;

    expect(canonical(cyclic)).toBeNull();
    expect(classifyDisk(cyclic, "{}", null)).toBe("not-written");
  });

  it("is stable for nested structures", () => {
    const one = stableStringify({ b: { d: 1, c: [2, { f: 3, e: 4 }] }, a: 0 });
    const two = stableStringify({ a: 0, b: { c: [2, { e: 4, f: 3 }] , d: 1 } });

    expect(one).toBe(two);
  });
});
