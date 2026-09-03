/**
 * R0.18 — one aggregation kernel, one vocabulary (#180 T5,
 * `SPEC_MATH_SPREADSHEET_2026-09-02` §6 invariants I-1, I-4, I-5).
 *
 * #180 existed because three modules each reduced a list to a number and
 * disagreed: `"12abc"` was 12 in the kernel and nothing in the footer, `""`
 * summed as 0 in the pipeline and was dropped in the footer, and every one of
 * them pushed a literal `NaN` into `SUM`. The four steps that fixed it are
 * worth nothing if a fourth implementation can appear the same way the third
 * did — quietly, in a file nobody was reviewing for that.
 *
 * Three rules, one per way it happened before:
 *
 *   - **The math lives in one place.** A `case "SUM"`-shaped branch outside the
 *     kernel is how `computeAggFn` came to exist.
 *   - **A stored vocabulary is append-only.** Removing a member of
 *     `ColumnAggregation` or `AggregationFunction` orphans every config that
 *     stored it, and `count` is the cautionary case: renamed in R5-004, kept in
 *     the union, unhandled in the switch, silently rendering nothing until
 *     #180d.
 *   - **A picker reads the shared table.** Six surfaces kept six lists and six
 *     sets of labels, and they disagreed about what `count_total` is called.
 *
 * ## Where this ratchet is BLIND — stated up front
 *
 * It is a text scan. It cannot see math written without a `case` label, a
 * vocabulary member built by string concatenation, or an option list assembled
 * at runtime. It is a tripwire against the SHAPE the failure took, not a proof;
 * the proof is the contract test and the parity snapshot.
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");

/** The one module allowed to implement a reduction. */
const KERNEL = "lib/engine/aggregate.ts";

/**
 * Modules that may name canonical operators in a `case` without implementing
 * them, each with the reason.
 */
const BOUNDARIES: ReadonlyArray<readonly [string, string]> = [
  ["lib/dashboard-engine/aggregation.ts", "the footer's adapter: counts and dates the kernel has no name for"],
  ["lib/dashboard-engine/transformExecutor.ts", "the pipeline's adapter: FIRST/LAST/STD_DEV have no kernel equivalent"],
  ["lib/dashboard-engine/aggregationOptions.ts", "the option table: names, not math"],
  ["lib/dashboard-engine/chartDataPipeline.ts", "maps a chart's axis choice onto a stored name"],
  ["lib/database/rollupMode.ts", "maps a picker's mode onto a stored name"],
];

/** Operator names whose appearance in a `case` means someone is reducing. */
const OPERATORS = [
  "sum",
  "avg",
  "median",
  "count_unique",
  "percent_empty",
  "percent_not_empty",
  "SUM",
  "AVG",
  "MEDIAN",
  "COUNT_DISTINCT",
];

const CASE_OF = (op: string) => new RegExp(`case\\s+["']${op}["']\\s*:`);

/** Every `.ts` / `.svelte` under `dir`, excluding test and mock trees. */
function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      collectFiles(full, out);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".svelte")) {
      out.push(full);
    }
  }
  return out;
}

const rel = (f: string) => path.relative(SRC, f).replace(/\\/g, "/");

/** Files that branch on a canonical operator name. */
export function reducingFiles(files: readonly string[]): string[] {
  return files
    .filter((f) => {
      const text = fs.readFileSync(f, "utf8");
      return OPERATORS.some((op) => CASE_OF(op).test(text));
    })
    .map(rel);
}

describe("R0.18 — the scan itself (synthetic, proves BOTH states)", () => {
  it("sees a case on an operator and ignores the word in prose", () => {
    expect(CASE_OF("sum").test('case "sum": return total;')).toBe(true);
    expect(CASE_OF("sum").test("// the sum of the numbers")).toBe(false);
    expect(CASE_OF("SUM").test("case 'SUM':")).toBe(true);
  });
});

describe("R0.18 — the tree", () => {
  const files = collectFiles(SRC);

  it("scans a non-trivial number of files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("only the kernel and the declared boundaries branch on an operator", () => {
    const allowed = new Set([KERNEL, ...BOUNDARIES.map(([f]) => f)]);
    expect(reducingFiles(files).filter((f) => !allowed.has(f))).toEqual([]);
  });

  it("every declared boundary still exists and still branches", () => {
    // A declared exemption that has drifted silently widens the allowlist.
    for (const [file, why] of BOUNDARIES) {
      const full = path.join(SRC, file);
      expect({ file, why, exists: fs.existsSync(full) }).toEqual({ file, why, exists: true });
    }
  });

  it("the kernel actually implements the operators", () => {
    // Otherwise this could pass over a tree where nothing aggregates at all.
    const text = fs.readFileSync(path.join(SRC, KERNEL), "utf8");
    for (const op of ["sum", "avg", "median", "count_unique"]) {
      expect({ op, has: CASE_OF(op).test(text) }).toEqual({ op, has: true });
    }
  });
});

describe("R0.18 — a stored vocabulary is append-only", () => {
  /** The string members of a union declared as `export type X = | "a" | "b"`. */
  function unionMembers(file: string, typeName: string): string[] {
    const text = fs.readFileSync(path.join(SRC, file), "utf8");
    const start = text.indexOf(`export type ${typeName} =`);
    expect({ typeName, found: start >= 0 }).toEqual({ typeName, found: true });
    const end = text.indexOf(";", start);
    return [...text.slice(start, end).matchAll(/"([a-z_A-Z]+)"/g)].map((m) => m[1] as string);
  }

  it("ColumnAggregation still carries every member a config may hold", () => {
    // Removing one orphans every stored config that names it. `count` is the
    // cautionary member: renamed in R5-004, kept here, and unhandled in the
    // footer's switch until #180d — a value that rendered as nothing.
    const members = unionMembers("ui/views/Dashboard/types.ts", "ColumnAggregation");
    for (const required of [
      "none",
      "count",
      "count_total",
      "count_values",
      "count_numeric",
      "count_unique",
      "count_empty",
      "sum",
      "avg",
      "median",
      "min",
      "max",
      "range",
      "count_checked",
      "count_unchecked",
      "percent_checked",
      "percent_unchecked",
      "percent_empty",
      "percent_not_empty",
      "earliest",
      "latest",
      "date_range",
    ]) {
      expect({ required, present: members.includes(required) }).toEqual({ required, present: true });
    }
  });

  it("AggregationFunction still carries every name a stored pipeline step may hold", () => {
    const members = unionMembers("lib/dashboard-engine/transformTypes.ts", "AggregationFunction");
    for (const required of [
      "COUNT",
      "COUNT_DISTINCT",
      "SUM",
      "AVG",
      "MEDIAN",
      "MIN",
      "MAX",
      "RANGE",
      "FIRST",
      "LAST",
      "STD_DEV",
      "PCT_EMPTY",
      "PCT_NOT_EMPTY",
    ]) {
      expect({ required, present: members.includes(required) }).toEqual({ required, present: true });
    }
  });
});

describe("R0.18 — a picker reads the shared table", () => {
  const OPTION_TABLE = "lib/dashboard-engine/aggregationOptions.ts";

  it("no component keeps a list of its own", () => {
    // Six surfaces kept six lists, and they disagreed about what count_total
    // is called. A `.svelte` file naming three or more canonical operators in
    // one place is building a list.
    const names = [
      "count_total",
      "count_values",
      "count_unique",
      "percent_empty",
      "percent_not_empty",
      "count_checked",
    ];
    const offenders = collectFiles(SRC)
      .filter((f) => f.endsWith(".svelte"))
      .filter((f) => {
        const text = fs.readFileSync(f, "utf8");
        return names.filter((n) => text.includes(`"${n}"`)).length >= 3;
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("the shared table describes every member of the stored vocabulary", () => {
    // An option the table does not know renders as a blank line in a picker.
    const table = fs.readFileSync(path.join(SRC, OPTION_TABLE), "utf8");
    const types = fs.readFileSync(path.join(SRC, "ui/views/Dashboard/types.ts"), "utf8");
    const start = types.indexOf("export type ColumnAggregation =");
    const members = [
      ...types.slice(start, types.indexOf(";", start)).matchAll(/"([a-z_]+)"/g),
    ].map((m) => m[1] as string);
    const missing = members.filter((m) => !table.includes(`value: "${m}"`));
    expect(missing).toEqual([]);
  });
});
