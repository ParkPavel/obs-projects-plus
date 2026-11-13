import { changedKeys, sameValue } from "src/lib/recordDiff";

const rec = (values: Record<string, unknown>) =>
  ({ id: "a.md", values }) as unknown as import("src/lib/dataframe/dataframe").DataRecord;

describe("sameValue", () => {
  it("compares dates by time, not identity", () => {
    expect(sameValue(new Date(2026, 3, 10), new Date(2026, 3, 10))).toBe(true);
    expect(sameValue(new Date(2026, 3, 10), new Date(2026, 3, 11))).toBe(false);
  });

  it("does not mix a date with its text", () => {
    expect(sameValue(new Date(2026, 3, 10), "2026-04-10")).toBe(false);
  });

  it("compares arrays and objects structurally", () => {
    expect(sameValue(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameValue(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameValue(["a"], ["a", "b"])).toBe(false);
    expect(sameValue({ x: 1, y: [new Date(5)] }, { y: [new Date(5)], x: 1 })).toBe(true);
    expect(sameValue({ x: 1 }, { x: 2 })).toBe(false);
  });

  it("treats null and undefined as the same absence", () => {
    expect(sameValue(null, undefined)).toBe(true);
    expect(sameValue(undefined, null)).toBe(true);
    expect(sameValue(null, "")).toBe(false);
    expect(sameValue(undefined, 0)).toBe(false);
    expect(sameValue(undefined, false)).toBe(false);
  });

  it("keeps 0, empty text and false apart", () => {
    expect(sameValue(0, "0")).toBe(false);
    expect(sameValue(0, false)).toBe(false);
    expect(sameValue(NaN, NaN)).toBe(true);
  });
});

describe("changedKeys", () => {
  it("is undefined when the previous record is unknown", () => {
    expect(changedKeys(undefined, rec({ a: 1 }))).toBeUndefined();
  });

  it("lists only the keys whose value differs", () => {
    const prev = rec({ since: new Date(2026, 3, 10), source: "a", tags: ["x"] });
    const next = rec({ since: new Date(2026, 3, 10), source: "b", tags: ["x"] });
    expect(changedKeys(prev, next)).toEqual(["source"]);
  });

  it("is empty when nothing differs", () => {
    expect(changedKeys(rec({ a: 1, b: null }), rec({ a: 1 }))).toEqual([]);
  });

  it("counts a key added with a value as changed", () => {
    expect(changedKeys(rec({}), rec({ a: 1 }))).toEqual(["a"]);
  });

  it("counts a key present before and gone now as changed", () => {
    expect(changedKeys(rec({ a: 1, b: 2 }), rec({ a: 1 }))).toEqual(["b"]);
  });

  it("counts a value cleared to null as changed", () => {
    expect(changedKeys(rec({ a: 1 }), rec({ a: null }))).toEqual(["a"]);
  });

  it("treats the same object on both sides as nothing changed", () => {
    const r = rec({ a: 1 });
    expect(changedKeys(r, r)).toEqual([]);
  });
});
