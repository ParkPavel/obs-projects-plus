# CX-ADV-180b — adversarial-reviewer on #180b (fix/180b-percent-value-shape vs main 68b6aa9)

Run 2026-09-03 through `.codex/run-role.mjs --role adversarial-reviewer`, Codex session 01a06580-36c1-7db1-bac9-1bb38920e4ef. Verdict BLOCK, three P1s. Disposition in `BACKLOG.md` #180: one was a defect in the main session's own fix and was reverted; two were narrowed claims and are now recorded as debt against T3 and T4.

## Verdict: BLOCK

I found three merge-blocking contradictions in #180b’s decision.

- **P1 — T2 does not meet its “all three implementations” empty-percent policy.** The plan requires `null` empty handling across all three implementations, and the spec defines empty percent as `null`; however the transform pipeline still returns `0` for empty `PCT_EMPTY` and `PCT_NOT_EMPTY`. [SPEC](docs/internal/SPEC_MATH_SPREADSHEET_2026-09-02.md:379) · [transform executor](src/lib/dashboard-engine/transformExecutor.ts:867)  
  Observed: these functions are called by aggregate, pivot, and join paths.  
  Inferred: a chart/pipeline can still treat “no population” as 0%, despite T2 claiming §3.2 is closed.  
  Falsified by: a demonstrated non-equivalence between `PCT_*` and the specified percent operators, or changing the empty branch to `null` and testing the three paths.

- **P1 — `rollupColumns` restores the presentation string as data, so numeric rollup filters are broken and sorts lose precision.** It folds `"33%"` into `record.values` instead of the unrounded number. [rollup folding](src/ui/app/rollupColumns.ts:105) The global view filters only after that fold, dispatching by the runtime value type; a string cannot enter the numeric-operator branch. [view order](src/ui/app/View.svelte:167) · [filter dispatch](src/lib/engine/filterEvaluator.ts:173) Meanwhile Rollup fields explicitly offer numeric operators. [operator helper](src/ui/views/Calendar/agenda/operatorHelpers.ts:119)  
  Thus `percent rollup > 50` is unhandled/false, and sorting compares rounded display strings rather than the kernel’s raw number (distinct values such as 33.1 and 33.4 both become `"33%"`). This re-creates the data/display conflation #180b was meant to remove.  
  Falsified by: a numeric side-channel used by both sort and filter after folding; none was present in the traced path. The derived value is not persisted to frontmatter, so this is a behavior/filter/sort defect, not a stored-data mutation. [DataFrame contract](src/lib/dataframe/dataframe.ts:15)

- **P1 — deferring D4 leaves a visible contradictory answer today.** For `[false]`, the kernel’s `percent_empty` returns 100%, while the footer returns 0%; D4 says `false` is a value. [kernel predicate](src/lib/engine/aggregate.ts:122) · [footer predicate](src/lib/dashboard-engine/aggregation.ts:117)  
  The changed comment itself acknowledges this split. [aggregation rationale](src/lib/dashboard-engine/aggregation.ts:29) Deferring the coordinated count-family fix is reasonable only if T2 does not claim canonical percentage semantics; it currently does.  
  Falsified by: updating the shared predicate consistently with `count_values`/`count_empty`, or proving percent rollups are not user-reachable.

Additional observations:

- The formula-array consumer is not affected: it only permits sum/avg/min/max/median. [extended evaluator](src/lib/formula/extendedEvaluator.ts:140) Dashboard Stats and the footer already consume numeric percentage values and render `null` as `—`. [Stats](src/ui/views/Dashboard/widgets/Stats/StatsCard.svelte:24) · [footer](src/ui/views/Dashboard/widgets/DatabaseCall/TableFooter.svelte:18)

- **Renderer hazard, reachability UNKNOWN:** both percent renderers turn `null` into visible `0%`. [Grid rollup cell](src/ui/views/Table/components/DataGrid/GridCell/GridRollupCell/GridRollupCell.svelte:21) · [standalone renderer](src/ui/components/RollupCellRenderer/RollupCellRenderer.svelte:76) I did not establish a live source-level mount for those components, so this is not a merge finding by itself. A null-percent renderer test would falsify it immediately.

- **Median remains an acknowledged P2 gap, not a new #180b regression.** Kernel median on empty still returns `0`; Stats and the footer delegate to it, while formula aggregation pre-guards empty input as `null`. [kernel](src/lib/engine/aggregate.ts:158) · [Stats/footer adapter](src/lib/dashboard-engine/aggregation.ts:203) The spec requires `null`. [SPEC](docs/internal/SPEC_MATH_SPREADSHEET_2026-09-02.md:226) It can remain deferred only with the merge claim narrowed accordingly and an owned follow-up.

I attempted the targeted Jest suites, but the sandbox prevented Node from resolving `C:\Users\Park` (`EPERM`), so no test-pass claim is made.

