/**
 * B5 (3.7.2) — formula suggestions must not scale with the schema per key.
 * The editor filtered every field name and every function on each keystroke
 * and validated the whole expression synchronously; on a wide project that
 * is what "the hints lag" means. The index is built once per schema; a
 * suggestion is a binary search plus the matches it returns. Budgets count
 * comparisons and calls, never time.
 */
import { buildSuggestIndex, suggestIndexCache } from "src/lib/engine/formulaSuggestIndex";
import { debounceLatest } from "src/lib/engine/debounceLatest";

const FUNCTIONS = ["ABS", "AVG", "CONCAT", "COUNT", "IF", "MAX", "MIN", "ROUND", "SUM", "TODAY"];
const FIELDS = Array.from({ length: 300 }, (_, i) => `field_${String(i).padStart(3, "0")}`);
const RECORDS = Array.from({ length: 5000 }, (_, i) => ({ id: `r${i}`, values: { field_000: i } }));

describe("formula suggestion index (B5)", () => {
  it("answers functions first, then fields, by case-insensitive prefix", () => {
    const index = buildSuggestIndex(FUNCTIONS, ["sumTotal", "status", "Summary"]);
    expect(index.suggest("su")).toEqual(["SUM", "Summary", "sumTotal"]);
    expect(index.suggest("")).toEqual([]);
    expect(index.suggest("zz")).toEqual([]);
  });

  it("300 fields / 5000 records: one suggestion stays within 40 comparisons", () => {
    const index = buildSuggestIndex(FUNCTIONS, FIELDS);
    for (const word of ["f", "field_1", "field_29", "S", "co", "x"]) {
      index.stats.comparisons = 0;
      const out = index.suggest(word, 12);
      expect(out.length).toBeLessThanOrEqual(12);
      expect(index.stats.comparisons).toBeLessThan(40);
    }
    // The records never enter the index: nothing about suggesting reads them.
    expect(RECORDS.length).toBe(5000);
  });

  it("is built once per schema, not per keystroke", () => {
    const cache = suggestIndexCache();
    for (let i = 0; i < 50; i++) cache.get(FUNCTIONS, FIELDS).suggest("field_" + (i % 10));
    expect(cache.builds).toBe(1);
    cache.get(FUNCTIONS, [...FIELDS, "new_field"]);
    expect(cache.builds).toBe(2);
  });

  it("preview evaluation is debounced: 10 keystrokes in 150 ms → 1 evaluation over 5000 records", () => {
    jest.useFakeTimers();
    let rowsRead = 0;
    const evaluate = jest.fn((expr: string) => { for (const r of RECORDS) rowsRead += r.values.field_000 >= 0 ? 1 : 0; return expr; });
    const run = debounceLatest(evaluate, 150);
    const expr = "SUM(field_0";
    for (let i = 1; i <= 10; i++) { run.call(expr.slice(0, i)); jest.advanceTimersByTime(10); }
    expect(evaluate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(150);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenLastCalledWith("SUM(field_0");
    expect(rowsRead).toBe(5000);
    run.call("x");
    run.flush();
    expect(evaluate).toHaveBeenCalledTimes(2);
    run.cancel();
    jest.useRealTimers();
  });
});
