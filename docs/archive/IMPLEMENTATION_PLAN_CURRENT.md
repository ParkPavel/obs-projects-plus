# Implementation Plan — Database Engine v2 / Architectural Reset

> **Status:** active. Последнее обновление: 2026-04-30 (стратегический пересмотр).
> **Версия**: 3.4.X WIP. Публичный выпуск не планируется до M5 (Q4 2026).
> **Директивный источник**: LEAD PRODUCT ARCHITECT mandate (2026-04-22) + Engine v2 revision (2026-04-30).
> **Single source of truth** for execution. All other planning docs (ROADMAP, specs) are reference.
> **Связанный документ**: `docs/architecture-engine-v2.md` — детальная архитектурная спецификация.

---

## СТРАТЕГИЧЕСКОЕ УТОЧНЕНИЕ (2026-04-30)

При разработке Database View были выявлены критические архитектурные пробелы:

1. **Зависимость от Dataview переоценена в прошлых спецификациях.** Folder/Tag datasources уже не зависят от Dataview — они читают YAML frontmatter напрямую. Dataview нужен ТОЛЬКО как опциональный DataSource (dataview-kind проекты).

2. **Relations и Rollups — внутри одного проекта уже работают.** `engine/relationResolver.ts` + `engine/rollup.ts` реализованы и протестированы. Но они разрешают wiki-links только **внутри одного DataFrame**.

3. **Кросс-проектные Relations/Rollups отсутствуют.** Для Notion-подобных связей между базами (Счета ↔ Журнал транзакций) нужен `CrossProjectRelationResolver` и `CrossProjectRollupEngine`. Это **критический пробел**.

4. **FieldConfig не расширен.** `DataFieldType.Relation` и `DataFieldType.Rollup` объявлены, но в `FieldConfig` нет конфигурации для них.

5. **Custom Properties Viewer отсутствует.** Нужна замена нативного Obsidian Properties panel с поддержкой typed fields, Relations и Rollups.

6. **Formula Editor не унифицирован.** Нужен единый popup-редактор формул (из схемы 2026-04-30), встроенный во все контексты.

Все эти пробелы исправляются в рамках версий **3.4.X**.

---

## 1. Directive — six architectural pillars

Verbatim axioms. Non-negotiable.

1. **MATRYOSHKA PRINCIPLE.** No viewport media queries for layout. Only `@container` queries. Widgets adapt to their parent container.
2. **ZERO PIXELS POLICY.** Sizes in `rem` only. Borders strictly `1px`.
3. **DATA FLOW OVER FOLDERS.** Projects are **queries**. Records are filtered by tags/YAML fields within a root folder. Forbidden to shard data across physical subfolders (CRM/Finance/Fitness).
4. **INTERFACE RECLAMATION.** Every cog icon opens a modal with 100 % working controls (type, filters, sort, aggregation). User-editable, not hardcoded.
5. **COMPLEX DATA MODELING.** YAML nested arrays (`sets: [{reps, weight, ...}]`) expand into analytic rows via FLATTEN/UNNEST. Charts support **correlation flows** (cross-type X/Y join by key).
6. **FIX TO EVERY PIXEL.** Table uses strict CSS Grid; column width + order persist in view JSON. Formula bar has IntelliSense (function + field autocomplete) and an inline debug log on error — never silent empty cells.

---

## 2. Ground truth — honest verdict (Phase 0 discovery + 2026-04-30 update)

Verified 2026-04-22 by read-only audit + updated 2026-04-30 after Engine v2 strategic review.

| Pillar | Verdict | Critical evidence |
|---|---|---|
| 1. Data Flow over Folders | **FIXED** (Phase 1) | `writeDemoFiles(vault, demoFolder, …)` flat in root; segregation via `view.filter` on `type` frontmatter |
| 2. Interface Reclamation | **FIXED** (Phase 2a) | All 8 widget types route through `configPanelRegistry`; `view-port` has a working cog; `VerticalSwitcher` withdrawn (see §3.2) |
| 3. Table Strict Grid | FAIL | `GridColumnHeader` uses flex + `style:width={`${n}px`}`; no `grid-template-columns`; resize persists in **px**, not rem |
| 4. Formula IntelliSense | **FIXED** (Phase 4) | Signature popover, debug panel, string-literal-aware findEnclosingCall — delivered 2026-04-23 |
| 5. Nested arrays / correlation | **FIXED** (Phase 5+6) | JoinStep ✅, scatter rightDataSource ✅, correlation diagnostics ✅ — delivered 2026-04-23 |
| 6. Zero Pixels / Matryoshka | **FIXED** (Phase 6) | Zero `@media(max-width)` in Database/; Zero `Npx` (n≥2) in widgets/ — delivered 2026-04-23 |
| **NEW: 7. Cross-project Relations** | **FAIL** | `relationResolver.ts` resolves only within one DataFrame; `CrossProjectRelationResolver` absent |
| **NEW: 8. Cross-project Rollups** | **FAIL** | `rollup.ts` works within one DataFrame; `CrossProjectRollupEngine` absent |
| **NEW: 9. FieldConfig for Relation/Rollup** | **FAIL** | `DataFieldType.Relation/Rollup` declared, but `FieldConfig` has no `RelationFieldConfig`/`RollupFieldConfig` |
| **NEW: 10. Custom Properties Viewer** | **NOT STARTED** | Absent; Obsidian native panel shows only plain text |
| **NEW: 11. Formula Editor Popup** | **PARTIAL** | `FormulaBar.svelte` inline — needs unified popup (modal) for all contexts |

---

## 3. Target architecture

### 3.1 Data pipeline

```
Obsidian Vault + MetadataCache
        │ file events: create/delete/rename/changed
        ▼
ObsidianFileSystem + Watcher                       src/lib/filesystem/obsidian/
        │ getAllFiles / onChange
        ▼
DataSource (abstract)                              src/lib/datasources/index.ts
 ├── FolderDataSource          (recursive path)
 ├── TagDataSource             (#tag matching)
 └── DataviewDataSource        (api.query TABLE/LIST/TASK)
        │ queryAll() → DataFrame
        ▼
mergeDataFrames (union fields + dedup by id)       src/lib/datasources/mergeFrames.ts
        │
        ▼
view.filter + view.sort  (project-level predicates)
        │
        ▼
enrichWithBacklinks                                 engine/relationResolver.ts
        │
        ▼
executeTransform(pipeline)                          engine/transformExecutor.ts
 steps: unnest | unpivot | compute | filter
      | group-by | aggregate | pivot | [JOIN TODO]
        │
        ▼
Widget render (8 types)                             widgets/*
```

### 3.2 Field presets (target)

**Scope correction (2026-04-23).** An earlier draft described "Verticals as first-class" where a preset bundled `{filter, widgets, pipeline}`. Product Architect rejected this scope: filter belongs to the view-level (`view.filter`) and widgets belong to the view's `DatabaseViewConfig.widgets`. A preset, by design, is **only a field/column layout snapshot** inside a single Database view — nothing more.

Target model (reserved for Phase 2b):

```ts
// DatabaseViewConfig (additive)
readonly fieldPresets?: FieldPreset[];   // user-saved column layouts
readonly activeFieldPresetId?: string;

interface FieldPreset {
  id: string;                            // user-generated uuid
  label: string;
  /** Snapshot of DataTableConfig column layout. No filter. No widgets. */
  fieldConfig: DataTableFieldConfig;
  orderFields?: string[];
  /** Optional: saved sort / freeze / group — still field-scoped. */
  sortCriteria?: DataTableSortCriteria[];
  freezeUpTo?: string;
  groupBy?: GroupConfig;
}
```

Selecting a preset mutates only `config.table` (fieldConfig/orderFields/sort/freeze/groupBy) and `activeFieldPresetId`. It does **not** touch `view.filter` or `config.widgets`. Industry-level segregation (Fitness / Finance / CRM) stays as parallel Database views with view-level filters — that is the canonical pattern.

### 3.3 Obsidian API dependency registry

Single integration surface = `ObsidianFileSystem` + `ObsidianFileSystemWatcher`.

| Obsidian API | Usage |
|---|---|
| `Vault.create` | Demo/user row creation |
| `Vault.read` / `cachedRead` | Markdown read |
| `Vault.process(file, mutator)` | Atomic full-file rewrite |
| `Vault.getAbstractFileByPath` | Path → TFile |
| `Vault.getMarkdownFiles` | Full scan for FolderDS |
| `Vault.on("create"/"delete"/"rename")` | Data invalidation |
| `MetadataCache.getFileCache` | Tag parsing |
| `MetadataCache.on("changed")` | Frontmatter mutations |
| `MetadataCache.getFirstLinkpathDest` | Wiki-link resolve |
| `FileManager.trashFile` | Delete to system trash |
| `Workspace.on("file-menu")` | Context menu integration |
| `normalizePath`, `stringifyYaml` | obsidian utils |

**Gaps to close (tracked in phases below):**
- `FileManager.processFrontMatter` — not used; inline DataTable edits risk concurrent-write data loss → **Phase 3** adoption.
- Subscription to Dataview-specific events (`metadataCache.on("resolved")`) — absent → **Phase 5** add for correlation invalidation.
- `Platform.isMobile` feature-gate — absent; currently relies on CSS `(pointer: coarse)` and store `$isMobile`.

### 3.4 Dataview dependency

Single entry: `src/lib/datasources/dataview/datasource.ts`. Uses `DataviewApi.query(source, originFile?, options)`. Parses `TableResult | ListResult | TaskResult`. Read-only (`readonly(): true`). Graceful degradation via `UnsupportedCapability` error.

---

## 4. Critical architectural findings

Numbered for phase traceability.

**F1 — WITHDRAWN (2026-04-23).** Earlier iteration proposed a `VerticalSwitcher` that atomically applied `{filter, widgets, activeId}`. Scope rejected by Product Architect: filter is a view-level concern, widgets are a view-level concern, and a "preset" within a Database view must mean **field/column layout only**. No semantic-incompleteness bug exists because the switcher itself is withdrawn. Industry segregation returns to parallel views with view-level filters (see §3.2). See Phase 2b.

**F2 — WITHDRAWN (2026-04-23).** Hardcoded `getVerticalTemplates()` remains as an informational flag in `WIDGET_TEMPLATES`, but no runtime code reads it. Per §3.2, "verticals" are not a first-class object — they are three demo views that happen to share a template naming convention.

**F3 — WITHDRAWN (2026-04-23).** Demo correctly creates **3 parallel Database views** (`🏋️ Фитнес`, `💰 Финансы`, `👥 CRM`) each with a view-level `type` filter. This is the canonical pattern, not a compensation for a non-existent bug.

**F4 — DataTable layered on legacy Table/DataGrid. FIXED 2026-04-23.**
`DataTableWidget.svelte` imports `DataGrid.svelte` from legacy `src/ui/views/Table/components/DataGrid/`. Resolved: fork into `widgets/DataTable/StrictGrid/` + rem widths persistence (Phase 3).

**F5 — Engine leaks pixel units. ACCEPTED (kept as boundary).**
`chartDataPipeline.ts` `chartHeightPx` returns numeric px. Решение Phase 6: оставлен как есть — это boundary к chart-библиотеке, ожидающей numeric px; переименование сломало бы 7 chart-renderer компонентов без user-visible value (YAGNI).

**F6 — Inline row edits bypass `processFrontMatter`. FIXED 2026-04-23.**
`handleRowEdit` мигрирован на `fileManager.processFrontMatter` с fallback на legacy path (Phase 3).

**F7 — WidgetHost monolith (~730 LOC).**
Six `init*Config` + six `{#if showConfig && widget.type === "X"}` branches. Extract `configPanelRegistry.ts`. P2 (Phase 2a enabler). **FIXED** 2026-04-22.

**F8 — CrossProjectRelationResolver absent (2026-04-30). CRITICAL.**
`engine/relationResolver.ts` умеет разрешать wiki-links только внутри одного DataFrame. Для реализации Notion-подобных связей между двумя базами (Base 1: Счета, Base 2: Журнал транзакций) необходим `CrossProjectRelationResolver`. Без него поле `Счет: "[[Счет 1]]"` в журнале не разрешается в запись базы счетов. Блокирует M0. → **Phase M0**.

**F9 — CrossProjectRollupEngine absent (2026-04-30). CRITICAL.**
`engine/rollup.ts` вычисляет rollups только внутри одного DataFrame. Поле `Текущий баланс` в Base 1 (счета) как SUM из связанных транзакций Base 2 невозможно без `CrossProjectRollupEngine`. Зависит от F8. → **Phase M0**.

**F10 — FieldConfig не расширен для Relation/Rollup (2026-04-30). HIGH.**
`DataFieldType.Relation = "relation"` и `DataFieldType.Rollup = "rollup"` объявлены в `dataframe.ts`, но тип `FieldConfig` в `src/settings/base/settings.ts` определён как `StringFieldConfig & DateFieldConfig` — нет `RelationFieldConfig { targetProjectId }` и `RollupFieldConfig { relationField, targetField, function }`. Без расширения нельзя настроить relation/rollup поля через settings. → **Phase M0**.

**F11 — Custom Properties Viewer отсутствует (2026-04-30). HIGH.**
Обсидиан показывает YAML properties как plain-text list. Для типизированного редактирования полей (с Relation dropdown, Rollup computed display, Formula editor) нужен собственный PropertiesPanel leaf. → **Phase M2**.

**F12 — Formula Editor не унифицирован (2026-04-30). MEDIUM.**
`FormulaBar.svelte` встроен только в `DatabaseViewCanvas`. Для использования в `PropertiesPanel`, computed columns, StatsCard formula нужен единый `FormulaEditorModal` popup. Схема (PDF 2026-04-30) специфицирует UI. → **Phase M3**.

---

## 5. Execution waves

**Обновлено 2026-04-30**: Phases 1-6 выполнены, Phase 7 отменена. Добавлены новые Engine v2 фазы M0-M5 как приоритет.

**Версионная политика (важно)**: M0-M4 — внутренние выпуски в рамках 3.4.X WIP (НЕ публикуются). M5 — первый публичный релиз с Database, версия повышается до 3.5.0+ ТОЛЬКО на финальном release-cut по явному решению пользователя.

| Phase | Title | Size | Risk | Blocks | Status |
|---|---|---|---|---|---|
| 1 | Data Flow over Folders | — | — | — | ✅ done 2026-04-22 |
| 2a | ViewPort cog + config paritet + `configPanelRegistry` extraction | S | LOW | enables 2b | ✅ done 2026-04-22 |
| 2b | Field presets (column layout snapshots, view-scoped) | M | LOW | — | ✅ done 2026-04-23 |
| 3 | Table Strict Grid + rem widths + DataGrid fork + `processFrontMatter` | L | HIGH | closes F4, F6 | ✅ done 2026-04-23 |
| 4 | Formula IntelliSense polish: signature popover, inline debug panel | M | MEDIUM | — | ✅ done 2026-04-23 |
| 5 | Correlation Flows: `join` pipeline step + scatter rightDataSource + event invalidation | L | MEDIUM | — | ✅ done 2026-04-23 |
| 6 | Zero Pixels sweep: `@media(max-width)` → `@container`; `Npx` → rem | M | MEDIUM | — | ✅ done 2026-04-23 |
| 7 | Release wrap (CANCELLED — плагин ещё не готов к публичному выпуску) | S | LOW | — | ⛔ cancelled per user directive |
| **M0** | **Engine v2: CrossProjectRelations + Rollups + FieldConfig extension** | **L** | **HIGH** | blocks M1, M2 | **🔜 NEXT** |
| M1 | Field Types UI: Relation/Rollup config in DataTable | M | MEDIUM | depends on M0 | planned |
| M3 | Formula Editor Popup (unified modal) | M | MEDIUM | parallel to M0/M1 | planned |
| M2 | Custom Properties Viewer (PropertiesPanel leaf, uses M3 for FormulaField) | L | MEDIUM | depends on M0 + M3 | planned |
| M4 | Pipeline Completion + Stability | M | MEDIUM | — | planned |
| M5 | Stabilization + Release Readiness (public v3.5.0+) | L | LOW | — | planned |

### 5.1 Phase 2a — ViewPort cog + paritet (S)

**Goal.** Every widget has a cog → modal. Extract registry.

**Files.**
- new: `src/ui/views/Database/widgets/configPanelRegistry.ts` — `Record<WidgetType, { panel, initDefaults, seedFromFields }>`
- new: `src/ui/views/Database/widgets/ViewPort/ViewPortConfig.svelte` — `viewId`, `viewLabel`, `headerVisible`
- edit: `src/ui/views/Database/widgets/WidgetHost.svelte` — replace 6-way switch with registry lookup; include `view-port`
- edit (optional paritet): `Stats/StatsConfig.svelte`, `Checklist/ChecklistConfig.svelte`, `FilterTabs/FilterTabsConfig.svelte`, `Comparison/ComparisonConfig.svelte` — add local filter-row and aggregation selectors where missing.

**Acceptance.**
- `ViewPort` widget renders cog; click opens config.
- `WidgetHost.svelte` LOC drops by ≥15 % (registry extraction).
- Existing e2e tests `databaseView.e2e.test.ts` pass; new unit test `configPanelRegistry.test.ts` covers lookup for all 8 types.

### 5.2 Phase 2b — Field presets (M)

**Goal.** Let users save and recall column layouts inside one Database view. A preset captures only field-scope state: visibility, order, width, pin, sort criteria, freeze, group-by. It does **not** carry filter or widgets. Filter stays on `view.filter`; widgets stay on `config.widgets`.

**Files.**
- edit: `src/ui/views/Database/types.ts` — add optional `fieldPresets?: FieldPreset[]` and `activeFieldPresetId?: string` on `DatabaseViewConfig`; add `FieldPreset` interface.
- new: `src/ui/views/Database/widgets/DataTable/FieldPresetMenu.svelte` — dropdown in the DataTable header: list, apply, save-current, rename, delete. No modal; fits into existing right-click column ergonomics.
- edit: `src/ui/views/Database/widgets/DataTable/DataTableWidget.svelte` — mount the menu next to the Σ aggregation glyph; on apply, merge preset into `config.table` (fieldConfig / orderFields / sortCriteria / freezeUpTo / groupBy).
- edit: `src/ui/views/Database/migration.ts` — no migration needed (additive, optional field). Add version guard so older installs remain readable.
- edit: i18n `en/ru/uk/zh-CN.json` — 4–6 keys for menu labels.
- new: `src/ui/views/Database/__tests__/fieldPreset.test.ts` — asserts apply mutates only fieldConfig/order/sort/freeze/groupBy; asserts filter and widgets untouched.

**Non-goals.**
- No multi-view preset sharing.
- No preset export / import.
- No icon / color customisation.
- No atomic filter or widget change on apply.

**Acceptance.**
- User can save current column layout as a named preset.
- Applying a preset restores the saved layout; `view.filter` and `config.widgets` unchanged (verified by unit test).
- svelte-check 0/0; jest all green; build PASS.

### 5.3 Phase 3 — Table Strict Grid (L)

**Goal.** Close F4 + F6. True CSS Grid layout, rem widths, resize persists in rem, `processFrontMatter` for safe inline edits.

**Files.**
- new fork: `src/ui/views/Database/widgets/DataTable/StrictGrid/` — copy of `Table/components/DataGrid/` with:
  - container uses `display: grid; grid-template-columns: minmax(...rem, 1fr) …`
  - `Resizer.svelte` converts `pointerup` px → rem (`px / parseFloat(getComputedStyle(document.documentElement).fontSize)`)
  - cell components lose per-cell `style:width`
- edit: `src/ui/views/Database/widgets/DataTable/DataTableWidget.svelte` — import from new StrictGrid; replace `handleRowEdit` to use `app.fileManager.processFrontMatter(file, fm => fm[field] = value)`
- edit: `src/ui/views/Database/types.ts` — `DataTableFieldConfig.width` deprecated → add `widthRem?: number`
- edit: `src/settings/migration.ts` — px → rem conversion when legacy `width` present
- new: `StrictGrid.test.ts` — resize pointerdown/move/up test; rem persistence test
- new: `DataTableProcessFrontMatter.test.ts` — inline edit goes through mocked `processFrontMatter`

**Acceptance.**
- Column widths survive reload in rem.
- Concurrent user editing in Obsidian's editor does not lose row edits (manual QA + mocked test).
- Legacy `src/ui/views/Table/` untouched (zero regression surface for any code that still imports it).
- svelte-check 0/0; build PASS.

### 5.4 Phase 4 — Formula IntelliSense polish (M)

**Goal.** Signature + doc popover; inline debug panel on error; full kbd nav verification.

**Files.**
- new: `src/ui/views/Database/engine/formulaMetadata.ts` — `Record<FunctionName, { args: ArgSpec[], returnType, doc, category }>` for all 100+ funcs
- edit: `src/ui/views/Database/engine/formulaEngine.ts` — export `getFormulaMetadata(name)`
- edit: `src/ui/views/Database/widgets/FormulaBar.svelte` — suggestion items become objects; right-side panel renders signature; use `evaluateFormulaWithError` for rich errors
- new: `FormulaDebugPanel.svelte` — accordion, Esc to dismiss, copyable message + cursor position

**Acceptance.**
- Typing `SUM(` shows signature `SUM(values: number[]) → number` below autocomplete.
- Invalid formula opens debug panel with parseable message; cursor position highlighted.
- Kbd nav: ArrowUp/Down through suggestions, Enter accepts, Tab auto-closes parens. Verified in `FormulaBar.kbd.test.ts`.

### 5.5 Phase 5 — Correlation Flows (L)

**Goal.** Cross-type scatter: [Bench weight] vs [Calories] joined by date.

**Files.**
- edit: `src/ui/views/Database/engine/transformTypes.ts` — add `JoinStep { type: "join", rightSource: DataSource, on: { leftKey, rightKey }, how: "inner" | "left", aggregation?: ColumnAggregation }`
- edit: `src/ui/views/Database/engine/transformExecutor.ts` — implement `executeJoin(df, step)` using `mergeFrames` semantics for schema, hash-join on key
- new: `joinStep.test.ts` — inner/left/aggregation cases
- edit: `src/ui/views/Database/widgets/Chart/ChartConfig.svelte` — add `rightDataSource` picker + key fields when chartType = scatter
- edit: `src/ui/views/Database/engine/chartDataPipeline.ts` — `computeScatterData` accepts `rightFrame?: DataFrame`; preloaded async
- edit: `src/ui/views/Database/DatabaseViewCanvas.svelte` — preload additional data sources when any widget has a `join` step or scatter `rightDataSource`
- edit: `src/lib/filesystem/obsidian/filesystem.ts` — subscribe to `metadataCache.on("resolved")` to invalidate correlation cache for Dataview-sourced right frames
- edit: `src/ui/views/Database/widgets/PipelineEditor.svelte` — UI for JoinStep

**Acceptance.**
- User can configure scatter chart with X from workouts (weight) and Y from nutrition (calories) joined on date; both sources live in the same vault.
- Pipeline editor shows JoinStep with right-source picker.
- Integration test covers the full scatter join flow.

### 5.6 Phase 6 — Zero Pixels / Matryoshka (M)

**Goal.** Eliminate `@media(max-width|max-height|orientation)` where component lives inside a `@container` context; convert `Npx` (n≥2) to rem; preserve `1px` hairlines and `@media (pointer: coarse)` as allowed exceptions.

**Files (top offenders).**
- PipelineEditor.svelte (~35 px)
- FormulaVisualEditor.svelte (~20 px)
- FormulaBar.svelte (~14 px)
- WidgetHost.svelte (~8 px)
- Calendar/AgendaSidebar, Calendar/DayPopup (extensive `@media` — cross-cutting; convert only those whose mount point is inside `@container`)
- ErrorBoundary.svelte (`max-width: 400px; min-height: 120px;`)
- AccordionItem.svelte
- chartDataPipeline.ts (`chartHeightPx` → `chartHeightRem`)

**Acceptance.**
- `grep -E "@media \\(max-(width|height)|orientation" src/ui/views/Database/` returns 0 matches.
- `grep -E "\\b([2-9]|[1-9][0-9]+)px\\b" src/ui/views/Database/widgets/` returns 0 matches (except in SVG `stroke-width` where semantically px).
- Visual QA via Obsidian zoom 75 %/100 %/150 % — no layout breakage.

### 5.7 Phase 7 — Release wrap v3.5.0 (⛔ CANCELLED 2026-04-23)

**Status**: cancelled per user directive — плагин не готов к публичному выпуску. Все артефакты Phase 7 (releases/v3.5.0/ snapshot, version bump, CHANGELOG section) откачены 2026-04-23. Работа продолжается в рамках 3.4.X WIP. Публичный релиз перенесён в M5 (см. таблицу waves).

---

## 6. Risk register

| # | Risk | Phase | Sev | Mitigation |
|---|---|---|---|---|
| 1 | DataGrid changes regress legacy TableView | 3 | P1 | Fork `StrictGrid/`; never edit legacy |
| 2 | Obsidian zoom breaks rem column min-widths | 3 | P1 | Clamp via `minmax(var(--col-min), ...)`; integration test at 75/100/150 % |
| 3 | JOIN without async preload freezes UI | 5 | P1 | Preload in DatabaseViewCanvas; extend `transformCache` key with right-frame version |
| 4 | VerticalPreset migration breaks existing demo | 2b | — | **WITHDRAWN** — preset is now field-scoped; no runtime schema change |
| 5 | `processFrontMatter` misuse on non-TFile nodes | 3 | P2 | Type-guard + unit tests |
| 6 | FormulaBar metadata-registry drift vs evaluator | 4 | P2 | `formulaMetadata.test.ts` asserts every `EXTENDED_FUNCTIONS` key has metadata |
| 7 | `@container` requires container context at mount | 6 | P2 | Audit every component move; document in CODE_STANDARDS |
| 8 | JSON backward-compat on `width` → `widthRem` | 3 | P2 | Versioned migration; keep legacy read one release |
| 9 | `configPanelRegistry` type-map vs literal switch | 2a | P3 | Exhaustiveness check via `satisfies Record<WidgetType, …>` |
| 10 | Px → rem visual drift in box-shadows | 6 | P3 | Keep decorative `2px` focus-rings as allowed exception; document |

---

## 7. Verification gates (every phase must pass)

1. `npm run svelte-check` → 0 errors, 0 warnings
2. `npx jest --no-coverage` → all suites pass (baseline 54/923)
3. `npm run build` → production bundle success
4. Visual smoke in target vault (manual unless automated)
5. `context_state.md` updated with phase summary
6. `memories/session/handoff.md` updated with next-phase pointer

**Do not merge to main or push without explicit user approval.** Director-mode safety rule.

---

## 8. Non-goals (YAGNI boundary)

The following are **out of scope** for this reset:
- Calendar / Board / Gallery view refactors (unless Phase 6 sweep touches their CSS).
- New chart types beyond scatter correlation.
- Dataview LIST/TASK new capabilities beyond what `datasource.ts` already parses.
- Formula function additions (registry already has 100+).
- Mobile-specific UX beyond Matryoshka adaptivity.
- Remote sync / cloud features.
- Changing `DataSource` abstraction shape or adding a 4th kind.

---

## 9. Navigation

- Documentation index: [docs/DOCS_INDEX.md](DOCS_INDEX.md)
- Doc lifecycle rules: [docs/DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md)
- Reference architecture: [docs/architecture-database-view.md](architecture-database-view.md)
- Calendar milestones: [docs/ROADMAP_DATABASE_2026.md](ROADMAP_DATABASE_2026.md)
- Internal continuity: `.ai_internal/context_state.md`
- Session handoff: `memories/session/handoff.md`

---

## 10. Immediate next step

**Phases 1-6 done** (2026-04-22/23). **Phase 7 cancelled** per user directive — плагин не готов к публичному выпуску.

**СЛЕДУЮЩИЙ ШАГ (2026-04-30)**: Phase **M0** — Engine v2 Foundation:
1. Расширить `FieldConfig` в `src/settings/base/settings.ts` (additive — `RelationFieldConfig` | `RollupFieldConfig`)
2. Создать `src/lib/engine/crossProjectResolver.ts`
3. Создать `src/lib/engine/crossProjectRollup.ts`
4. Расширить `FrontMatterDataSource` для enrich с virtual derived fields

Верификационные gate: svelte-check 0/0, jest all green, build PASS.

**Детальная спецификация**: `docs/architecture-engine-v2.md`

---

## Appendix: Phase M0 — Engine v2 Foundation (детально)

**Goal**: Реализовать кросс-проектные Relations и Rollups. Закрыть F8, F9, F10.

### Шаг M0.1 — Расширить FieldConfig

```typescript
// src/settings/base/settings.ts — additive changes

export type RelationFieldConfig = {
  readonly type: "relation";
  /** ID проекта, на записи которого ссылается это поле */
  readonly targetProjectId: string;
  /** Поле в целевом проекте для отображения записей */
  readonly displayField?: string;
};

export type RollupFieldConfig = {
  readonly type: "rollup";
  /** Поле в ТЕКУЩЕМ датафрейме, содержащее wiki-links */
  readonly relationField: string;
  /** ID проекта, откуда берутся связанные записи (для backlinks: тот же) */
  readonly targetProjectId?: string;
  /** Поле в целевом датафрейме для аггрегации */
  readonly targetField: string;
  /** Функция аггрегации */
  readonly function: RollupFunction;
  readonly separator?: string;
};

// Расширить FieldConfig (без breaking change):
export type FieldConfig = StringFieldConfig & DateFieldConfig & {
  readonly relation?: RelationFieldConfig;
  readonly rollup?: RollupFieldConfig;
};
```

### Шаг M0.2 — CrossProjectRelationResolver

**Файл**: `src/lib/engine/crossProjectResolver.ts` (NEW)

```typescript
/**
 * Resolve wiki-links in a record's field to records from an EXTERNAL DataFrame.
 * Uses externalFrameResolver to load the target project's DataFrame.
 */
export function resolveCrossProjectRelations(
  record: DataRecord,
  fieldName: string,
  externalFrame: DataFrame
): DataRecord[] {
  const index = buildRecordIndex(externalFrame);
  return getRelationTargetsWithIndex(record, fieldName, index);
}

/**
 * Enrich all records in sourceFrame with resolved relation targets.
 * Returns virtual field `${fieldName}__resolved` as array of target IDs.
 */
export function enrichFrameWithRelations(
  sourceFrame: DataFrame,
  fieldName: string,
  externalFrame: DataFrame,
  config: RelationFieldConfig
): DataFrame;
```

### Шаг M0.3 — CrossProjectRollupEngine

**Файл**: `src/lib/engine/crossProjectRollup.ts` (NEW)

```typescript
/**
 * Compute rollup for a single record using EXTERNAL frame as target.
 */
export function computeCrossProjectRollup(
  record: DataRecord,
  config: RollupFieldConfig,
  externalFrame: DataFrame
): RollupResult;

/**
 * Compute rollups for all records in sourceFrame.
 * Builds external frame index once.
 */
export function computeCrossProjectRollupColumn(
  sourceFrame: DataFrame,
  config: RollupFieldConfig,
  externalFrame: DataFrame
): Map<string, RollupResult>;
```

### Тесты (обязательные)

- `crossProjectResolver.test.ts`: record с `Счет: "[[Счет 1]]"` → resolved record из Base 1
- `crossProjectRollup.test.ts`: record в Base 1 получает SUM(amount) из 3 связанных транзакций Base 2
- Edge cases: broken link (unresolved → []), empty frame, aggregation на пустом наборе

### Acceptance

- `tsc --noEmit --skipLibCheck` → 0 errors
- `npx jest --no-coverage` → все suite GREEN (baseline +2 суит, +15+ тестов)
- `npm run build` → PASS
- Демо-тест: 2 проекта в demo vault, связанные через relation + rollup, отображают корректные данные в DataTable
