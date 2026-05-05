/**
 * filterEvaluator — engine-layer canonical guard (REFACTOR-104).
 *
 * Pins the public engine surface (`evaluateFilter`, `matchesCondition`,
 * `matchesFilterConditions`) and the operator tables. Complements the
 * existing UI-layer suite in `src/ui/app/filterFunctions.test.ts`.
 *
 * AC#3 of REFACTOR-104: ≥60 cases. AC#1: R2.1c semantics — negative
 * operators on undefined fields return TRUE.
 */

import {
  evaluateFilter,
  matchesCondition,
  matchesFilterConditions,
  applyFilter,
  baseFns,
  stringFns,
  numberFns,
  booleanFns,
  dateFns,
  listFns,
} from "../filterEvaluator";
import type {
  DataFrame,
  DataRecord,
  DataValue,
  Optional,
} from "src/lib/dataframe/dataframe";
import type { FilterCondition, FilterDefinition } from "src/settings/settings";

const rec = (values: Record<string, Optional<DataValue>>, id = "r.md"): DataRecord => ({ id, values });
const cond = (field: string, operator: string, value?: string): FilterCondition =>
  ({ field, operator, value } as FilterCondition);
const filter = (
  conditions: FilterCondition[],
  conjunction: "and" | "or" = "and",
  groups?: FilterDefinition[]
): FilterDefinition => {
  const def = { conjunction, conditions } as FilterDefinition;
  if (groups) (def as { groups?: FilterDefinition[] }).groups = groups;
  return def;
};

describe("evaluateFilter — engine surface", () => {
  // ── baseFns (4) ──────────────────────────────────────
  test("is-empty matches undefined", () => {
    expect(baseFns["is-empty"](undefined)).toBe(true);
  });
  test("is-empty matches empty array", () => {
    expect(baseFns["is-empty"]([])).toBe(true);
  });
  test("is-not-empty rejects null", () => {
    expect(baseFns["is-not-empty"](null)).toBe(false);
  });
  test("is-not-empty accepts zero", () => {
    expect(baseFns["is-not-empty"](0)).toBe(true);
  });

  // ── stringFns (8) ────────────────────────────────────
  test("is — equality", () => {
    expect(stringFns.is("foo", "foo")).toBe(true);
  });
  test("is — mismatch", () => {
    expect(stringFns.is("foo", "bar")).toBe(false);
  });
  test("contains — case-insensitive", () => {
    expect(stringFns.contains("Hello World", "WORLD")).toBe(true);
  });
  test("not-contains — undefined left → true", () => {
    expect(stringFns["not-contains"](undefined, "x")).toBe(true);
  });
  test("starts-with — case-insensitive", () => {
    expect(stringFns["starts-with"]("ProjectX", "project")).toBe(true);
  });
  test("ends-with — case-insensitive", () => {
    expect(stringFns["ends-with"]("ProjectX", "ECTX")).toBe(true);
  });
  test("starts-with — false", () => {
    expect(stringFns["starts-with"]("foo", "bar")).toBe(false);
  });
  test("is-not — undefined left → true", () => {
    expect(stringFns["is-not"](undefined, "x")).toBe(true);
  });

  // ── numberFns (8) ────────────────────────────────────
  test("eq", () => expect(numberFns.eq(5, 5)).toBe(true));
  test("neq", () => expect(numberFns.neq(5, 6)).toBe(true));
  test("lt true", () => expect(numberFns.lt(3, 5)).toBe(true));
  test("lt false", () => expect(numberFns.lt(5, 3)).toBe(false));
  test("gt true", () => expect(numberFns.gt(7, 4)).toBe(true));
  test("lte boundary", () => expect(numberFns.lte(5, 5)).toBe(true));
  test("gte boundary", () => expect(numberFns.gte(5, 5)).toBe(true));
  test("eq with undefined", () => expect(numberFns.eq(undefined, 5)).toBe(false));

  // ── booleanFns (4) ───────────────────────────────────
  test("is-checked true", () => expect(booleanFns["is-checked"](true)).toBe(true));
  test("is-checked undef", () => expect(booleanFns["is-checked"](undefined)).toBe(false));
  test("is-not-checked false", () => expect(booleanFns["is-not-checked"](false)).toBe(true));
  test("is-not-checked undef", () => expect(booleanFns["is-not-checked"](undefined)).toBe(false));

  // ── dateFns absolute (6) ─────────────────────────────
  test("is-on same day", () => {
    expect(dateFns["is-on"](new Date("2025-06-15"), "2025-06-15")).toBe(true);
  });
  test("is-on different day", () => {
    expect(dateFns["is-on"](new Date("2025-06-15"), "2025-06-16")).toBe(false);
  });
  test("is-before", () => {
    expect(dateFns["is-before"](new Date("2025-06-10"), "2025-06-15")).toBe(true);
  });
  test("is-after", () => {
    expect(dateFns["is-after"](new Date("2025-06-20"), "2025-06-15")).toBe(true);
  });
  test("is-on-and-before — same day", () => {
    expect(dateFns["is-on-and-before"](new Date("2025-06-15"), "2025-06-15")).toBe(true);
  });
  test("is-on-and-after — same day", () => {
    expect(dateFns["is-on-and-after"](new Date("2025-06-15"), "2025-06-15")).toBe(true);
  });

  // ── dateFns relative — null guards (5) ───────────────
  test("is-today rejects undefined", () => {
    expect(dateFns["is-today"](undefined)).toBe(false);
  });
  test("is-overdue rejects undefined", () => {
    expect(dateFns["is-overdue"](undefined)).toBe(false);
  });
  test("is-last-n-days rejects n=0", () => {
    expect(dateFns["is-last-n-days"](new Date(), "0")).toBe(false);
  });
  test("is-next-n-days rejects negative n", () => {
    expect(dateFns["is-next-n-days"](new Date(), "-3")).toBe(false);
  });
  test("is-last-n-days within window", () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    expect(dateFns["is-last-n-days"](yesterday, "7")).toBe(true);
  });

  // ── listFns (6) ──────────────────────────────────────
  test("has-any-of — match", () => {
    expect(listFns["has-any-of"](["a", "b"], ["b", "c"])).toBe(true);
  });
  test("has-any-of — no match", () => {
    expect(listFns["has-any-of"](["a", "b"], ["c"])).toBe(false);
  });
  test("has-all-of — full subset", () => {
    expect(listFns["has-all-of"](["a", "b", "c"], ["a", "b"])).toBe(true);
  });
  test("has-all-of — partial fails", () => {
    expect(listFns["has-all-of"](["a"], ["a", "b"])).toBe(false);
  });
  test("has-none-of — none present → true", () => {
    expect(listFns["has-none-of"](["a"], ["b", "c"])).toBe(true);
  });
  test("has-keyword — case-insensitive", () => {
    expect(listFns["has-keyword"](["Alice", "Bob"], "ali")).toBe(true);
  });

  // ── matchesCondition — type dispatch (6) ─────────────
  test("string field via contains", () => {
    expect(matchesCondition(cond("title", "contains", "hello"), rec({ title: "Hello World" }))).toBe(true);
  });
  test("number field via gt", () => {
    expect(matchesCondition(cond("priority", "gt", "3"), rec({ priority: 5 }))).toBe(true);
  });
  test("boolean field via is-checked", () => {
    expect(matchesCondition(cond("done", "is-checked"), rec({ done: true }))).toBe(true);
  });
  test("array field — string is — ANY match", () => {
    expect(matchesCondition(cond("tags", "is", "alpha"), rec({ tags: ["alpha", "beta"] }))).toBe(true);
  });
  test("array field — string is-not — ALL must differ", () => {
    expect(matchesCondition(cond("tags", "is-not", "gamma"), rec({ tags: ["alpha", "beta"] }))).toBe(true);
  });
  test("empty array — affirmative string op → false", () => {
    expect(matchesCondition(cond("tags", "contains", "x"), rec({ tags: [] }))).toBe(false);
  });

  // ── R2.1c — undefined value semantics (8) ────────────
  test("undefined + is-not → true", () => {
    expect(matchesCondition(cond("missing", "is-not", "x"), rec({}))).toBe(true);
  });
  test("undefined + not-contains → true", () => {
    expect(matchesCondition(cond("missing", "not-contains", "x"), rec({}))).toBe(true);
  });
  test("undefined + is-not-on → true", () => {
    expect(matchesCondition(cond("missing", "is-not-on", "2025-01-01"), rec({}))).toBe(true);
  });
  test("undefined + neq → true", () => {
    expect(matchesCondition(cond("missing", "neq", "0"), rec({}))).toBe(true);
  });
  test("undefined + has-none-of → true", () => {
    expect(matchesCondition(cond("missing", "has-none-of", "[]"), rec({}))).toBe(true);
  });
  test("undefined + is → false", () => {
    expect(matchesCondition(cond("missing", "is", "x"), rec({}))).toBe(false);
  });
  test("undefined + contains → false", () => {
    expect(matchesCondition(cond("missing", "contains", "x"), rec({}))).toBe(false);
  });
  test("null behaves like undefined for negative ops", () => {
    expect(matchesCondition(cond("f", "is-not", "x"), rec({ f: null }))).toBe(true);
  });

  // ── matchesFilterConditions — composition (6) ────────
  test("AND with all true", () => {
    const f = filter([cond("a", "is", "1"), cond("b", "is", "2")]);
    expect(matchesFilterConditions(f, rec({ a: "1", b: "2" }))).toBe(true);
  });
  test("AND with one false → false", () => {
    const f = filter([cond("a", "is", "1"), cond("b", "is", "X")]);
    expect(matchesFilterConditions(f, rec({ a: "1", b: "2" }))).toBe(false);
  });
  test("OR with one true → true", () => {
    const f = filter([cond("a", "is", "X"), cond("b", "is", "2")], "or");
    expect(matchesFilterConditions(f, rec({ a: "1", b: "2" }))).toBe(true);
  });
  test("OR with all false → false", () => {
    const f = filter([cond("a", "is", "X"), cond("b", "is", "Y")], "or");
    expect(matchesFilterConditions(f, rec({ a: "1", b: "2" }))).toBe(false);
  });
  test("empty filter → true (no constraint)", () => {
    expect(matchesFilterConditions(filter([]), rec({}))).toBe(true);
  });
  test("disabled condition is ignored", () => {
    const c: FilterCondition = { field: "a", operator: "is", value: "X", enabled: false } as FilterCondition;
    expect(matchesFilterConditions(filter([c]), rec({ a: "1" }))).toBe(true);
  });

  // ── Nested groups (3) ────────────────────────────────
  test("group-AND under top-OR", () => {
    const inner = filter([cond("a", "is", "1"), cond("b", "is", "2")]);
    const top = filter([cond("z", "is", "X")], "or", [inner]);
    expect(matchesFilterConditions(top, rec({ a: "1", b: "2", z: "Q" }))).toBe(true);
  });
  test("group-OR under top-AND", () => {
    const inner = filter([cond("a", "is", "X"), cond("b", "is", "2")], "or");
    const top = filter([cond("z", "is", "Q")], "and", [inner]);
    expect(matchesFilterConditions(top, rec({ a: "1", b: "2", z: "Q" }))).toBe(true);
  });
  test("recursion depth guard (>20 → true)", () => {
    let g: FilterDefinition = filter([cond("a", "is", "X")]);
    for (let i = 0; i < 25; i++) g = filter([], "and", [g]);
    expect(matchesFilterConditions(g, rec({}))).toBe(true);
  });

  // ── evaluateFilter alias parity (3) ──────────────────
  test("evaluateFilter agrees with matchesFilterConditions — true", () => {
    const f = filter([cond("a", "is", "1")]);
    const r = rec({ a: "1" });
    expect(evaluateFilter(r, f)).toBe(matchesFilterConditions(f, r));
  });
  test("evaluateFilter agrees with matchesFilterConditions — false", () => {
    const f = filter([cond("a", "is", "X")]);
    const r = rec({ a: "1" });
    expect(evaluateFilter(r, f)).toBe(matchesFilterConditions(f, r));
  });
  test("evaluateFilter — undefined R2.1c parity", () => {
    const f = filter([cond("missing", "is-not", "x")]);
    expect(evaluateFilter(rec({}), f)).toBe(true);
  });

  // ── applyFilter (3) ──────────────────────────────────
  test("applyFilter retains matching records", () => {
    const df: DataFrame = {
      fields: [],
      records: [rec({ a: "1" }, "a"), rec({ a: "2" }, "b"), rec({ a: "3" }, "c")],
    };
    const out = applyFilter(df, filter([cond("a", "is", "2")]));
    expect(out.records.map(r => r.id)).toEqual(["b"]);
  });
  test("applyFilter empty filter passes all", () => {
    const df: DataFrame = { fields: [], records: [rec({}, "a"), rec({}, "b")] };
    const out = applyFilter(df, filter([]));
    expect(out.records).toHaveLength(2);
  });
  test("applyFilter does not mutate input", () => {
    const df: DataFrame = { fields: [], records: [rec({ a: "1" }, "a")] };
    applyFilter(df, filter([cond("a", "is", "X")]));
    expect(df.records).toHaveLength(1);
  });

  // ── List JSON parsing safety (2) ─────────────────────
  test("malformed JSON value falls back to undefined", () => {
    expect(matchesCondition(cond("tags", "has-any-of", "{not-json"), rec({ tags: ["a"] }))).toBe(false);
  });
  test("valid JSON array parsed for has-any-of", () => {
    expect(matchesCondition(cond("tags", "has-any-of", '["b"]'), rec({ tags: ["a", "b"] }))).toBe(true);
  });
});
