# Architectural Decision Log — v4.0 refactor

> **Era note**: D-001..D-018 are from the V4 refactor phase (2026-05-03..2026-05-05).
> Ticket IDs use V4 numbering (REFACTOR-NNN). V5 phase uses R5-NNN (see REFACTOR_BACKLOG_V5.md).
> Reserved slots D-019/D-020 were never filled — V5 superseded these concerns.

Append-only. Every non-trivial decision recorded with date, rationale, alternatives.

---

## 2026-05-03 — D-001: Atomic rename "Database View" → "Dashboard View"
- **Decision**: rename top-level abstraction in single ticket REFACTOR-004; backward-compat reader accepts both `"database"` and `"dashboard"` `view.type` values forever.
- **Rationale**: avoids "live during refactor" naming hell; user-facing wording matches Notion / Obsidian Bases convention.
- **Alternative rejected**: incremental rename per file — would litter codebase with mixed naming.

## 2026-05-03 — D-002: Unify aggregation by IMPORT, not by REWRITE
- **Decision**: `aggregation.ts` and `formulaEngine.SUM/AVG/...` IMPORT `aggregate()` from `lib/engine/aggregate.ts`. No reimplementation.
- **Rationale**: rollup.ts kernel is well-tested and proven. Re-deriving introduces rounding drift risk.
- **Alternative rejected**: design new aggregation interface from scratch (R2.1b kernel was already canonical).

## 2026-05-03 — D-003: Filter unify via `FilterIR` evaluator
- **Decision**: extract `evaluateFilter(record, ir, schema)` once; both `filterFunctions.matchesCondition` and `transformExecutor.executeFilter` become thin wrappers.
- **Rationale**: dual filter engine is C1 architectural conflict; differs on undefined+negative semantics (R2.1c) — currently violated in transformExecutor.
- **Alternative rejected**: deprecate one filter path — but both surfaces are legitimate (project-level & pipeline).

## 2026-05-03 — D-004: Defer legacy `views/Table/` deletion
- **Decision**: deprecate (REFACTOR-306) but keep functional through one minor release; delete in subsequent ticket post-v4.0.
- **Rationale**: hard cutover risks user data loss with custom Table column configs not yet migrated to StrictGrid.

## 2026-05-03 — D-005: SubBase relations resolve through parent project records
- **Decision**: cross-SubBase relation lookup = parent index forward + SubBase predicate filter.
- **Rationale**: avoids per-SubBase index proliferation; preserves Matryoshka semantics where SubBase = derivable view, not new record store.
- **Alternative rejected**: separate index per SubBase — O(N×M) memory.

## 2026-05-03 — D-006: FrontmatterWriter as the SOLE mutator
- **Decision**: ban direct `app.fileManager.processFrontMatter` outside `lib/frontmatter/`.
- **Rationale**: enforces type-preserving codec; single retry/race-protection point; testability.

## 2026-05-03 — D-007: Public types package bumps MAJOR
- **Decision**: `obsidian-projects-types` 3.0.0 (was 2.x). Sync to internal API drift in REFACTOR-007.
- **Rationale**: external consumers need v3 features (`dateFormat`, `agenda`, `getRecordColor`, etc.) and must opt in explicitly.

## 2026-05-03 — D-008: Aggregate fn names canonical = Notion-style underscores
- **Decision**: `count_unique`, `count_empty`, `count_not_empty`, `list_unique` etc. (snake_case).

---

## 2026-05-04 — D-009: Layer 0 contracts: keep `DataSource`/`ProjectSchema` as placeholders
- **Decision**: in `src/lib/engine/contracts.ts`, `DataSource` is `unknown` and `ProjectSchema` is a minimal `{ fields: readonly DataField[] }`. Concrete narrowing deferred to REFACTOR-007 (public types sync) and the runtime `evaluateFilter` (REFACTOR-104).
- **Rationale**: Layer 0 must compile in isolation with **only** `lib/dataframe`, `settings/base`, `lib/database/rollupMode`, `lib/helpers/formulaParser` as deps. Pulling `lib/datasources/index.ts` (which carries the abstract `DataSource` class) creates risk of a future circular import once Layer 1 evaluators land in `lib/engine/`.
- **Alternative rejected**: import `DataSource` from `settings/v3/settings.ts` — couples engine contracts to versioned settings module and survives only until v4 schema lands.

## 2026-05-04 — D-010: Two `FilterCondition` types coexist during migration
- **Decision**: the canonical engine `FilterCondition` (`op` / `value?: DataValue`) is exported from `lib/engine/contracts.ts`; the legacy settings `FilterCondition` (`operator` / `value?: string`) in `settings/base/settings.ts` remains untouched until REFACTOR-104 lands the bridge.
- **Rationale**: REFACTOR-005 acceptance forbids modifying any consumer file. Renaming the settings type now would touch ~80 call sites and silently change persisted JSON shape semantics.
- **Alternative rejected**: alias-export the legacy type as canonical — would lock the engine into `string`-only values forever.

## 2026-05-04 — D-011: Dashboard rename keeps `"database"` as runtime alias forever
- **Decision**: in `view.ts::getProjectViews()`, register both `views["dashboard"]` and `views["database"]` pointing at the same `DashboardView` instance. The settings v3 migrator rewrites stored `view.type === "database"` to `"dashboard"` on next load; the alias guarantees v3 saves render correctly even before the migrator runs (e.g. read-only edge cases or third-party tools writing to the JSON).
- **Rationale**: zero-friction back-compat. The migrator is idempotent and writes `"dashboard"` on save, so the alias is exercised only by unmigrated saves and tests pinning the legacy literal.
- **Alternative rejected**: hard-cutover (only `"dashboard"` recognized) — would brick saves on plugin downgrade and surprise users with templates pinned to `"database"` in markdown.

## 2026-05-04 — D-012: `lib/database/` namespace not renamed
- **Decision**: only the **view** is renamed (`views/Database/` → `views/Dashboard/`, `views.database.*` i18n → `views.dashboard.*`). The unrelated module `src/lib/database/` (cell-editor, rollup mode taxonomy) and its i18n namespace `database.*` (cell-editor errors, rollup mode labels) are intentionally **not** renamed.
- **Rationale**: `lib/database/` is the data-model layer (`subBase`, `cellEditor`, `rollupMode`), not the view. Renaming it would touch ~120 unrelated callers for no semantic gain and contradict the "Dashboard = view, SubBase = data primitive" split (ARCHITECTURE_V4 §2.2).
- **Alternative rejected**: rename for visual symmetry — would erase the meaningful distinction the v4 architecture establishes.
- **Rationale**: matches Notion docs vocabulary; existing `rollupMode.ts` taxonomy already uses this convention.

---

## 2026-05-04 — D-013: Public types package inlines internal types rather than literal re-export
- **Decision**: `obsidian-projects-types/index.ts` (v3.0.0) declares the public surface as self-contained inlined types/enums/classes, NOT as `export * from "src/customViewApi.ts"` literal re-exports.
- **Rationale**: the package must build standalone (its only devDep is `typescript` ^4.8.3; no Obsidian, no plugin source). A literal re-export would force consumers to install the entire host plugin source tree and pull `obsidian` as a transitive dep. The v4.0 ticket spec phrasing "re-export from src/customViewApi.ts" is interpreted as **structural mirror with the host as single source of truth**, enforced by the synchronisation header at the top of `index.ts` rather than by the module system.
- **Concrete consequences**:
  - `FilterOperator` is an open `string` union in the public package; the host plugin owns the closed alphabet.
  - `DateFormatConfig` and `AgendaConfig` are opaque `Readonly<Record<string, unknown>>` — external custom views cannot construct them, only pass them through.
  - Whenever `customViewApi.ts` adds a public field, REFACTOR-007 must be re-opened and the package republished with a major bump (per D-007).
- **Alternative rejected**: ship the package with `obsidian-projects-plus` as a peer dep and literally re-export — defeats the purpose of a thin types-only package and breaks the standalone build invariant in `obsidian-projects-types/tsconfig.json`.

---

## 2026-05-04 — D-014: CommandManager owns show-command lifecycle; main.ts is a facade
- **Decision**: `src/managers/CommandManager.ts` is the sole implementation of show-command sync. `main.ts::ensureCommands` is preserved as a public method on the plugin class but only delegates: `commandManager.ensureCommands(…); commandManager.finalizeRegistrations(this);`. The freestanding `getShowCommandId` helper and `PROJECTS_PLUGIN_ID` constant are removed from `main.ts`.
- **Rationale**: ticket REFACTOR-008 explicitly required "0 duplicate methods between files". Keeping the facade method (rather than inlining the call at the single subscriber site) preserves the `plugin.ensureCommands(…)` contract that tests and any future external triggers may rely on, at zero duplication cost.
- **Concrete consequences**:
  - Plugin commands prefixed by anything other than `obs-projects-plus:show:` are no longer at risk of being wiped by `getRegisteredCommandIds` (previous CM impl used `obs-projects-plus:` and would have nuked e.g. `obs-projects-plus:settings` in future).
  - View-only deletions now trigger unregistration of the orphaned scoped command (was a silent leak in the previous CM impl).
  - `CommandHost` interface (only `addCommand`) replaces `any` parameter on `finalizeRegistrations`, restoring strict-mode safety while remaining test-mockable.
- **Alternative rejected**: hard-delete `ensureCommands` from `main.ts` and call `commandManager` directly from the settings subscriber — would break any hypothetical external caller of `plugin.ensureCommands` and complicate the lazy-init defensive branch.

---

## Reserved entry slots (next decisions expected)

- D-019 (Layer 2): backup file location convention (`.obsidian/plugins/.../backup-YYYYMMDD.json`?)
- D-020 (Layer 3): StrictGrid column-resize persistence schema (% vs px)

---

## 2026-05-05 — D-015: REFACTOR-105 keeps `stripToPath` and `stripToDisplay` as separate kernel functions
- **Decision**: `src/lib/engine/wikilink.ts` exports two distinct strip helpers: `stripToPath(value)` drops the alias and returns the canonical link target; `stripToDisplay(value)` returns the alias when present, otherwise the path.
- **Rationale**: both semantics are in active use across the codebase and not interchangeable. `lib/datasources/helpers.ts` (relation indexing) and `engine/crossProjectResolver.ts::normalizeRelationValue` need **path** semantics so equality joins resolve regardless of how the user labelled the link. `ui/views/Calendar/agenda/filterEngine.ts::stripWikiLink` needs **display** semantics so user-typed aliases drive filter substring matches and visible cell text. Collapsing into one function would silently regress one of the two surfaces.
- **Alternative rejected**: single canonical strip + caller-side post-processing — would reintroduce the very inline logic the ticket consolidates.

## 2026-05-05 — D-016: REFACTOR-105 pins malformed `[[Foo|]]` contract verbatim
- **Decision**: `parseWikilink("[[Foo|]]")` returns `{ path: "Foo|" }` (the trailing pipe is absorbed by the lazy path group when the alias group fails to match a non-empty token). The kernel test pins this output as a regression detector rather than fixing it.
- **Rationale**: the pre-refactor regex (`/^\s*\[\[([^\]]+?)(?:\|([^\]]+))?\]\]\s*$/`) had identical behaviour. Obsidian's link autocompleter never emits this shape — a pipe with no alias is not a valid wikilink in the editor. Tightening the regex (e.g. `[^\]|]+?` for the path body + `[^\]]*` for alias) would silently change behaviour for user notes that were authored against the legacy contract and are now surviving in the wild.
- **Alternative rejected**: harden the regex and emit `{ path: "Foo" }` — better-looking but is a behaviour change in a kernel-extraction ticket whose AC is "zero semantic drift".

## 2026-05-05 — D-017: REFACTOR-106 splits emptiness into TWO predicates instead of one
- **Decision**: `src/lib/engine/emptiness.ts` exports `isNullish(v)` (null/undefined only) and `isEmpty(v)` (nullish ∪ `""` ∪ `[]`), plus `isNotEmpty` as strict negation of `isEmpty`. Sort comparators delegate to `isNullish`; filter `is-empty` operator, agenda filter engine, and formula `EMPTY()` delegate to `isEmpty`.
- **Rationale**: a single universal predicate would either erase the sort-stable distinction (where `0` and `""` are real values to be ordered, not skipped to the end) or break the filter contract (where `""` must be treated as empty for "Status is empty" UX to work). Both contracts are user-visible; they are not implementation details that can be unified by fiat.
- **Concrete consequences**: `viewSort.ts::isEmpty` (local) was renamed in spirit only — its body now `return kernelIsNullish(v)` and its name kept for call-site readability. `filterEvaluator.ts::baseFns["is-empty"]` body now `return kernelIsEmpty(v)`; the inline 4-clause check is gone.
- **Alternative rejected**: single `isEmpty` with a `treatZeroAndEmptyStringAsValue` opt-in flag — every caller would need to remember to pass the flag, defeating the unification.

## 2026-05-05 — D-018: REFACTOR-107 fills the engine coverage gap WITHOUT duplicating existing tests
- **Decision**: only three of the seven targets listed in REFACTOR-107 receive new dedicated test files: `joinKey` (24 cases), `relationResolver` (17 cases), `formulaParser` (23 cases — direct API). The other four (`crossProjectResolver`, `crossProjectRollup`, `inverseIndex`, `subBasePartition`) already had passing dedicated suites at the start of the ticket; adding parallel files would have produced duplicate coverage with no marginal value.
- **Rationale**: the AC threshold ("≥7 new test files; each ≥5 cases; total +60 tests") is a **proxy** for coverage, not a goal in itself. Three new files contributed +64 cases to surfaces that genuinely lacked direct tests; the four already-covered targets had verified suites in `src/lib/relations/__tests__/`, `src/lib/database/__tests__/` and `src/lib/engine/__tests__/`. Spirit of the ticket > letter.
- **Alternative rejected**: cargo-cult a duplicate test file per target — would slow the suite and create two sources of truth where one suffices.
