# CX-ADV-180a — adversarial-reviewer on #180a (feat/180a-numeric-coercion vs main 895aab2)

Run 2026-09-03 through `.codex/run-role.mjs --role adversarial-reviewer`, Codex session 01a06467-f987-7df0-bd19-e85402f86f1d. Disposition in `BACKLOG.md` #180 and in the commit that follows this report.

## Verdict: BLOCK

### P1 — T1 already exposes the T2 empty policy

**Observed:** invalid Number strings are stored as `null` at ingest ([helpers.ts](src/lib/datasources/helpers.ts:40)). The table footer calls `computeAggregations` ([DataTableContent.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:155)), which delegates `avg` to the kernel; `avg` is not in `NULL_ON_EMPTY` ([aggregation.ts](src/lib/dashboard-engine/aggregation.ts:34), [aggregation.ts](src/lib/dashboard-engine/aggregation.ts:50)). The kernel returns numeric `0` when no numeric inputs remain ([aggregate.ts](src/lib/engine/aggregate.ts:130)), and the footer prints that formatted result ([TableFooter.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/TableFooter.svelte:20)).

**Inference:** a Number field containing `abc` becomes `null`, then a table-footer `AVG` visibly becomes `0`, not `—`. This violates the accepted “empty is not zero” aggregate outcome and the spec’s stated Stats-and-footer target. Local relation rollups also call the kernel without an empty guard ([rollup.ts](src/lib/dashboard-engine/rollup.ts:38)).

The supplied `min([NaN])` example is real: base `toNumbers` kept a numeric `NaN` ([base aggregate.ts:185–192, read in this review]), whereas the new helper drops it ([numeric.ts](src/lib/engine/numeric.ts:96)); `min` then takes its existing empty→`0` branch ([aggregate.ts](src/lib/engine/aggregate.ts:136)).

Confidence: high. Falsified only if the actual footer/rollup path has an uninspected outer conversion from this numeric zero to `—`; the inspected footer renders `formattedValue` directly. T2 must travel with T1, or every affected T1 surface needs a proved empty guard.

### P2 — formula rationale is narrower than stated

**Observed:** the parser does turn accepted `NUMBER` tokens into JS numeric literals ([formulaParser.ts](src/lib/helpers/formulaParser.ts:162), [formulaParser.ts](src/lib/helpers/formulaParser.ts:374)). For those literals, routing through `toNumber` is indeed identity.

But its lexer only consumes digits and dots, with an optional leading minus. It does not tokenize exponent or unary-plus literals. Thus `ROUND(1e3, 0)` and `ROUND(+1, 0)` are parser failures, while the cell editor accepts those strings by design ([numeric.ts](src/lib/engine/numeric.ts:59), [cellEditor.ts](src/lib/database/cellEditor.ts:128)). This is pre-existing parser scope, not a break caused by the routing.

Also, the claim that only field values are re-judged is false: boolean literals are parser literals too. `ROUND(TRUE, 0)` changed from `1` to `null`, while `TRUE + 1` remains `2`: `argNumber` rejects booleans ([extendedEvaluator.ts](src/lib/formula/extendedEvaluator.ts:28)), but `operandNumber` maps them to `0/1` ([extendedEvaluator.ts](src/lib/formula/extendedEvaluator.ts:43)).

Confidence: high on the mechanisms; medium that this is a product defect, because the code documents the distinction. Falsifier: an explicit formula contract test accepting those three outcomes (`ROUND(TRUE)`, `TRUE + 1`, `SUM(TRUE, 1)`) as intentional.

### Decision checks

- The revised `+` is internally coherent for blank-plus-number arithmetic: it agrees with `-` and `*` for that case ([extendedEvaluator.ts](src/lib/formula/extendedEvaluator.ts:1081)). It is not the same semantic rule as aggregation. A user-surprise example is `a = "abc"`: `a + 1` is `"abc1"`, whereas `a - 1` is `-1`; two blank fields yield `""` for `+` but `0` for `-`. That is a defensible dynamic-formula choice only if it is deliberately scoped; it does not substantiate “not a number anywhere.”
- I found no write/read asymmetry from widening the cell editor. It converts `+1` and `1e3` to finite numbers before persistence ([cellEditor.ts](src/lib/database/cellEditor.ts:135)); the writer receives that numeric value ([cellEditorWriter.ts](src/lib/database/cellEditorWriter.ts:18)), and ingest preserves finite numbers. This is an inference, not a vault-tested round trip. It would be falsified by a persisted value reloading as non-finite or non-numeric.

I attempted the focused Jest suites, but PowerShell blocked `npx.ps1`; `npx.cmd` then failed sandbox access while resolving `C:\Users\Park`. No test result is claimed.

