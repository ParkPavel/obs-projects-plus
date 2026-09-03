/**
 * One description of every aggregation, and one rule for which are offered
 * (#180 T4, `SPEC_MATH_SPREADSHEET_2026-09-02` §5).
 *
 * ## The problem this replaces
 *
 * Six surfaces offered aggregations and each kept its own list and its own
 * labels: the pipeline editor, the Stats card config, the table header menu,
 * the chart's Y axis, the rollup field dialogs, and the inline badge on a
 * widget. They disagreed. The chart offered `count_total` labelled through an
 * i18n key called `…aggregations.count`; the badge printed `COUNT` for both
 * `count_total` and `count_values`, re-introducing the ambiguity the picker had
 * just resolved; the Stats card called `count_total` simply "Count".
 *
 * And "Count" alone is the ambiguity. No reference product ships it: Excel has
 * COUNT/COUNTA/COUNTBLANK, Sheets adds COUNTUNIQUE, Airtable names three
 * functions, Notion offers five options. A user choosing "Count" cannot know
 * whether an empty cell is in the answer, and the two readings differ by
 * exactly the rows they care about.
 *
 * ## The rule
 *
 * Every option carries a NAME and a CONSEQUENCE — one line saying what it does
 * to the rows that are empty, because that is the only question a count has.
 * The consequence is not decoration: it is the thing that makes the choice
 * checkable without running it.
 *
 * `aggregationOptionsFor` is the other half. You cannot mis-select what is not
 * offered, so a Text field is not shown `sum` and a Number field is not shown
 * `count_checked`. The table header menu has gated its options by type since
 * before this ticket; this generalises that one good habit to every surface.
 */

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import type { RollupFunction } from "src/lib/engine/aggregate";
import type { ColumnAggregation } from "src/ui/views/Dashboard/types";

/**
 * Every name the product shows a user for "reduce this column".
 *
 * Two vocabularies reach a picker: `ColumnAggregation` (stats cards, table
 * footer) and `RollupFunction` (rollup fields). They overlap heavily and are
 * stored separately, so they stay separate types — but a user reading a label
 * does not care which union it came from, and neither should the table.
 */
export type AggregationName = ColumnAggregation | RollupFunction;

export interface AggregationOption {
  readonly value: AggregationName;
  /** The name shown in a picker. Never bare "Count". */
  readonly label: string;
  /** One line: what this does with the rows that have nothing in them. */
  readonly consequence: string;
  /** The compact form for an inline badge. */
  readonly badge: string;
}

/**
 * Every aggregation, described once.
 *
 * `count` is here although it is a legacy spelling: R5-004 renamed it to
 * `count_total` and the migration handles stored configs, but the member was
 * never removed from the union — and `computeColumn` had no branch for it, so
 * a stored `count` that ever escaped the migrator rendered as "—" with no
 * warning. It is interpreted now rather than silently unhandled.
 */
export const AGGREGATIONS: ReadonlyArray<AggregationOption> = [
  { value: "none", label: "None", consequence: "No summary for this column", badge: "" },

  // ── the count family, which is a family everywhere ──
  { value: "count_total", label: "Count all", consequence: "Every record, including ones with nothing in this field", badge: "COUNT ALL" },
  { value: "count", label: "Count all", consequence: "Every record, including ones with nothing in this field (legacy spelling of Count all)", badge: "COUNT ALL" },
  { value: "count_values", label: "Count values", consequence: "Records where this field has something in it", badge: "VALUES" },
  { value: "count_numeric", label: "Count numbers", consequence: "Values this field can do arithmetic on", badge: "NUMBERS" },
  { value: "count_unique", label: "Count unique", consequence: "How many different values, empties excluded", badge: "UNIQUE" },
  { value: "count_empty", label: "Count empty", consequence: "Records where this field is blank", badge: "EMPTY" },

  // ── checkboxes ──
  { value: "count_checked", label: "Checked", consequence: "How many are ticked", badge: "✓" },
  { value: "count_unchecked", label: "Unchecked", consequence: "How many are unticked", badge: "✗" },
  { value: "percent_checked", label: "Percent checked", consequence: "Share of the boxes that are ticked", badge: "%✓" },
  { value: "percent_unchecked", label: "Percent unchecked", consequence: "Share of the boxes that are unticked", badge: "%✗" },

  // ── shares ──
  { value: "percent_empty", label: "Percent empty", consequence: "Share of records with nothing in this field", badge: "%∅" },
  { value: "percent_not_empty", label: "Percent filled", consequence: "Share of records with something in this field", badge: "%¬∅" },

  // ── numbers ──
  { value: "sum", label: "Sum", consequence: "Total of the numbers; text is ignored", badge: "SUM" },
  { value: "avg", label: "Average", consequence: "Mean of the numbers; empty cells are not counted in", badge: "AVG" },
  { value: "median", label: "Median", consequence: "Middle number; text is ignored", badge: "MEDIAN" },
  { value: "min", label: "Min", consequence: "Smallest number; empty when there is none", badge: "MIN" },
  { value: "max", label: "Max", consequence: "Largest number; empty when there is none", badge: "MAX" },
  { value: "range", label: "Range", consequence: "Largest minus smallest", badge: "RANGE" },

  // ── rollup-only names (the kernel vocabulary a Rollup field picks from) ──
  { value: "percent_true", label: "Percent checked", consequence: "Share of the boxes that are ticked", badge: "%✓" },
  { value: "concat", label: "Concatenate", consequence: "Every value joined into one line", badge: "JOIN" },
  { value: "concat_unique", label: "Concatenate unique", consequence: "Each different value once, joined into one line", badge: "JOIN∪" },
  { value: "show_original", label: "Show original", consequence: "The values themselves, as a list", badge: "SHOW" },
  { value: "show_unique", label: "Show unique values", consequence: "Each different value once, as a list", badge: "SHOW∪" },

  // ── dates ──
  { value: "earliest", label: "Earliest date", consequence: "Oldest date in the column", badge: "EARLIEST" },
  { value: "latest", label: "Latest date", consequence: "Newest date in the column", badge: "LATEST" },
  { value: "date_range", label: "Date range", consequence: "From the earliest to the latest", badge: "RANGE" },
];

const BY_VALUE = new Map(AGGREGATIONS.map((o) => [o.value, o]));

/** The description of one aggregation, or `undefined` for a name nothing knows. */
export function aggregationOption(value: AggregationName): AggregationOption | undefined {
  return BY_VALUE.get(value);
}

/** Compact form for a badge. Falls back to the raw name rather than to silence. */
export function aggregationBadge(value: AggregationName): string {
  return BY_VALUE.get(value)?.badge ?? String(value).toUpperCase();
}

const NUMERIC_TYPES: ReadonlySet<DataFieldType> = new Set([
  DataFieldType.Number,
  DataFieldType.Formula,
  DataFieldType.Rollup,
]);

const DATE_TYPES: ReadonlySet<DataFieldType> = new Set([
  DataFieldType.Date,
  DataFieldType.AutoTime,
]);

/** What every field can be asked, whatever it holds. */
const ALWAYS: ReadonlyArray<ColumnAggregation> = [
  "count_total",
  "count_values",
  "count_unique",
  "count_empty",
  "percent_empty",
  "percent_not_empty",
];

/**
 * The aggregations worth offering for `field`.
 *
 * You cannot mis-select what is not shown, which is the mechanism §5 asks for:
 * a Text field is not offered `sum`, a Number field is not offered
 * `count_checked`, and `count_numeric` appears only where a number could
 * plausibly be hiding — a Number field, or a text field whose contents nobody
 * has constrained.
 */
export function aggregationOptionsFor(field: DataField): ColumnAggregation[] {
  const out: ColumnAggregation[] = [...ALWAYS];

  if (NUMERIC_TYPES.has(field.type)) {
    out.push("count_numeric", "sum", "avg", "median", "min", "max", "range");
  } else if (field.type === DataFieldType.Boolean) {
    out.push("count_checked", "count_unchecked", "percent_checked", "percent_unchecked");
  } else if (DATE_TYPES.has(field.type)) {
    out.push("earliest", "latest", "date_range");
  } else {
    // Text, List, Select, Status, Unknown: a number may still be hiding in a
    // string, and `count_numeric` is how a user finds out how many.
    out.push("count_numeric");
  }

  return out;
}

/**
 * The order a Rollup field's picker offers its functions in.
 *
 * A picker's ORDER is a design decision and belongs with the design, but the
 * names are still names: keeping them in the component meant two dialogs each
 * held a list, which is how six lists came about in the first place. R0.18
 * enforces that no component holds one.
 */
export const ROLLUP_PICKER_ORDER: ReadonlyArray<RollupFunction> = [
  "show_original",
  "show_unique",
  "count_total",
  "count_values",
  "count_unique",
  "count_empty",
  "count",
  "percent_empty",
  "percent_not_empty",
  "percent_true",
  "sum",
  "avg",
  "min",
  "max",
  "median",
  "range",
  "concat",
  "concat_unique",
];
