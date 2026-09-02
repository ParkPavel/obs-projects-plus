# SPEC — the project's math at spreadsheet level (#180, 2026-09-02)

> Architect pass (read-only, 17 tool calls) against `main` = `6c6a82f`, written after the user
> re-scoped #180 on 2026-09-02 (`BACKLOG.md` #180, "RESOLVED 2026-09-02 (пользователь)"). Every
> claim cites a file opened in that pass or a URL fetched in it; everything else is in §9 and must
> not be built on. Five USER decisions remain open (§8). Ticket order in §7 is forced.
>
> **Addendum, main session, 2026-09-02:** scenario S9 (§2.1) is now VERIFIED, not UNKNOWN —
> `src/lib/datasources/helpers.ts:38-42` runs `parseFloat(value)` on every string value of a
> `DataFieldType.Number` field at ingest, so `"12abc"` is already `12` and `"abc"` is already `NaN`
> before any aggregate sees them. T1 starts there.

## 0. What changed about this ticket

#180 was "the pipeline calls the kernel". The user's `RESOLVED 2026-09-02` block rejects the second
default of the previous plan (`"12abc"` → 12) and rescopes the ticket to a specification driven by
reference products. That rejection is not a preference; it turns out to be what all four reference
products do, and it invalidates the coercion half of `PLAN_180_AGGREGATION_ADAPTER_2026-09-02.md`
while leaving its divergence analysis intact and useful.

The single most important finding of this pass: **the adapter is the last step, not the first.**
Delegating `computeAggFn` to the kernel today would ship the kernel's `parseFloat` bug to the
pipeline — the exact defect the user refused. Coercion is fixed first, the empty-policy second, the
adapter third.

## 1. Reference review

Every row is a quotation from the page in the URL column, fetched 2026-09-02. Rows the pages did not
state are absent here and appear in §9 — that boundary is the point of the table.

| Question | Excel | Google Sheets | Notion | Airtable |
|---|---|---|---|---|
| Text inside a numeric aggregation | "If a range or cell reference argument contains text, logical values, or empty cells, those values are **ignored**; however, cells with the value zero are included." [1] | "Any text encountered in the `value` arguments will be **ignored**." [2] | (not stated on the page) | (not stated on the page) |
| Logical values (booleans) in AVERAGE | ignored — same sentence [1] | (not stated; `AVERAGEA` named as the text-aware variant [2]) | (not stated) | (not stated) |
| Empty cells in AVERAGE | ignored; "empty cells are not counted, but zero values are" [1] | (not stated) | (not stated) | (not stated) |
| Count-all vs count-values | `COUNTA` "counts cells containing any type of information, including error values and empty text (`""`)"; "if you want to count only cells that contain numbers, use the `COUNT` function"; COUNTA does not count empty cells [3] | `COUNTA` "Returns the number of values in a dataset"; `COUNT` "Returns the number of numeric values in a dataset"; `COUNTBLANK` "Returns the number of empty cells in a given range" [4] | `Count all`: "Counts the total number of values … for all related pages." `Count values`: "Counts the number of **non-empty** values…" `Count not empty` / `Count empty` are separate options [5] | `COUNTALL(values)` "Count the number of linked records"; `COUNTA(values)` "Count the number of **non-empty** values"; `COUNT(values)` "Count only non-empty **numeric** values" [6] |
| Count unique | (not fetched) | `COUNTUNIQUE` "Counts the number of unique values in a list of specified values and ranges" [4] | `Count unique values`: "Counts the number of unique values in the selected property…" [5] | `ARRAYUNIQUE(values)` [6] |
| Percent empty / not empty | (no equivalent) | (no equivalent) | `Percent empty`: "Shows the percentage of related pages with no value in the property you selected." `Percent not empty`: "…with a value…" [5] | (not stated) |
| Date aggregations | (not fetched) | (not fetched) | Earliest date, Latest date, Date range — listed as date-only [5] | (not stated) |
| Error values | `#DIV/0!` "when a number is divided by zero (0)… when a formula refers to a cell that has 0 or is blank" [7] | (not fetched) | none — the calculation surface has no error values [5] | none listed [6] |

[1] https://support.microsoft.com/en-us/office/average-function-047bac88-d466-426c-a32b-8f33eb960cf6
[2] https://support.google.com/docs/answer/3093615
[3] https://support.microsoft.com/en-us/office/counta-function-7dc98875-d5c1-46f1-9a82-53f3219e2509
[4] https://support.google.com/docs/answer/3093405
[5] https://www.notion.com/help/relations-and-rollups
[6] https://support.airtable.com/docs/rollup-field-overview
[7] https://support.microsoft.com/en-us/office/how-to-correct-a-div-0-error-3a5a18a9-8d80-4ebb-a908-39e759a009a5

### What the review settles

1. **Text is never a number.** Excel and Sheets both say *ignored*, not *parsed*. No reference
   product does prefix parsing. `parseFloat("12abc") === 12` at `src/lib/engine/aggregate.ts:191`
   (and at ingest, `datasources/helpers.ts:41`) has no reference behind it — the user is right that
   "по документации такой ошибки образовываться не должно было".
2. **An empty cell is not a zero, and it is not in the denominator.** Excel states it directly [1].
   This answers directive 1 without needing a per-scenario ruling.
3. **The count family is a family everywhere.** Excel has COUNT/COUNTA/COUNTBLANK, Sheets adds
   COUNTUNIQUE, Airtable has three functions with three names, Notion has five named options. **No
   reference product ships a bare "Count".** Directive 4 is the industry norm, not a local nicety.
4. **Two products in our category (Notion, Airtable) have no error values at all.** They are the
   closer references for a Markdown-first product: there is no cell to hold `#VALUE!` and no formula
   bar to explain it. So this product does not adopt error values (§3.4).

## 2. The one coercion rule

### 2.1 Scenarios (directive 1, enumerated before the rule)

| # | Scenario | What arrives at the aggregate | Distinguishable? |
|---|---|---|---|
| S1 | Frontmatter key absent | `undefined` — `frame.records.map((r) => r.values[field.name])` at `src/lib/dashboard-engine/aggregation.ts:68` yields `undefined` for a missing key | yes |
| S2 | `hours:` with nothing after it | `null` or `""` depending on the YAML parse — UNVERIFIED (§9) | **no, not reliably** |
| S3 | `hours: ""` | `""` | no, collides with S2 |
| S4 | List field with holes, `[1, null, 3]` | array containing `null` | yes |
| S5 | Group array from `executeGroupBy` | `records.map(...)` puts `undefined` in the array for missing values (per `PLAN_180` §3, `transformExecutor.ts:766-768`) | yes |
| S6 | User typed prose in a Number field: `hours: n/a`, `hours: 12abc` | string — **but see S9: for a Number-typed field it is already `NaN` / `12` by the time an aggregate runs** | yes |
| S7 | Boolean in a numeric aggregate | `true`/`false` | yes |
| S8 | Date in a numeric aggregate | `Date` or ISO string | yes |
| S9 | Ingest-side parse | **VERIFIED (main session):** `src/lib/datasources/helpers.ts:38-42` — `case DataFieldType.Number: if (typeof value === "string") record.values[field.name] = parseFloat(value)`. Prefix parsing happens at ingest for every Number field. | yes — and it is the first site to fix |

**Conclusion: adopt the universal rule.** S2 and S3 are not reliably distinguishable after YAML
parsing, so a rule that treated "missing" and "present-but-empty" differently would be
*unimplementable*, not merely undesirable. All nine scenarios ask the same question — "is there a
number here?" — and the references answer it identically. One rule.

### 2.2 The rule

New module, no dependencies except types, importable from `lib/engine`, `lib/dashboard-engine`,
`lib/formula`, `lib/datasources` and `ui`:

```ts
// src/lib/engine/numeric.ts
/** The project's only definition of "this value is a number". */
export function toNumber(value: unknown): number | null;
/** Map + drop non-numbers. The only way to get a number[] out of user data. */
export function toNumbers(values: readonly unknown[]): number[];
/** toNumber(value) !== null. For type checks that must not diverge from the parse. */
export function isNumeric(value: unknown): boolean;
```

`toNumber` semantics, in order:

1. `typeof value === "number"` → return it **only if `Number.isFinite`**. `NaN` and `±Infinity` →
   `null`. (Today both `aggregate.ts:185-196` and `transformExecutor.ts:785-799` push a literal
   `NaN` straight into `SUM`, poisoning the whole reduction — `PLAN_180` §8 records this as "no
   divergence"; it is agreement on a bug. And after S9, every `hours: abc` in a Number field *is* a
   literal `NaN`.)
2. `typeof value === "string"` → `const s = value.trim()`; if `s === ""` → `null`; if `s` does not
   match the whole-string grammar → `null`; else `Number(s)`.
   Grammar: `/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/`
   Rejects, each for a reason already burned in this codebase: `"12abc"` (prefix parse — the
   defect), `"0x10"` (`Number("0x10") === 16`, `parseFloat("0x10") === 0` — two implementations,
   two wrong answers), `""` and `"  "` (`Number("") === 0` — the pipeline's silent zero), `"NaN"`,
   `"Infinity"`, `"1_000"`, `"1,5"` (open decision D2).
3. `boolean` → `null`. Excel ignores logical values in AVERAGE [1]; booleans are served by
   `count_checked` / `percent_true`, not by arithmetic.
4. `Date` → `null`. Dates are served by `earliest` / `latest` / `date_range`.
5. anything else (`null`, `undefined`, object, array) → `null`.

**How it is pinned.** `src/lib/engine/__tests__/numericContract.test.ts` exports one fixture table,
`NUMERIC_COERCION_CASES`, and **every consumer suite imports that table** rather than restating
cases. A copied table is a second implementation of the contract, which is the class of defect this
whole ticket is about. Minimum cases: `1`, `0`, `-1`, `1.5`, `.5`, `1e3`, `"1"`, `" 1 "`, `""`,
`"  "`, `"12abc"`, `"abc"`, `"0x10"`, `"1,5"`, `"1_000"`, `NaN`, `"NaN"`, `Infinity`, `"Infinity"`,
`true`, `false`, `null`, `undefined`, `new Date()`, `"2026-01-01"`, `{}`, `[]`, `[1]`.

### 2.3 Coercion sites inventory (deliverable 1)

Grep over `src/lib` for `parseFloat|parseInt|Number\(|isNaN|toNumber`, classified. **Class A must
route through `toNumber`/`toNumbers`. Class B is a different contract (lexing source text, not
interpreting user data) and stays, with a marker. Class C is not data.**

**Class A — user data coercion, must change:**

| Path:line | Today |
|---|---|
| `src/lib/datasources/helpers.ts:38-42` | **ingest:** `parseFloat(value)` for every string in a Number field — the first site, verified |
| `src/lib/engine/aggregate.ts:185-196` (`toNumbers`), `:191` | `parseFloat` — the defect the user named |
| `src/lib/engine/aggregate.ts:198-200` (`sumNumbers`) | routes through the above |
| `src/lib/dashboard-engine/aggregation.ts:220-231` (`extractNumbers`), `:226-227` | `Number(v)` + `v !== ""` guard — a third rule |
| `src/lib/dashboard-engine/transformExecutor.ts:785-799` (`extractNumericValues`), `:794-795` | `Number(v)`, no `""` guard; and `:786-788` returns `[]` for a scalar string, so `"5"` sums to 0 while `["5"]` sums to 5 |
| `src/lib/dashboard-engine/transformExecutor.ts:536-537` | `Number(token)` with a `token !== ""` guard |
| `src/lib/dashboard-engine/transformExecutor.ts:546-547` | `Number(val)` **without** the `""` guard — inconsistent with `:537` ten lines above |
| `src/lib/dashboard-engine/transformExecutor.ts:597` | `isNaN(result)` → null |
| `src/lib/dashboard-engine/transformExecutor.ts:1175` | numeric-ness test `typeof g === "number" \|\| (typeof g === "string" && !isNaN(Number(g)))` — must become `isNumeric` |
| `src/lib/dashboard-engine/chartDataPipeline.ts:133` | `Number(rawVal)` |
| `src/lib/dashboard-engine/chartDataPipeline.ts:261-262, :272-273, :301-303` | `parseFloat(String(x ?? ""))` — scatter axes; a fifth rule |
| `src/lib/engine/crossProjectRollup.ts:75` | numeric-ness via `!isNaN(parseFloat(v))` |
| `src/lib/datasources/native-query/nativeQuery.ts:261-265` | `Number(a)`/`Number(b)` for sort order, NaN last — sorting must agree with aggregation on what a number is |
| `src/lib/database/cellEditor.ts:130` | `Number(text)` — user typing into a numeric cell; the write side of the same contract |
| `src/lib/engine/filterEvaluator.ts:177` | `Number(cond.value)` — a filter comparing "12abc" must agree with an aggregate ignoring it, or axis A and axis C disagree about the same row |
| `src/lib/formula/extendedEvaluator.ts` | ~60 `Number(evaluate(...))` sites (`:111-112, :161-163, :169-206, :232-233, :280-290, :353-354, :371-548, :560-704`) — argument coercion inside formula functions; **which are user data vs literal arguments is unread** and must be classified in T1 |
| `src/lib/helpers/formulaParser.ts:484-490, :529-534, :742, :749` | `Number(right)`/`Number(left)` in comparison and arithmetic fallbacks |

**Class B — lexing/parsing source text, exempt with a marker:** `src/lib/helpers/formulaParser.ts:175`
(`parseFloat` on a lexed `NUMBER` token), `src/lib/helpers/dateFormulaParser.ts:147` (`parseInt` on
a date-offset token), `src/lib/frontmatter/codec.ts:50` (`Number.isNaN(parsed.getTime())` — date
validity).

**Class C — not data:** `src/lib/visualizer/colors.ts:83-89` (hex), `src/lib/helpers/gestureHandler.ts:107`
(computed font size), `src/lib/dataframe/dataframe.ts:184, :217` (`isNumber`/`isOptionalNumber`
type guards — no coercion, but they must be defined as `isNumeric`'s siblings or they will drift).

### 2.3a Status after T1 (`#180a`, implemented 2026-09-03)

**Every Class-A row above is routed**, plus sites this inventory did not have because it grepped
`src/lib` only. Recorded here rather than as a "done" column, because the delta is the useful part:

- **Class A, as listed:** ingest (`datasources/helpers.ts` — stores `null`, never `NaN`), the
  kernel `toNumbers`, the footer `extractNumbers`, the pipeline `extractNumericValues` (whose
  scalar-vs-array disagreement about `"5"` is gone with it), `evaluateExpression`'s two branches
  and its `isNaN(result)` guard (now `Number.isFinite`, so an overflow is rejected too), the join's
  numeric-ness test, the chart value and all three scatter-axis pairs, `crossProjectRollup`'s
  type-mismatch warning, the native-query sort comparator, `cellEditor`, and `filterEvaluator`'s
  number operand.
- **`extendedEvaluator.ts` is fully classified — §9's UNKNOWN is closed.** All 111 sites are
  argument coercion and all are routed, and the classification is derived rather than assumed: the
  lexer (`formulaParser.ts`, now Class B) turns a numeric literal into a JS number *before*
  evaluation, so `toNumber` is the identity on a literal and re-judges only field values. Nothing
  was left `UNCLASSIFIED`. One deliberate divergence is named in the code (`operandNumber`): to an
  operator a boolean is 0/1, because Excel ignoring logical values inside AVERAGE is a statement
  about aggregating a column, not about `done > 0` in a hand-written formula.
- **Found outside the inventory** (the grep was `src/lib`-only): `filterEvaluator.ts`'s
  `is-last-n-days` / `is-next-n-days` operands (`parseInt`, so `"7 days"` was 7);
  `StatsCard.svelte`'s sparkline, which plotted a point for a value the card's own number ignored;
  `EditableCell.svelte`; `RollupCellRenderer.svelte` and `GridRollupCell.svelte`; and
  `CreateField.svelte`'s field-type conversion table — the most destructive of them, since it
  writes converted values back to disk and `parseInt` turned `"12abc"` into 12 and `"1.5"` into 1.
- **Class B/C** carry `// coercion-exempt: <reason>` markers and no code change, except
  `tableCanon.ts`'s boolean ordering, which was rewritten as `(a ? 1 : 0)` — R0.6's LOC ceiling for
  that file may only be lowered, so removing the coercion was cheaper than excusing it.
- **`dataframe.ts:184, :217`** (`isNumber` / `isOptionalNumber`) are unchanged, deliberately. They
  are TypeScript type guards (`value is number`) whose job is narrowing for dispatch, not deciding
  whether a value is usable arithmetic. Making `isNumber` reject `NaN` would not change the static
  type it narrows to, and it would reroute a NaN-valued Number field into `filterEvaluator`'s
  string branch. After T1 a stored `NaN` no longer arrives from ingest anyway, so the divergence
  has no live subject. Stated here so it is a decision on the record and not an oversight.
- **Ratchet:** `R0_15_oneNumericCoercion.test.ts` (I-2). R0.16 was taken by another ticket.

**Docs:** the only doc that states a coercion rule today is `src/lib/engine/aggregate.ts:18-19` in
its own header — "Numeric coercion (`toNumbers`) accepts JS numbers and **parseable** strings" —
which documents the defect as the contract. Grep over `docs/` found no numeric-coercion rule
anywhere (only `PLAN_180` describing the divergence, and the #180 BACKLOG entry). That absence is
why five implementations coexisted.

## 3. Canonical semantics

### 3.1 The canonical vocabulary

Union of `RollupFunction` (`aggregate.ts:27-48`), `AggregationFunction` (`transformTypes.ts:238-251`),
`ColumnAggregation` (`types.ts:264-284`), normalised to Notion's naming because it is the closest
product and its five-option count family [5] is the one the user's directive 4 describes.

| Canonical | Empty input | Text | Boolean | Date | Notes |
|---|---|---|---|---|---|
| `count_all` | `0` | counted | counted | counted | Notion "Count all" [5], Airtable `COUNTALL` [6] |
| `count_values` | `0` | counted if non-empty | `false` counted (see D4) | counted | Notion "Count values" [5], Airtable `COUNTA` [6], Excel `COUNTA` [3] |
| `count_numeric` **(new)** | `0` | ignored | ignored | ignored | Excel `COUNT` [3], Sheets `COUNT` [4], Airtable `COUNT` [6]. **The project has no such operator today** |
| `count_unique` | `0` | counted | counted | counted | on `String(v)` of non-null, as today (`aggregate.ts:111-114`) |
| `count_empty` | `0` | — | — | — | Notion "Count empty" [5] |
| `count_checked` / `count_unchecked` | `0` | ignored | the subject | ignored | footer-only today (`aggregation.ts:112-116`) |
| `percent_empty` / `percent_not_empty` | **`null`** | — | — | — | **value becomes a number 0-100**, formatted `"NN%"` |
| `percent_true` | **`null`** | `"true"` counted | the subject | ignored | today `aggregate.ts:152-160` returns a string |
| `sum` | `0` (D1) | ignored | ignored | ignored | identity element |
| `avg` | **`null`** | ignored | ignored | ignored | Excel: empties ignored, not zeroed [1] |
| `median` | **`null`** | ignored | ignored | ignored | even count = mean of the two middles (unchanged) |
| `min` / `max` / `range` | **`null`** | ignored | ignored | ignored | already the footer's behaviour (`aggregation.ts:43-53`) |
| `std_dev` | **`null`** | ignored | ignored | ignored | pipeline-only today (`transformExecutor.ts:858-864`), population σ |
| `first` / `last` | `null` | passthrough | passthrough | passthrough | pipeline-only |
| `earliest` / `latest` / `date_range` | `null` | parsed as date | ignored | the subject | footer-only (`aggregation.ts:144-165`) |
| `concat` / `concat_unique` / `show_original` / `show_unique` | `""` | the subject | stringified | stringified | unchanged |

### 3.2 The three behaviour changes this table forces

1. **Empty numeric aggregate → `null`, rendered "—", never `0`.** Today `aggregate.ts:121,127,132,137,148`
   all return `0`. The footer already disagrees with the kernel and returns `null`
   (`aggregation.ts:43-53, :90-92, :186`), and `computeAggregateValue` carries a third answer for
   `avg` (`:192-193`, comment "legacy contract returned null"). The canonical answer is the footer's,
   for the reason the footer's own comment gives: *users read the cell as "no data" vs "zero"*. This
   makes the existing exception set the rule and deletes `NULL_ON_EMPTY` as a special case.
2. **Percent operators return a number, not a string.** `aggregate.ts:100-108, :152-160` return
   `"NN%"` as the *value*; `aggregation.ts:132-142` returns a number with `"NN%"` as the *formatted*
   string; `transformExecutor.ts:866-882` returns a bare number 0-100. `RollupResult` already has
   both fields (`aggregate.ts:61-64`) — the kernel simply is not using them. Canonical:
   `value: number | null`, `formattedValue: "NN%"` / `"—"`.
3. **`percent_*` on zero records → `null`, not `"0%"`/`0`.** `aggregate.ts:100` and `aggregation.ts:133`
   both say zero percent of nothing is 0%. Zero percent is a claim about a population; there is no
   population.

### 3.3 What does not change

`count_unique` ≡ today's `COUNT_DISTINCT` exactly (`PLAN_180` §4). `median` even-count rule.
`concat`/`show_*`. Every stored key (§4).

### 3.4 Error values: rejected, with the alternative

No `#DIV/0!`, no `#VALUE!`. Reasons: (a) the two closest references, Notion and Airtable, have none
[5][6]; (b) there is no cell chrome or formula bar to explain one; (c) the product already has a
diagnostic channel — `TransformMeta.warnings` (`transformTypes.ts:277-283`), documented there as
"the pipeline's only diagnostic channel". The user-facing contract is **`null` + "—" + a reason
string**, e.g. "no numeric values in 12 records" (§5, R-UI-4). This is a design choice, not a claim
about a reference product.

## 4. Vocabulary unification and stored data

### 4.1 What is stored today (verified)

| Vocabulary | Stored at | Written by |
|---|---|---|
| `ColumnAggregation` (lowercase) | `widget.config.aggregations` (`types.ts:287`), `AggregationResult.function` (`:292`), and three further `readonly aggregation: ColumnAggregation` sites (`types.ts:409, :449, :540`) | `StatsConfig.svelte:60,81`, `tableHeaderOps.ts:84-86`, `ChartConfig.svelte:197`, `widgetTemplates.ts` (13 sites), `demoProject.ts:322,394,437` |
| `AggregationFunction` (UPPERCASE) | `widget.transform` steps: `AggregateColumn.function` (`transformTypes.ts:178`), `PivotStep.aggregation` (`:191`), `JoinStep.aggregation` (`:220`) | `PipelineEditor.svelte:384, :404` |
| `RollupFunction` (lowercase) | Rollup field config | `CreateField.svelte:266,352-353`, `ConfigureField.svelte:444-449,514` |

### 4.2 Decision: **no stored key is renamed. No migration.**

Rationale, and it is the `DataTableConfig.subBases` precedent stated in CLAUDE.md: a shipped key
that exists in a real vault is carried. Renaming `COUNT` → `COUNT_ALL` in `widget.transform` would
spend a migration on the one structure `MANUAL_TESTING_PIPELINE.md` §4a records as silently
swallowing a malformed step (steps are keyed `type`, live in `widget.transform` not `widget.config`
— `transformTypes.ts:12-18`). The benefit is cosmetic; the failure mode is silent data loss.

Instead: **one canonical enum internally, three frozen boundary maps.** Read-time normalisation,
write-time byte-identical. The pattern already exists twice: `KERNEL_OPS` (`aggregation.ts:33-41`)
and `toAggFn` (`chartDataPipeline.ts:21-33`). Unify those two plus a third for `RollupFunction` into
one module, `src/lib/engine/aggregationVocabulary.ts`, exporting `toCanonical(...)` per surface — so
the mapping exists once instead of being re-derived per consumer.

The mapping that must be explicit and commented, because it is the ambiguity the user's directive 4
is about:

- `AggregationFunction "COUNT"` → `count_all` (**not** `count_values`). Evidence it already means
  count-all: `computeAggFn` returns `arr.length` including nulls (`transformExecutor.ts:812-813`)
  and `chartDataPipeline.ts:29` maps `count_total → "COUNT"`. Changing this would silently alter
  every chart.
- `ColumnAggregation "count_total"` → `count_all`.
- `RollupFunction "count"` → `count_values` semantics-wise (`aggregate.ts:85-86` filters nulls),
  **not** `count_all` (`:88-89`). The same word means different things two lines apart. Both stay;
  both get an explicit target.

### 4.3 The one live defect in the stored vocabulary

`ColumnAggregation` still contains **both** `"count"` and `"count_total"` (`types.ts:266-267`) after
R5-004 renamed one to the other (`src/ui/views/Dashboard/migration.ts:90-127`, pinned by
`migration.test.ts:93-127`). But `computeColumn` (`aggregation.ts:105-169`) has **no `case "count"`**
— a stored `"count"` that ever escapes the migrator falls to `default:` and renders `"—"` with no
warning.

Fix: **add `case "count":` mapping to `count_all` with a comment saying why it is kept.** Do not
delete the union member — it shipped. This is directive 4's "silent COUNT" in its most literal form:
one string, three meanings, one of them rendering as nothing.

## 5. UI rule for the count family (directive 4)

### 5.1 Where the pickers are (verified)

| Surface | Path:line | Today |
|---|---|---|
| Pipeline step editor | `PipelineEditor.svelte:94-96` | flat list of 13 UPPERCASE names including bare `"COUNT"` |
| Stats cards | `StatsConfig.svelte:24-25` | full `ColumnAggregation` set; `count_total` labelled **"Count"** |
| Table footer / header menu | `tableHeaderOps.ts:17-20`, `calculateOptions(field)` at `:20` | `BASE_CALCS` / `NUMERIC_CALCS` **already gated by field type — this is the right pattern** |
| Chart Y-axis | `ChartConfig.svelte:197` | `<option value="count_total">` labelled via i18n key `…aggregations.count` — value and label disagree |
| Rollup field creation | `CreateField.svelte:266` | `ROLLUP_FUNCTIONS` list |
| Rollup field config | `ConfigureField.svelte:444-449` | **already labels `count_total` "Count all"** — the vocabulary to standardise on |
| Widget badge | `WidgetInlineBadges.svelte:9-16` | `AGG_LABEL = { count_total: "COUNT" }` — re-introduces the ambiguous word after the picker resolved it |

Five label tables, five option lists, one shared concept.

### 5.2 The rules

- **R-UI-1 — "Count" never appears alone.** Every count option carries a name and a one-line
  consequence:
  - *Count all* — every record, including ones with nothing in this field
  - *Count values* — records where this field has something in it
  - *Count unique* — how many different values, empties excluded
  - *Count numbers* — values this field can do arithmetic on
  - *Count empty* — records where this field is blank
- **R-UI-2 — options are gated by field type.** Promote `calculateOptions(field)`
  (`tableHeaderOps.ts:20`) to a shared `aggregationOptionsFor(field)` used by all six surfaces. A
  Number field is not offered `count_checked`; a Text field is not offered `sum`. This is the
  mechanism that "prevents logical errors" — you cannot mis-select what is not shown.
- **R-UI-3 — live preview in the picker.** Show the value each option would produce on the current
  data. Needs no new engine: `computeAggregateValue` (`aggregation.ts:180`) already returns raw
  values. The difference between *Count all* = 42 and *Count values* = 7 is self-explanatory when
  both numbers are on screen and unexplainable in prose.
- **R-UI-4 — zero eligible inputs shows "—" and the reason,** not `0`. This is §3.2(1) made
  visible; without it the null policy is invisible to the user and reads as a bug.
- **R-UI-5 — one label table.** One i18n namespace imported by all six surfaces.
  `ChartConfig.svelte:197` and `WidgetInlineBadges.svelte:16` disagree with their own values today
  because there are five tables.

## 6. Constraints, invariants, ratchets

Each ratchet names the plant that must make it fail — a ratchet nobody has seen fail is a comment.
Ratchet numbers below are placeholders: R0.13 and R0.14 already exist, so the next free numbers are
assigned at implementation time.

| # | Invariant | Ratchet | Plant that must fail it |
|---|---|---|---|
| I-1 | No aggregate math outside the kernel | `R0_x_oneAggregationKernel.test.ts` — scan `src/` for `case "SUM"`/`case "avg"`-shaped labels of any canonical op outside `engine/aggregate.ts` and the allowlisted boundary map | add `case "AVG":` to any widget; re-add a local `computeAggFn` |
| I-2 | No numeric coercion outside `toNumber` | `R0_y_oneNumericCoercion.test.ts` — `parseFloat(`, `parseInt(`, `Number(`, unary `+v`, `v * 1` in `src/lib`+`src/ui` allowed only in `engine/numeric.ts` or on a line preceded by `// coercion-exempt: <reason>` | add `Number(v)` with no marker; add a marker with an empty reason |
| I-3 | Empty is not zero | the canonical table as a contract test run by all three implementations | make `avg([])` return 0 anywhere |
| I-4 | Stored vocabularies are append-only | `R0_z_storedAggregationKeys.test.ts` — snapshot of the string members of all three unions; additions pass, removals fail | delete `"count"` from `ColumnAggregation`; delete `"COUNT"` from `AggregationFunction` |
| I-5 | One option source per picker | scan: no `.svelte` may hold an array literal of ≥2 canonical op names outside the shared table | re-add `AGG_FUNCTIONS` to `PipelineEditor.svelte` |

**Where these ratchets are blind, stated up front:** I-1 and I-2 are text scans. They cannot see a
coercion written as `+value`, `value - 0`, or built by string concatenation, and they cannot see math
expressed without a `case` label. They are tripwires against the *recurrence pattern* (someone
writes a fresh helper), not proofs. The proof is the contract test, I-3.

## 7. Plan

Five tickets. Each is ≤3 handoffs (`code-mapper` → `implementer` → `auditor`); adversarial review
follows every one that changes behaviour, which is T1-T4. Order is forced: coercion first, because
every later diff would otherwise be entangled with it.

| # | Ticket | Size | Staffing | Test written BEFORE | Probe jest cannot do |
|---|---|---|---|---|---|
| **T1** | `#180a` — `src/lib/engine/numeric.ts` + the contract table; route ingest (`datasources/helpers.ts:41`, verified) and the four Class-A aggregation sites (`aggregate.ts:185`, `aggregation.ts:220`, `transformExecutor.ts:785`, `chartDataPipeline.ts:133/261/272/301`) through it | M | implementer + auditor + adversarial | `numericContract.test.ts` with the §2.2 table, red on today's code by construction | OBStests: a record with `hours: 12abc` and one with `hours: ""`, a Stats AVG over the field. Expect "—"/ignored, not `12`/`0` |
| **T2** | `#180b` — empty→`null` policy across all three implementations; percent operators return numbers; `NULL_ON_EMPTY` becomes the rule | M | implementer + auditor + adversarial | extend `PLAN_180`'s `transformAggregationDifferential.test.ts` to record **all three** implementations' current output per operator, then flip exactly the §3.2 assertions — that diff is the review artifact | vault: a Stats card and a table footer over a column with no numbers; both must read "—" |
| **T3** | `#180c` — the original adapter: `computeAggFn` delegates, `extractNumericValues` deleted | S (now that T1/T2 removed the divergences) | implementer + auditor | none new; T2's differential must stay green | `grep -n "engine/aggregate" src/lib/dashboard-engine/transformExecutor.ts` returns an import |
| **T4** | `#180d` — count family + UI: `count_numeric` added, `case "count"` interpreted, `aggregationOptionsFor(field)` shared, labels/i18n unified, badge fixed | M | implementer + auditor + adversarial; `flow-auditor` before and after | picker option-set snapshot per field type | `flow-render` on the Stats config action — it is exactly the label-vs-value class it found in CX-R1..R4; then the vault |
| **T5** | `#180e` — ratchets I-1/I-2/I-4/I-5, plus the doc headers that currently document the defect: `aggregate.ts:15-21`, `transformTypes.ts:26-34` (states "the pipeline does not delegate" as fact), `FILTER_MODEL.md` axis C | S | lead | each ratchet's plant, run and seen red before being committed green | — |

**Reversibility.** T1-T3 are code-only; no stored shape changes, so revert is a `git revert`. T4
changes option sets and labels, not stored values. **No step migrates data**, which is the design
goal, not an accident.

**Why the previous plan's order was wrong** (rejected alternative, recorded so it is not
re-proposed): delegating first (`PLAN_180` recommendation) would have shipped
`parseFloat("12abc") === 12` into the pipeline in the name of "one coercion rule". The rule was
right, the rule's content was wrong, and the user caught it. Delegation is now T3 and is nearly
mechanical.

## 8. USER decisions still open

1. **`sum` of an empty group → `0` or "—"?** Recommended: `0` (additive identity; a total of
   nothing reads as zero), while every other numeric operator returns "—". Note: no reference page
   for SUM over an empty range was fetched; verify before implementing.
2. **`"1,5"` (locale decimal comma) — number or text?** Recommended: **text**. Frontmatter is
   machine-readable YAML; accepting a comma makes `[1,5]` and `"1,5"` ambiguous.
3. **`"1e3"` → `1000`?** Recommended: yes, the grammar includes the exponent.
4. **Does `false` count as a value for `count_values`?** Kernel says no (`aggregate.ts:92`
   excludes `false`), footer says yes (`aggregation.ts:103` excludes only `null`/`""`).
   Recommended: **yes, `false` is a value** — an unchecked box is an answer; `count_checked` exists
   for the other question.
5. **Ship `count_numeric` everywhere or only where a Number-ish field exists?** Recommended: offer
   it only for `Number` and `Unknown`/text fields, where it is informative.

## 9. UNKNOWN

- **Not verified, do not cite:** Excel/Sheets `SUM`/`MIN`/`MAX` over an empty range. The `#DIV/0!`
  page [7] states only "a number divided by zero… or a formula that refers to a cell that has 0 or
  is blank" — it does **not** state that `AVERAGE` of an all-empty range errors. §3.1's empty policy
  rests on Excel's "empty cells are ignored" [1] plus the footer's existing behaviour, not on an
  error claim.
- Google Sheets `AVERAGE` and empty cells / booleans: the page states text is ignored [2]; empties
  and booleans are not stated there.
- `COUNTUNIQUE` and blanks: not stated on its page [4].
- Notion: the page enumerates the options [5]; it does not state what any of them return for an
  empty relation.
- `src/lib/formula/extendedEvaluator.ts` — ~60 `Number(...)` sites seen by grep, none read
  individually. The split between user-data coercion and literal-argument coercion must be made in
  T1, not assumed here.
- `src/lib/database/rollupMode.ts` — cited by `PLAN_180:17` as the "surface vocabulary mapped down"
  precedent; not opened.
- `transformExecutor.ts:766-768` (`executeGroupBy` building group arrays with `records.map`) —
  cited from `PLAN_180` §3; `:780-894` was opened, `:766` was not.
- `types.ts:409, :449, :540` — the three `readonly aggregation: ColumnAggregation` lines were seen,
  not their enclosing interface names.
- OBStests vault not inspected: whether any real dashboard stores a `pivot`/`join` aggregation, and
  whether any stored `ColumnAggregation` is still the dead `"count"`, is unknown. Both are cheap REST
  checks and belong in T1's packet.
- YAML parse of `hours:` with nothing after it (S2): `null` vs `""` unverified.
