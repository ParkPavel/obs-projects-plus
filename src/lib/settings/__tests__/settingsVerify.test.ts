import {
  payloadMatches,
  stableStringify,
} from "src/lib/settings/settingsVerify";

/**
 * #199 — the comparison that decides whether a write really happened.
 *
 * Two ways to get this wrong, and both are worse than no check at all: miss a
 * write that did not land (the defect), or call a successful write a failure
 * because the host formatted the file its own way (a chip that cries wolf,
 * which teaches the user to ignore the one that matters).
 */

describe("#199 — verifying the settings write", () => {
  it("accepts the file the host wrote, whatever order it put the keys in", () => {
    const written = { version: 4, projects: [{ id: "a", name: "One" }] };
    const raw = '{\n  "projects": [{"name": "One", "id": "a"}],\n  "version": 4\n}\n';

    expect(payloadMatches(written, raw)).toBe(true);
  });

  it("rejects the file that was never updated", () => {
    const written = { version: 4, projects: [{ id: "a", name: "New name" }] };
    const raw = '{"version": 4, "projects": [{"id": "a", "name": "Old name"}]}';

    expect(payloadMatches(written, raw)).toBe(false);
  });

  it("rejects a half-written file rather than throwing on it", () => {
    const written = { version: 4, projects: [] };

    // A write cut in half is the case worth catching, and it must travel the
    // same path as any other failed write.
    expect(payloadMatches(written, '{"version": 4, "projects": [')).toBe(false);
    expect(payloadMatches(written, "")).toBe(false);
  });

  it("keeps array order significant while key order is not", () => {
    const written = { views: ["a", "b"] };

    expect(payloadMatches(written, '{"views":["a","b"]}')).toBe(true);
    expect(payloadMatches(written, '{"views":["b","a"]}')).toBe(false);
  });

  it("treats a dropped undefined as no difference, because the round trip drops it", () => {
    const written = { version: 4, missing: undefined };

    expect(payloadMatches(written, '{"version":4}')).toBe(true);
  });

  it("distinguishes null from absent, which JSON does too", () => {
    expect(payloadMatches({ a: null }, '{"a":null}')).toBe(true);
    expect(payloadMatches({ a: null }, "{}")).toBe(false);
  });

  it("is stable for nested structures", () => {
    const one = stableStringify({ b: { d: 1, c: [2, { f: 3, e: 4 }] }, a: 0 });
    const two = stableStringify({ a: 0, b: { c: [2, { e: 4, f: 3 }], d: 1 } });

    expect(one).toBe(two);
  });
});
