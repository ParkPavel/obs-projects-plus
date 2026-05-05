# Phase 1 — Codebase Mapping & Quality Grading

> **Status**: AUTHORITATIVE inventory.
> **Created**: 2026-05-03 (Refactoring Session v4.0 / Phase 1).
> **Scope**: All 488 source files (292 TS + 196 Svelte) across `src/`, `obsidian-projects-types/`.
> **Method**: Three parallel read-only Explore agent passes (engine / UI / settings+lifecycle). Findings synthesized.
> **Reality anchor**: `manifest.json` `3.4.2`. ~87 800 LOC. Jest baseline 80 suites / 1176 tests.

---

## 0. Headline findings

| Severity | Count | Examples |
|---|---|---|
| **P0 (security/data-loss)** | 3 | ReDoS in `formulaEngine.ts` `REGEX_MATCH/REPLACE`; ReDoS in `FilterRow.svelte` `new RegExp(filterValue, 'i')`; `migrateSettings` no try/catch |
| **P1 (architectural)** | 7 | Dual filter engine; **triple** aggregation kernels (rollup.ts vs aggregation.ts vs formulaEngine.SUM); Table view F-grade; FieldControl reactive prop bug; CommandManager dead code; FileSystemWatcher leak in `onunload`; obsidian-projects-types out of sync |
| **P2 (debt)** | 12 | Color picker logic duplicated (RecordItem reinvents 300 LOC); a11y `outline:none` × 30 files; hardcoded px × 100+ instances; rollup `function`↔`mode` invariant unenforced; cross-project resolver no test; cross-project rollup no test; sub-base partition no test |
| **P3 (polish)** | ≥20 | i18n holes (Russian leaked into Calendar/ColorPicker hardcoded strings); JSDoc gaps; metadata catalog untested |

---

## 1. Quality grade distribution

| Layer | A | B | C | D | F | TOTAL |
|---|---|---|---|---|---|---|
| `src/lib/` engine | 8 | 12 | 1 | 0 | 0 | 21 |
| `src/ui/views/Database/engine/` | 6 | 4 | 1 | 1 | 0 | 12 |
| `src/ui/app/` | 3 | 4 | 0 | 0 | 0 | 7 |
| `src/ui/components/` | 18 | 14 | 1 | 2 | 1 | 36 |
| `src/ui/modals/` | 10 | 6 | 1 | 0 | 1 | 18 |
| `src/ui/views/Board/` | 8 | 7 | 0 | 0 | 0 | 15 |
| `src/ui/views/Calendar/` | 8 | 12 | 4 | 1 | 1 | 26 |
| `src/ui/views/Database/widgets/` (UI) | 8 | 12 | 2 | 1 | 0 | 23 |
| `src/ui/views/Database/` (canvas) | 4 | 1 | 0 | 1 | 0 | 6 |
| `src/ui/views/Gallery/` | 6 | 3 | 0 | 0 | 0 | 9 |
| `src/ui/views/Table/` (legacy) | 3 | 8 | 1 | 0 | 0 | 12 |
| `src/ui/views/VisualizerPane/` + `YamlVisualizer/` | 1 | 3 | 1 | 0 | 0 | 5 |
| `src/settings/` | 3 | 3 | 1 | 0 | 0 | 7 |
| `src/managers/` | 0 | 0 | 1 | 0 | 0 | 1 |
| `src/main.ts`/`view.ts`/etc shell | 2 | 3 | 0 | 0 | 0 | 5 |
| **TOTALS** | **88** | **92** | **13** | **5** | **3** | **203 graded** |

Note: 285 of 488 files are auto-graded "A" (small leaf components — Layout/Box/Flair/etc.) and rolled into "A" totals.

---

## 2. Engine layer — top issues

| File | LOC | Grade | Issue | Priority |
|---|---|---|---|---|
| `src/ui/views/Database/engine/formulaEngine.ts` | 1300 | **D** | **ReDoS** at L745 (`REGEX_MATCH`) and L754 (`REGEX_REPLACE`): `new RegExp(userPattern)` without `isUnsafePattern()` guard | **P0** |
| `src/ui/views/Database/engine/aggregation.ts` | 270 | **C** | Duplicates `rollup.aggregate()` semantics (sum/avg/min/max/count) — should import not reimplement | P1 |
| `src/ui/views/Database/engine/transformExecutor.ts` | 1170 | B | Filter step uses inline operator switch — not the same as `lib/datasources/filterFunctions.ts` (dual filter) | P1 |
| `src/lib/helpers/formulaParser.ts` | 500+ | B | No test file; canonical formula parser; risk of silent regression | P1 |
| `src/lib/engine/crossProjectResolver.ts` | 180 | B | No test; WeakMap memo strategy untested | P2 |
| `src/lib/engine/crossProjectRollup.ts` | 150 | B | No test; type-mismatch handling untested | P2 |
| `src/lib/relations/inverseIndex.ts` | 200 | B | No test; index correctness untested | P2 |
| `src/lib/database/cellEditor.ts` | 200 | B | Has test (R2.6) — keep | — |
| `src/ui/views/Database/engine/relationResolver.ts` | 150 | C | No test; wiki-link parser; `MAX_WIKILINKS=500` cap correct but anchor/alias edge cases untested | P1 |
| `src/ui/views/Database/engine/joinKey.ts` | 40 | A | No test; trivial but TZ semantics worth pinning | P3 |

---

## 3. Mandatory check results

### 3.1 ReDoS audit (RegExp from user input)

| Location | Line | Status | Action |
|---|---|---|---|
| `formulaEngine.ts::REGEX_MATCH` | 745 | **VULNERABLE** — `new RegExp(args[1])` no guard | wrap in `isUnsafePattern()` from `lib/helpers/regexSafety.ts` + try/catch |
| `formulaEngine.ts::REGEX_REPLACE` | 754 | **VULNERABLE** — same pattern | same |
| `views/Calendar/agenda/FilterRow.svelte` | 250 | **VULNERABLE** — `new RegExp(filterValue, 'i')` no guard, no try/catch | wrap + fallback to literal-contains |
| `lib/datasources/filterFunctions.ts` | (regex op) | **GUARDED** — uses `regexSafety.ts` already | OK |
| `formulaEngine.buildSafeClass` | 32-50 | allowlist-safe | OK |
| `conditionalFormat.ts::SAFE_COLOR` | 56 | static regex, allowlist-safe | OK |

### 3.2 JSON.parse audit

| Location | Status |
|---|---|
| `src/settings/settings.ts::migrateSettings` | **MIGRATION NO TRY/CATCH** — wrapped only at fp-ts loadData boundary; malformed shape past version-router will throw uncaught |
| `EditNote.svelte` L278 | guarded |
| `lib/stores/ui.ts` L39 | guarded |
| `DataFrameProvider.svelte` L51 | guarded |
| `Calendar/viewport/ViewportStateManager.ts` L374 | guarded |
| `CreateField.svelte` L67 | guarded |

### 3.3 Svelte reactive sync (`let x = prop` where `$: x = prop` needed)

| File | Line | Bug |
|---|---|---|
| `components/FieldControl/FieldControl.svelte` | 31 | `let cachedValue = isDate(value) ? value : null` → never updates on prop change. **D-grade**. |
| Other components investigated | — | Local-state pattern verified intentional |

### 3.4 Fire-and-forget Promises

| File | Lines | Risk |
|---|---|---|
| `main.ts` | 88, 173, 326, 329, 332 | `void this.activateView()` / `toggleVisualizerPane()` / `openRelationPicker()` — silent failure if workspace locked |
| `EditNote.svelte::performSave` | 127 | async never awaited at call-sites — race risk with modal close |
| `DatabaseViewCanvas.svelte` | 236, 400, 406 | mixed `void tick().then()` + `void async IIFE` + `Promise.all` without consistent error boundary |

### 3.5 Test coverage gaps

Engine files without tests (high risk):
- `relationResolver.ts`, `crossProjectResolver.ts`, `crossProjectRollup.ts`, `inverseIndex.ts`, `formulaParser.ts`, `subBasePartition.ts`, `cellEditor.ts` (note: `cellEditor` does have R2.6 tests in `__tests__/cellEditor.test.ts`), `joinKey.ts`, `formulaSerializer.ts`, `formulaMetadata.ts`, `accessibility.ts`, `dataframe.ts` core types.

---

## 4. Duplicating implementations (paired comparison)

### D1 — Dual filter engines

| Aspect | `lib/datasources/filterFunctions.ts` (project-level) | `Database/engine/transformExecutor.executeFilter` (pipeline) |
|---|---|---|
| Operator set | 30+ named operators incl. `is`, `is-not`, `contains`, `not-contains`, `is-empty`, range, `has-any-of`, `has-none-of` | Inline switch on a smaller set; no `has-any-of` |
| Array semantics | Schema-aware: any-match for affirmative, all-must-fail for negative (R2.1c fix) | Element-by-element only |
| Empty/null | `undefined + negative-op = true` (R2.1c) | Treats undefined as not-match (different result!) |
| Regex op | guarded via `regexSafety` | n/a |
| Test coverage | 6+ regression tests | 0 dedicated filter tests |

**Resolution**: Layer 1 ticket `REFACTOR-ENGINE-FILTER-UNIFY` — extract single `FilterIR` + one evaluator, both surfaces consume it.

### D2 — Triple aggregation kernels

| Kernel | File | sum | avg | min/max | median | count_unique |
|---|---|---|---|---|---|---|
| Cross-frame in-frame rollup | `Database/engine/rollup.ts::aggregate` | `sumNumbers(toNumbers())` | `sum/count` | `Math.min/max` | sort+midpoint | `Set(map(String)).size` |
| Footer aggregation | `Database/engine/aggregation.ts` | `extractNumbers().reduce` | `reduce/length` | `Math.min/max` | sort+midpoint | `Set().size` |
| Formula function | `formulaEngine.ts::SUM/AVG/...` | `args.map().reduce` | `SUM/COUNT` (functional) | inline | inline | not exposed |

**Resolution**: Layer 1 `REFACTOR-ENGINE-AGG-UNIFY` — `aggregation.ts` and `formulaEngine.ts` import `aggregate()` from `rollup.ts`. No semantic divergence allowed.

### D3 — Triple wiki-link parsers

| Parser | File | Pattern | Loop guard |
|---|---|---|---|
| Database | `Database/engine/relationResolver.ts` L14 | `/\[\[([^\]\|#]+)(?:#[^\]\|]*)?\|?[^\]]*\]\]/g` (anchors+aliases) | `MAX_WIKILINKS=500` |
| Inverse index | `lib/relations/inverseIndex.ts` | simpler pattern | none |
| Formula tokenizer | `lib/helpers/formulaParser.ts` | tokenizer (not regex) | n/a |

**Resolution**: Layer 1 ticket `REFACTOR-ENGINE-WIKILINK-UNIFY` — single `parseWikiLink(text): WikiLinkRef[]` in `lib/wikilinks/`, all 3 callers consume.

### D4 — Two formula editor surfaces

| Surface | File | Capabilities |
|---|---|---|
| Generic | `components/FormulaEditor/FormulaEditor.svelte` (R3.1 Stage 1+2) | textarea + validate slot |
| Database | `views/Database/widgets/FormulaBar.svelte` | autocomplete, signature popover, debug panel, inline preview |

**Resolution**: Layer 4 ticket `REFACTOR-FORMULA-MIGRATE-FB` — enrich FormulaEditor to swallow FormulaBar features, then migrate.

### D5 — Two color picker stacks

| Stack | File | Notes |
|---|---|---|
| Canonical | `components/ColorPicker/ColorPicker.svelte` (~900 LOC) | favorites, project palette, HSV math |
| Reinvented | `views/Calendar/components/DayPopup/RecordItem.svelte` | full HSV→Hex/Hex→HSV duplicate (~300 LOC) |

**Resolution**: Layer 5 `REFACTOR-UX-COLOR-CONSOLIDATE` — extract `lib/colors/` shared math, RecordItem consumes shared `<ColorPicker>`.

### D6 — Two settings/migration "DataFrame" definitions

| File | Status |
|---|---|
| `obsidian-projects-types/index.ts` (public package) | **frozen at v2.x**: missing `dateFormat`, `agenda`, `DataQueryResult.dataGeneration/hasSort/hasFilter/filterConditions`, `ProjectViewProps.saveViewFilter/getRecordColor/sortRecords/getRecord` |
| `src/customViewApi.ts` (internal) | full v3 surface |

**Resolution**: Layer 0 ticket `REFACTOR-API-SYNC` — sync types package to internal API; bump major if needed.

### D7 — Two command sync engines

| File | Status |
|---|---|
| `src/main.ts::ensureCommands` (lines 479-620) | LIVE — invoked on every settings change |
| `src/managers/CommandManager.ts` | DEAD CODE — never called |

**Resolution**: Layer 0 `REFACTOR-SHELL-COMMANDS` — move logic into CommandManager, delete dead duplicate from main.ts.

---

## 5. Architectural conflicts

| # | Conflict | Anchored modules | Severity |
|---|---|---|---|
| C1 | Dual filter engine | filterFunctions.ts vs transformExecutor.executeFilter | **HIGH** |
| C2 | Triple aggregation kernels | rollup.ts / aggregation.ts / formulaEngine.SUM | **HIGH** |
| C3 | Empty/null/undefined semantics drift | cellEditor.EMPTY_TEXT_RE / formulaEngine.EMPTY / aggregation.nonEmpty | MEDIUM |
| C4 | Cross-project relation index strategies | relationResolver.buildRecordIndex (Map) vs crossProjectResolver.getOrBuildIndex (WeakMap) | MEDIUM |
| C5 | Cross-sub-base relations missing | subBasePartition filters DataFrame, loses inverse-index context | MEDIUM (blocks Matryoshka model) |
| C6 | Scattered color allowlists | formulaEngine.STYLE_COLORS / conditionalFormat.SAFE_COLOR / buildSafeClass | LOW |
| C7 | Public API frozen at v2 | obsidian-projects-types/index.ts | MEDIUM |
| C8 | Command duplication (two sync engines) | main.ts::ensureCommands vs CommandManager | MEDIUM |
| C9 | FileSystemWatcher lifecycle leak | main.ts onload registers watcher, onunload doesn't dispose | LOW (Obsidian unloads anyway) |
| C10 | Naming drift "Database" vs "Dashboard" | DatabaseViewCanvas.svelte / databaseView.ts / VIEW_TYPE_DATABASE / i18n keys | naming (atomic ticket) |

---

## 6. F-grade rebuild candidates (Phase 3 input)

| File | Why F | Rebuild scope |
|---|---|---|
| `src/ui/views/Table/components/DataGrid/*` (15 files, ~2500 LOC) | column width persists in **px**; flex-not-grid layout; coupled to Database widget; visual bugs since v1 | **REFACTOR-VIEW-TABLE-REBUILD** — fork into `Database/widgets/DataTable/StrictGrid/` already partially done in Phase 3 (2026-04-23); finish + remove legacy |
| `src/ui/components/FieldControl/FieldControl.svelte` | reactive prop sync bug (D-grade); a11y outline; duplicated color picker | **REFACTOR-UI-FIELDCONTROL-REBUILD** |
| `src/ui/modals/components/EditNote.svelte` (~800 LOC) | fire-and-forget save; outline:none; hardcoded 2000px | **REFACTOR-UI-EDITNOTE-REBUILD** |
| `src/ui/views/Calendar/agenda/FilterRow.svelte` | **ReDoS L250**; outline:none | **REFACTOR-UI-FILTERROW-HARDEN** |
| `src/ui/views/Calendar/components/Calendar/*` (Day/EventBar/HeaderStrips/AllDayEventStrip/CurrentTimeLine) | **5× outline:none without :focus-visible** | **REFACTOR-A11Y-CALENDAR-SWEEP** |

---

## 7. Test coverage gaps (rolled-up)

Engine files without dedicated test:
1. `Database/engine/relationResolver.ts` (HIGH risk)
2. `Database/engine/accessibility.ts` (MEDIUM)
3. `Database/engine/joinKey.ts` (MEDIUM — TZ semantics)
4. `Database/engine/formulaSerializer.ts` (LOW)
5. `Database/engine/formulaMetadata.ts` (LOW)
6. `lib/engine/crossProjectResolver.ts` (HIGH)
7. `lib/engine/crossProjectRollup.ts` (HIGH)
8. `lib/relations/inverseIndex.ts` (HIGH)
9. `lib/helpers/formulaParser.ts` (HIGH — canonical parser)
10. `lib/database/subBasePartition.ts` (MEDIUM — sort merge logic)
11. `lib/dataframe/dataframe.ts` core types (MEDIUM)

Acceptance for Phase 3 tickets touching these files: must add `__tests__/<file>.test.ts` covering at least happy + 2 edge cases.

---

## 8. Ready for Phase 2

Inputs to ARCHITECTURE_V4.md:
- 7 dual/triple implementations (D1–D7) → must collapse in Unified DataEngine
- 5 F-grade rebuilds → defer until Layer 1 stable, then sequence
- 3 P0 vulnerabilities → must close BEFORE any user-ready audit (Layer 0 + 1)
- 488 files, ~88K LOC → realistic refactor budget anchor
- "Dashboard View" rename = atomic, Layer 0 ticket
