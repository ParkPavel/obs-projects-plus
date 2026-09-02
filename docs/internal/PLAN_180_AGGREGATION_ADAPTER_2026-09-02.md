# PLAN #180 — the pipeline aggregation vocabulary must reach the kernel (2026-09-02)

> Architect pass (read-only), base `main` = `06b2ab9`. Status: **awaiting four user decisions** listed at the
> end; not to be implemented before they are recorded as `RESOLVED` in `BACKLOG.md` #180.

**This plan must be written to `docs/internal/BACKLOG.md` (#180 section) before implementation.** I am read-only.

## Contract
`computeAggFn` stops owning the math for the operators the kernel already owns, and becomes an adapter over `src/lib/engine/aggregate.ts` — **without any change to what is stored on disk**. Stored `AggregationFunction` strings (`SUM`/`AVG`/…) stay exactly as they are.

## Affected files (all lines opened this session)
| File | Lines | Why |
|---|---|---|
| `src/lib/dashboard-engine/transformExecutor.ts` | `785-799` `extractNumericValues`, `804-888` `computeAggFn`, call sites `929`, `1056`, `1178` | the subject |
| `src/lib/engine/aggregate.ts` | `73-181` `aggregate()`, `185-196` `toNumbers` | the kernel it must call |
| `src/lib/dashboard-engine/aggregation.ts` | `33-53` `KERNEL_OPS` + `NULL_ON_EMPTY`, `88-101`, `184-195` | **the precedent to copy** (REFACTOR-102: partial delegation with a named exception set) |
| `src/lib/database/rollupMode.ts` | `1-26` header, `27` | second precedent: a surface vocabulary mapped down, "the kernel is unchanged; we only re-shape the picker" |
| `src/lib/dashboard-engine/transformTypes.ts` | `23-28` (header claim), `222-248` (`AggregationFunction`) | the header states the non-delegation as fact; it must change with the code |
| `src/lib/dashboard-engine/chartDataPipeline.ts` | `21-33` `toAggFn` | third mapping table; `count_total → "COUNT"` is the live evidence pipeline `COUNT` means *count_total*, not kernel `count` |
| `src/lib/dashboard-engine/transformExecutor.test.ts` | `655-764` | the only pinned pipeline aggregation behaviour today |

## Stored shapes touched
**None.** No migration, no `widget.transform` rewrite, no `type`/`kind` trap exposure. `PipelineEditor.svelte:94-98` keeps emitting the same 13 UPPERCASE names; `:384` and `:404` keep writing them.

## Semantic differences observed today (each is a behaviour change on delegation)
Kernel `toNumbers` (`aggregate.ts:185-196`) uses `parseFloat`; pipeline `extractNumericValues` (`transformExecutor.ts:790-797`) uses `Number`. Verified in node:

| Input | pipeline `Number` | kernel `parseFloat` | Effect |
|---|---|---|---|
| `""`, `"  "` | `0` — **counted** | dropped | AVG/MEDIAN/MIN skew toward 0 in the pipeline |
| `"12abc"` | dropped | `12` — counted | opposite direction |
| `"0x10"` | `16` | `0` | opposite direction |

1. **`extractNumericValues:786-788` is inconsistent with itself.** Non-array input returns `[]` unless it is `typeof number` — a scalar string `"5"` sums to `0`, while `["5"]` sums to `5`. The kernel has no such branch.
2. **`MIN`/`MAX`/`RANGE` on empty → `null`** (`transformExecutor.ts:839,844,849`); kernel → `0` (`aggregate.ts:127,132,149`). `aggregation.ts:49-53` already carries a `NULL_ON_EMPTY` exception set for exactly this — reuse it, do not re-litigate it.
3. **`COUNT` (`:813`) is `arr.length`, nulls included** ≡ kernel `count_total` (`aggregate.ts:88-89`), **not** kernel `count` (`:85-86`, non-null). `executeGroupBy` (`transformExecutor.ts:766-768`) builds group arrays with `records.map(...)`, so missing values are present as `undefined` — the difference is live, not theoretical.
4. **`COUNT_DISTINCT` (`:816`) ≡ kernel `count_unique` (`aggregate.ts:111-114`) exactly** — both null-filter then `String`. Safe delegation, no behaviour change.
5. **`AVG` empty → `0`** (`:825`) = kernel (`aggregate.ts:121`). But `computeAggregateValue` returns `null` for the same case (`aggregation.ts:192-193`, comment says "legacy contract"). The three-way disagreement predates this ticket; delegation does not resolve it.
6. **`SUM`/`MEDIAN` empty → `0`** on both. `MEDIAN` even-count = mean of the two middles on both (`:832-834` vs `aggregate.ts:140-142`). Only coercion differs.
7. **No kernel equivalent at all:** `FIRST` (`:852`), `LAST` (`:855`), `STD_DEV` (`:858`), `PCT_EMPTY` (`:866`), `PCT_NOT_EMPTY` (`:875`). Kernel `percent_empty`/`percent_not_empty` (`aggregate.ts:99-109`) return a **string** `"NN%"` and treat `false` as empty; the pipeline returns a **number 0-100** and treats empty arrays as empty. These are not the same operator and must not be mapped.
8. `NaN` as a literal number is pushed by both. Booleans and `Date` dropped by both. Objects stringify identically under `count_unique`/`COUNT_DISTINCT`. No divergence.
9. UNKNOWN: whether any real vault stores a `pivot`/`join` step with `aggregation` at all — I did not inspect `OBStests`.

## Recommendation — Option (1), the adapter
Delegate the operators the kernel owns (`SUM`, `AVG`, `MEDIAN`, `MIN`, `MAX`, `RANGE`, `COUNT`→`count_total`, `COUNT_DISTINCT`→`count_unique`) through a `KERNEL_OPS`-shaped map, keep `FIRST`/`LAST`/`STD_DEV`/`PCT_*` inline with a comment saying *why* (no kernel equivalent / different return type), keep `NULL_ON_EMPTY` for `MIN`/`MAX`/`RANGE`. Delete `extractNumericValues` so one coercion survives.

- **Option (2) rejected:** renaming stored keys buys nothing the adapter does not, and spends a migration on `widget.transform` — the one place `MANUAL_TESTING_PIPELINE.md` §4a says silently swallows a malformed step. The cost is real, the benefit cosmetic.
- **Option (3) rejected:** a contract test pinning two implementations equal is a ratchet on a duplication we have already decided to remove; it also cannot pass today (differences 1-3 are real).
- **What would make (1) wrong:** if the coercion change (`""` → no longer 0) turns out to be load-bearing for a shipped dashboard. Guard: the differential test below runs *before* the change.

## Tests
1. **`transformAggregationDifferential.test.ts` — written and committed BEFORE the change**, over a fixture of `[]`, `[null]`, `[undefined]`, `[""]`, `["  "]`, `["12abc"]`, `["0x10"]`, `[0]`, `[false]`, `[NaN]`, `[1,2]`, `[1,2,3,4]`, `[{},{}]`, plus scalar (non-array) inputs. It records **today's** pipeline output per operator. Then the change flips exactly the assertions listed in §1-3 and nothing else — that diff *is* the review artifact.
2. Extend it to assert scalar `"5"` and `["5"]` agree after the change (defect 1 closed).
3. Keep `transformExecutor.test.ts:655-764` green unchanged — none of those fixtures contain nulls or numeric strings, so they must not move.

## Docs
- `transformTypes.ts:23-28` and `:226-234` — both say the pipeline does not delegate. Rewrite to state what delegates and what deliberately does not.
- `docs/internal/BACKLOG.md` #180 — resolution + the `RESOLVED` answers below.
- `docs/internal/FILTER_MODEL.md:43` names `aggregate` in axis C; add one line that axis C's aggregation math is the kernel's.

## Risks the four gates will not catch
Silent numeric drift in a user's saved dashboard (`""` no longer counted as 0 in an AVG). Gates only see fixtures. Mitigation: the pre-change differential test, plus an adversarial Codex review on the delta (this changes existing behaviour → required by CLAUDE.md).

## Observable result for an auditor
`grep -n "engine/aggregate" src/lib/dashboard-engine/transformExecutor.ts` returns an import; `extractNumericValues` no longer exists; the differential suite shows exactly the expected flipped assertions and no others.

## Size / staffing
**M.** `implementer` yes — one file of logic, one new suite, two doc headers. Route `code-mapper` → `implementer` → `auditor`, then adversarial review. Three hops, at the limit.

## USER decisions (record as `RESOLVED 2026-09-02` in BACKLOG before work starts)
1. Pipeline `AVG` of `["", "10"]` is `5` today and would become `10` under the kernel — which ships? **Default: the kernel (`10`); an empty cell is not a zero.**
2. Pipeline `SUM` of `["12abc"]` is `0` today and would become `12` under the kernel — which ships? **Default: the kernel (`12`), for one coercion rule, accepting it is the weaker half of the trade.**
3. Pipeline `MIN`/`MAX`/`RANGE` of an empty group is `null` today, kernel says `0` — keep `null`? **Default: yes, keep `null`, same reasoning as `aggregation.ts:43-53`.**
4. Pipeline `COUNT` counts nulls (≡ `count_total`). Keep that, or make it non-null `count`? **Default: keep counting nulls — `chartDataPipeline.ts:29` maps `count_total → COUNT`, so changing it would silently alter every chart.**