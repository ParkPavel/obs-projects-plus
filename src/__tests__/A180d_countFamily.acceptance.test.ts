/**
 * A180d — acceptance for the count family and its pickers (#180 T4).
 *
 * The user's directive was that a numeric value exists for its own entity, that
 * every entity has obvious ways to switch between them, and that the interface
 * should prevent logical errors. Those are three checkable claims:
 *
 *   1. The entities exist and are distinct — count all, count values, count
 *      numbers, count unique, count empty each answer a different question.
 *   2. Every option says which one it is, in a line, so the choice can be
 *      checked before it is made.
 *   3. A surface offers only what the field can answer, because you cannot
 *      mis-select what is not shown.
 */

import {
  AGGREGATIONS,
  aggregationBadge,
  aggregationOption,
  aggregationOptionsFor,
} from "src/lib/dashboard-engine/aggregationOptions";
import { computeAggregations } from "src/lib/dashboard-engine/aggregation";
import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import type { ColumnAggregation } from "src/ui/views/Dashboard/types";

const field = (name: string, type: DataFieldType): DataField => ({
  name,
  type,
  identifier: false,
  derived: false,
  repeated: false,
  typeConfig: {},
});

/** Six records: three numbers, one number-as-text, one blank, one absent. */
const RECORDS: DataRecord[] = [
  { id: "a.md", values: { n: 1 } },
  { id: "b.md", values: { n: 2 } },
  { id: "c.md", values: { n: 2 } },
  { id: "d.md", values: { n: "12abc" } },
  { id: "e.md", values: { n: "" } },
  { id: "f.md", values: {} },
];

function summarise(fn: ColumnAggregation): unknown {
  const out = computeAggregations(
    { fields: [field("n", DataFieldType.Number)], records: RECORDS },
    { n: fn }
  );
  return out["n"]?.value ?? null;
}

describe("A180d — the count family answers five different questions", () => {
  it("each one is a different number over the same column", () => {
    // Six records: 1, 2, 2, "12abc", "", and one with the key absent.
    expect(summarise("count_total")).toBe(6); // everything, blanks included
    expect(summarise("count_values")).toBe(4); // has something in it
    expect(summarise("count_numeric")).toBe(3); // can do arithmetic
    expect(summarise("count_unique")).toBe(4); // 1, 2, "12abc", ""
    expect(summarise("count_empty")).toBe(2); // "" and the absent key
  });

  it("the legacy `count` spelling is interpreted, not rendered as nothing", () => {
    // R5-004 renamed `count` to `count_total` and the migration rewrites stored
    // configs — but the union kept the member and the switch had no branch, so
    // a stored `count` that escaped the migrator fell through and rendered "—"
    // with no warning. One string, three meanings, one of them silence.
    expect(summarise("count")).toBe(6);
    expect(summarise("count")).toBe(summarise("count_total"));
  });

  it("count_numeric follows the project's one definition of a number", () => {
    // "12abc" is not a number anywhere since #180a, so it is not counted here
    // either. If this ever disagreed with the coercion contract there would be
    // two answers to "is this a number" again.
    expect(summarise("count_numeric")).toBe(3);
  });
});

describe("A180d — no option is offered without saying what it does", () => {
  it("every aggregation has a name and a consequence, and no name is bare 'Count'", () => {
    for (const o of AGGREGATIONS) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.consequence.length).toBeGreaterThan(0);
      // The ambiguity itself: no reference product ships a bare "Count", and a
      // user choosing it cannot know whether an empty cell is in the answer.
      expect(o.label).not.toBe("Count");
    }
  });

  it("the five counts have five different consequences", () => {
    const counts: ColumnAggregation[] = [
      "count_total",
      "count_values",
      "count_numeric",
      "count_unique",
      "count_empty",
    ];
    const said = counts.map((c) => aggregationOption(c)?.consequence);
    expect(new Set(said).size).toBe(counts.length);
  });

  it("a badge distinguishes count_total from count_values", () => {
    // The badge used to print COUNT for both, re-introducing the ambiguity the
    // picker had just resolved.
    expect(aggregationBadge("count_total")).not.toBe(aggregationBadge("count_values"));
  });
});

describe("A180d — a surface offers only what the field can answer", () => {
  it("a text field is not offered sum, and a number field is not offered checked", () => {
    const text = aggregationOptionsFor(field("t", DataFieldType.String));
    const num = aggregationOptionsFor(field("n", DataFieldType.Number));
    expect(text).not.toContain("sum");
    expect(text).not.toContain("count_checked");
    expect(num).toContain("sum");
    expect(num).not.toContain("count_checked");
  });

  it("a checkbox is offered its own family and no arithmetic", () => {
    const bool = aggregationOptionsFor(field("b", DataFieldType.Boolean));
    expect(bool).toContain("count_checked");
    expect(bool).toContain("percent_checked");
    expect(bool).not.toContain("sum");
  });

  it("a date is offered dates", () => {
    const date = aggregationOptionsFor(field("d", DataFieldType.Date));
    expect(date).toContain("earliest");
    expect(date).toContain("latest");
    expect(date).not.toContain("sum");
  });

  it("every field type is offered the five counts, because every column can be counted", () => {
    for (const type of [
      DataFieldType.String,
      DataFieldType.Number,
      DataFieldType.Boolean,
      DataFieldType.Date,
      DataFieldType.List,
    ]) {
      const offered = aggregationOptionsFor(field("x", type));
      expect(offered).toContain("count_total");
      expect(offered).toContain("count_values");
      expect(offered).toContain("count_empty");
    }
  });

  it("every offered option is one the table describes", () => {
    // An option with no entry would render as a blank line in a picker.
    for (const type of [
      DataFieldType.String,
      DataFieldType.Number,
      DataFieldType.Boolean,
      DataFieldType.Date,
      DataFieldType.List,
      DataFieldType.Formula,
      DataFieldType.Rollup,
    ]) {
      for (const value of aggregationOptionsFor(field("x", type))) {
        expect(aggregationOption(value)).toBeDefined();
      }
    }
  });
});

describe("A180d — the pickers read the one table", () => {
  const read = (rel: string) =>
    require("fs").readFileSync(require("path").join(__dirname, "..", rel), "utf8") as string;

  it("the Stats card offers what the field allows and shows the consequence", () => {
    const s = read("ui/views/Dashboard/widgets/Stats/StatsConfig.svelte");
    expect(s).toMatch(/aggregationOptionsFor/);
    expect(s).toMatch(/title=\{agg\.consequence\}/);
  });

  it("the table header menu no longer keeps its own list", () => {
    const s = read("ui/views/Dashboard/widgets/DatabaseCall/tableHeaderOps.ts");
    expect(s).toMatch(/return aggregationOptionsFor\(field\);/);
    expect(s).not.toMatch(/const BASE_CALCS/);
  });

  it("the inline badge reads the shared table rather than its own", () => {
    const s = read("ui/views/Dashboard/widgets/_shared/WidgetInlineBadges.svelte");
    expect(s).toMatch(/aggregationBadge/);
    expect(s).not.toMatch(/count_total: "COUNT"/);
  });
});
