# PLAN #178 — `lib/engine/contracts.ts` describes an engine that was never built (2026-09-02)

> Architect pass (read-only), base `main` = `06b2ab9`, written against the post-#179 state. Status:
> **awaiting one user decision** (at the end); not to be implemented before it is recorded as `RESOLVED`
> in `BACKLOG.md` #178.

**This plan must be written to `docs/internal/BACKLOG.md` (#178 entry, ~line 3360) with the user decision recorded as `RESOLVED 2026-09-02` before implementation.**

## Recommendation: **B**, in the form "delete the code, keep the design as a document outside `src/`" (B with C's archival half). Reject A.

**Why not A.** `FilterCondition`/`FilterIR` (contracts.ts:147-165) key on `op` with a `DataValue` payload; the live stored shape is `FilterDefinition` in `settings/base/settings.ts`, evaluated by `filterEvaluator.ts`. Building that layer *is* a second filter representation — invariant 2, directly. And `AggregateFn` (contracts.ts:182-198) is not a superset of the live alphabet: `RollupFunction` (`src/lib/engine/aggregate.ts:27-48`) has `count_total`, `count_values`, `percent_empty/_not_empty`, `percent_true`, `concat`, `concat_unique`, `show_original`, `show_unique`, none of which exist in `AggregateFn`; `AggregateFn` has `count_not_empty`, `first`, `last`, `list`, `list_unique`, `earliest`, `latest`, none of which exist live. `RollupFunction` is persisted (`settings/base/settings.ts:282`, `aggregate.ts:50-58 RollupConfig.function`). So #180's unification must converge on `RollupFunction`; adopting `AggregateFn` would rename stored values. No PRODUCT_RESET scene asks for a DataEngine.

**Why not C alone.** The file is `import type`-only but still typechecked, linted and grep-able as `src/`. And C cannot be done alone: the two importers would stop compiling.

## Correction to the ticket's premise (verified 2026-09-02)

The ticket says "`RecordId` 1 file, `ProjectId` 22 files". True syntactically, misleading:

- `ProjectId` is **defined at `src/settings/base/settings.ts:6`**; `contracts.ts:87` only re-exports it. Of the ~21 live consumers, **every one imports from the settings barrel** (`src/settings/settings`, `./settings/settings`, relative `../settings/settings`) — **not one** imports it from `engine/contracts`.
- Only **two** files import from `src/lib/engine/contracts`: `src/lib/colors/contracts.ts:17` (`ProjectId`) and `src/lib/relations/contracts.ts:18` (`ProjectId`, `RecordId`).
- **Both of those files are themselves 100% dead.** Grepped each exported symbol across `src/`: `RelationKind`, `RelationRef`, `RelationIndexableRecord`, `RelationIndex`, `PresetColorId`, `ColorToken`, `ColorPalette`, `PaletteScope`, `PaletteSnapshot`, `PaletteStore` — **zero** matches outside their own file. Nothing imports `src/lib/relations/contracts` or `src/lib/colors/contracts` by any path (no `index.ts` barrel exists in either directory).

**So `RecordId` has zero live consumers, and the module move in option B has an importer list of exactly two — both of which are deleted.** Nothing moves. `ProjectId` stays where it already lives.

Two more supporting facts: `src/lib/relations/contracts.ts:71-83` declares `RelationIndex` as a class-shaped `forward/inverse/rebuild/invalidate` interface; the live `src/lib/relations/inverseIndex.ts` is pure functions over `InverseIndex = Map<string, InverseIndexEntry[]>` (`:32`, `:109`, `:153`) — a different design, so nothing live implements the dead contract. And `docs/ARCHITECTURE_V5.md:247-254` (§3.6, R5-005) planned to *revive* `colors/contracts.ts` as the single palette source — that ticket shipped as `src/lib/stores/palettes.ts` (header line 2: "(R5-005)"), which declares its own `Favorite { color, name }` and never touches the contract. The future the file was kept for arrived and went around it.

## Affected files

**Delete (all three type-only, zero runtime emit — verified: no `const/let/var/function/class/enum` in any):**

| File | Lines | Why |
|---|---|---|
| `src/lib/engine/contracts.ts` | 351 | the ticket's subject |
| `src/lib/relations/contracts.ts` | 83 | only importer of `RecordId`; fully dead; `RELATION_CONTRACT_ANALYSIS_111.md:21` already recommended "remove its normative claim" |
| `src/lib/colors/contracts.ts` | 81 | other importer; fully dead; superseded by `stores/palettes.ts` |

**Edit (comments/docs):**

- `src/lib/dashboard-engine/transformTypes.ts:18-25` and `:62-64` — both cite `lib/engine/contracts.ts` / `TransformStepIR` as a live file; rewrite to past tense ("deleted by #178"), keeping the `type`-vs-`kind` seeding-trap warning, which is about the migrator and stays true.
- `src/__tests__/R0_14_duplicateExportedTypeNames.test.ts` — header lines 4-11 and 19-25 cite `lib/engine/contracts.ts` as existing. **Logic needs no change**: `collectModules` walks `engine/` and `dashboard-engine/` by directory, the synthetic cases (`:118-128`) use string literals, and `engine/` keeps other files so `modules.length > 0` holds. Prose only — the R0.4 "HISTORICAL" pattern.
- `docs/ARCHITECTURE_V5.md:135` — the row claims `contracts.ts | unit tests`; **there is no `contracts.test.ts`** (`src/lib/engine/__tests__/` holds aggregate, crossProjectResolver, crossProjectRollup, emptiness, filterCompose, filterEvaluator, twoProjects.integration, wikilink). Drop `contracts.ts` from the row — it was false before this ticket.
- `docs/ARCHITECTURE_V5.md:167` — `colors/{math,contracts}` → `colors/math`.
- `docs/ARCHITECTURE_V5.md:247-254` (§3.6) — record that R5-005 shipped as `stores/palettes.ts` and the contract was not revived.
- `docs/internal/CONTEXT.md:82-86` — "two facts … did NOT fix": one is now fixed, the other is #179.
- `docs/internal/RELATION_CONTRACT_ANALYSIS_111.md:21` — record which of its two options was taken.
- `docs/internal/BACKLOG.md:3360-3372` — #178 → DONE with this reasoning.
- Also note in the archived doc: `contracts.ts:61-62` `@see docs/ARCHITECTURE_V4.md` and `docs/PHASE_3_TICKETS.md` — **neither file exists anywhere in the repo** (`find` returned nothing). The header's own references are already dangling.

**New (the C half):** `docs/internal/archive/ENGINE_CONTRACTS_V4_DESIGN.md` — verbatim body of the three deleted files plus a dated note on why they were not built. Nothing written deliberately is lost; it just leaves `src/`.

## Stored data

**Nothing migrates.** All three files are erased at compile time; none of their symbols is a persisted value. The persisted vocabularies (`RollupFunction`, `FilterDefinition`, `TransformStep` keyed on `type`) live elsewhere and are untouched. The `DataTableConfig.subBases` precedent does not apply: no key here ever reached a vault.

## Tests referencing `contracts.ts`

- `src/__tests__/R0_14_duplicateExportedTypeNames.test.ts` — **stays green unedited** (reasoning above); prose updated.
- No other test references it. Grep over `src/__tests__/` and `src/lib/engine/__tests__/` found only `R_filterOrder.invariant.test.ts:11`, which is the word "contract" in prose, not this file.
- No test file is deleted, so the jest baseline in `CONTEXT.md` must hold exactly, not rise or fall.

## Order

1. **#179 must be committed and merged first.** It is uncommitted in the working tree right now (`M src/lib/engine/contracts.ts`, `M transformTypes.ts`, `?? R0_14_…test.ts`) and renames `TransformStep`→`TransformStepIR` at `contracts.ts:288`. Running #178 in parallel produces a delete/modify conflict and risks losing R0.14, which is the durable value of #179 and survives #178 intact.
2. Then #178 on a branch off the merged `main`. Deletion first, doc edits second; fully reversible via `git revert` since the content also lands in the archived doc.

## Risks (what the gates would not catch)

- **A branch in flight.** Checked: `feat/103-filter-unification`, `docs/174-tsdoc-remainder`, `fix/176-…` contain only the same two dead importers, no consumer of `FilterIR`/`AggregateFn`. `feat/103` would need a trivial rebase, not a redesign.
- **Scope beyond the ticket's letter.** #178 names one file; the fix deletes three. This is the letter/intent divergence rule — the other two are forced (they are the only importers) and independently dead. Say it out loud in the commit rather than letting it look like drift.
- **Losing an intent nobody re-derives.** Mitigated by the archived doc, not by leaving dead code in `src/`.
- **UNKNOWN:** whether the user still wants a Unified DataEngine as a direction. That is the decision below, not something I can read off the tree.

## Observable result an auditor can check

1. `git grep -n "engine/contracts" -- src/` → **no output**.
2. Three files absent; `docs/internal/archive/ENGINE_CONTRACTS_V4_DESIGN.md` present.
3. `npx tsc -noEmit` → 0 errors. This is the real proof that nothing consumed them.
4. `npm test` → baseline from `CONTEXT.md` holds unchanged; R0.14 green.
5. **`main.js` and `styles.css` byte-identical before and after** (`git diff --numstat` shows only sources) — type-only deletions cannot change the bundle. Same check #174 used.

## Size and staffing

**S** to implement (three deletions, ~8 comment/doc edits, no logic). `lead` does it plus the four gates and an `auditor` pass — no `implementer`. The M/analysis_required weight was the decision, and this pass is it.

## USER decision — required (deletes 515 lines of deliberately written design)

> **#178: delete `src/lib/engine/contracts.ts` and the two dead files that import it (`lib/relations/contracts.ts`, `lib/colors/contracts.ts`, 515 lines, zero live consumers, zero stored data), preserving their text as a dated design record in `docs/internal/archive/` — yes/no?**
> Recommended default: **yes**.

**What would make me wrong:** if the Unified DataEngine is still an intended direction rather than an abandoned one — in which case A is right and this is premature deletion; or if `ColorPalette`/`PaletteStore` are meant to be revived on top of `stores/palettes.ts` rather than superseded by it (`ARCHITECTURE_V5.md` is dated 2026-05-07, predates the 2026-07-18 product reset, and its central sub-base paradigm was already withdrawn in #160 — but it is still listed as a live target document in `DOCS_INDEX.md:24`). Both are questions about intent, and only the user can answer them.