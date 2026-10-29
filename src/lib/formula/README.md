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

The shared profile combines the computed functions with calendar/list predicates.
It uses the computed arithmetic and truthy logic; number/string and text equality
follow the filter's comparison rules, with boolean text restricted to `true` and
`false`. ISO dates and native Dates compare by instant, including equality;
calendar predicates explicitly compare days/weeks/months. Missing values have no
relational order. Boolean ordering uses the same 0/1 operand rule as arithmetic.
`PROP` follows the same scope, spelling and wikilink-display
rules as a direct field, and does not read an object's prototype.

Compatibility profiles retain their differences, including old unknown-function
results, strict-true filter AND/OR, JavaScript filter arithmetic and old validator
diagnostics. The pre-change fixture records 46 expressions on three records through
both old APIs. Its 276 evaluations and validator results must remain unchanged.

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

New-profile parsing/evaluation is bounded: 50,000 input characters, nesting/AST
depth 64, 100,000 AST nodes, 100,000 work units per call and 10,000 items per
iterated list. Each evaluated AST node costs a work unit; cumulative financial
calls also charge their period count before entering the loop. Nested calls share
the budget, and unsafe period counters that cannot advance are rejected.
Exceeding a limit returns an error with no partial value. Cumulative financial
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
The old computed profile charges financial periods only; the new profile also
charges evaluated AST nodes against that same budget.
The structural depth limit also includes long left-associated operator chains;
`SUM` avoids that shape until the separate expression-shape integration is complete.

The date shorthand used by visual filters (`today+1w`) remains a separate syntax
for date values. Fixed rollup aggregation operations do not execute custom formula
source. Neither is presented as another general-purpose formula evaluator.
