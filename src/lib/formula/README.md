# Formula runtime

Import public functions from `src/lib/formula`. `syntax.ts` parses one AST;
`extendedEvaluator.ts` owns the shared evaluator for all profiles. `catalog.ts` binds
compatibility implementations and metadata. It supplies lexer names, available
functions, validation and contextual help. The old helper paths are adapters.

## Compatibility is explicit

| API/profile | Existing behavior |
| --- | --- |
| `evaluateFormula(ast, record, date?)` | Boolean filter result, `legacy-filter` operators and functions |
| `evaluateFormulaValue` / `evaluateFormulaWithError` | `legacy-computed` values, errors and function availability |
| `evaluateExpression(source, context)` | Requires an explicit `semantics` profile; returns `{value, error?}` |

`unified-v1` is opt-in. This backend change does not version or migrate saved
definitions, and does not switch existing editors. Persistence and editor opt-in
must travel together in the next integration layer; preview must use the same
profile as the saved computation.

## Strict new-profile syntax

New evaluation and validation both select the strict policy. Low-level syntax
callers can use `tokenize(source, "strict")` or
`parseFormula(source, maxDepth, "strict")`; their defaults remain compatible.
Strict finite decimal/scientific literals include `.5`, `1.`, `1e-3`; unary signs
and subtraction without spaces are supported. Numbers use JavaScript's finite
double precision. Malformed numbers and unclosed strings produce errors.
Strings support escaped matching quotes, backslashes and `\n`, `\r`, `\t`;
unsupported escapes produce an error. `#` comments end at the next newline.
Function names become calls when followed by `(`, including across comments;
a bare name such as `SUM` can be a property. Unknown calls report an unknown
function. Unicode identifiers include non-BMP letters; spans remain offsets into
the original UTF-16 source for the editor's cursor APIs.

The shared profile combines the computed functions with calendar/list predicates.
It uses the computed arithmetic and truthy logic. Equality and order share the
same scalar operands. With a number present, numeric strings use the common
numeric coercion; invalid/non-finite numeric operands have no order and are not
equal. With a boolean present, values use 0/1, including numeric strings and
explicit `true`/`false` text. Two text operands compare trimmed lowercase text,
using deterministic lexicographic UTF-16 order rather than locale collation. ISO dates and native Dates compare by instant, including equality;
calendar predicates explicitly compare days/weeks/months. Missing values have no
relational order. Boolean ordering uses the same 0/1 operand rule as arithmetic.
`PROP` follows the same scope, spelling and wikilink-display
rules as a direct field, and does not read an object's prototype.
Comparison date strings must be complete supported forms: `YYYY-MM-DD`, or a
date followed by `T`/space and `HH:mm`, optional seconds and 1–3 fractional
digits, with optional `Z`/`±HH:mm`. Calendar components are checked; `24:00`
is accepted only with zero minutes, seconds and milliseconds. Date-prefixed
labels and invalid date strings remain text. Unzoned values use local native
date parsing/normalization. Explicit calendar/conversion functions retain their
own documented input rules.

Compatibility profiles retain their differences, including old unknown-function
results, strict-true filter AND/OR, JavaScript filter arithmetic and old validator
diagnostics. The pre-change fixture records 46 expressions on three records through
both old APIs. Its 276 evaluations and validator results must remain unchanged.
Another 80 pre-change mathematical vectors cover old WORKDAYS, IRR, RATE and NPV,
including the old descending negative-zero result.

New-profile WORKDAYS counts weekdays in (earlier calendar day, later calendar day]
and applies the interval's direction; the same calendar day is zero. It uses
whole weeks plus at most six residual weekdays. The compatibility implementation
keeps its day-by-day local-date behavior, including historically skipped dates
and negative zero, with a shared work cap for excessive compositions. Both keep
the previous accepted interval range. Profile-specific help describes the new rule.
Inputs first use local date parsing; a nonexistent local date used as an endpoint
is normalized by the date parser before the nominal calendar calculation.

## Context and passes

```ts
const pass = createFormulaPass(frame, "unified-v1", selectedDay.toDate());
const result = evaluateExpression(source, {
  record, frame, pass, semantics: "unified-v1",
});
```

In `unified-v1` the pass fixes `TODAY`/`NOW` and calendar predicates to its reference time. An
explicit `referenceDate` overrides it. Frame, profile or reference-time mismatch
creates a separate pass, so cached frame-wide expressions cannot cross owners.
An explicit common-profile pass without a reference time is not reused. Only
private parser-owned ASTs are frozen in both modes; bounded roots keep a reusable structural-check proof;
externally supplied mutable ASTs are checked on each call.
Their shape and result are not memoized by node identity, so editing one cannot
replay a result computed for its previous contents.
Callers must create a new pass when data changes, as before. Neither API writes
notes or settings. A filter caller converts the resulting value to a predicate.
The computed compatibility profile retains its old system-clock behavior;
passing a new-profile pass to an old API does not change that API's rules.

New `@column` values preserve row order and cell types, including distinct
`undefined` (absent) and `null` (present blank). They read own properties only and
copy the outer result list; underlying cells follow normal dataframe ownership.
A column reference requires a real `frame`, including an explicitly empty frame
for empty data. A record-only preview errors instead of inventing zero/empty
column results. The compatibility profile retains numeric-only column values.
New `COUNT` skips null/absent items, matching its non-null description; the
compatibility catalog describes its old list-position counting separately.

New-profile parsing/evaluation is bounded: 50,000 UTF-16 source units, nesting
depth 64, 100,000 AST nodes, 100,000 work units per call and 10,000 items per
iterated list. Each evaluated AST node costs a work unit. Cumulative financial
calls also charge their period count; IRR charges cashflows per Newton iteration,
RATE three units per iteration, and NPV its cashflow count. Compatibility WORKDAYS
charges its day-loop upper bound, while new WORKDAYS charges at most six residual
days. Nested calls share
the budget, and unsafe period counters that cannot advance are rejected.
Exceeding a limit returns an error with no partial value. These internal-loop
work limits also apply to the computed compatibility profile: ordinary results
stay unchanged, while excessive or non-advancing loops return an error. Other
compatibility bounds remain unchanged, including computed-list truncation. These are cooperative
work limits, rather than a wall-clock timeout for native operations such as regex.
The financial fallback cap lives in the handlers themselves, so a direct catalog
or handler call cannot disable it by supplying a different profile label. A managed
evaluation shares its financial budget across nested calls. Large compositions
can therefore hit the same cap even when each individual financial call is small.
`chargeWork` is a trusted internal evaluator hook: callers providing it own work
accounting and must not derive it from formula source or record data. Omitting it
uses the standalone cap; supplying a no-op intentionally opts out of that cap.
Direct iterative financial solvers keep one fallback budget for all iterations.
The old computed profile charges internal-loop work only; the new profile also
charges evaluated AST nodes against that same budget.
New COUNT also charges its argument and list-item traversal. Binary operator
evaluation, shape analysis and validation use iterative walks, so long flat
chains do not consume recursive nesting depth. Every evaluated operator/leaf is
charged once; static node counts also bound cyclic or expanding external ASTs.
Lazy branches retain their evaluation behavior. Legacy evaluation defaults and
all saved compatibility results stay on their old syntax policy.

Persisted base fields, view formulas, transform columns and Agenda lists may
carry `formulaVersion: "unified-v1"`. An absent flag retains that surface's old
rules; ordinary reads and saves do not migrate it. Unsupported or malformed
versions return no computed value (Agenda excludes the record) rather than
falling back to compatibility. Preserve unknown flags when retaining definitions.
The current data-layer integration does not expose a new-mode selector yet:
editor validation, help and explicit user selection must be integrated together.
Preview accepts an optional versioned draft: omitting it retains the saved mode;
an explicit empty draft selects compatibility. New computed columns see complete
earlier columns and their schema. Legacy transform aggregates continue to read
the original input frame, including in mixed-version steps. Agenda receives its
record subset and reference date from its caller, not the whole vault or wall clock.

Before enabling new rules, update all devices and back up settings. Older plugin
binaries do not understand this flag and cannot fail closed on it. A rollback
therefore requires restoring pre-update settings or explicitly converting each
new-mode formula after comparing its results. The version flag is a compatibility
contract for supporting binaries, not a guarantee of safe interpretation by old ones.

The date shorthand used by visual filters (`today+1w`) remains a separate syntax
for date values. Fixed rollup aggregation operations do not execute custom formula
source. Neither is presented as another general-purpose formula evaluator.
