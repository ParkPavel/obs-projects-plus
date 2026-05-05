# Master Map — obs-projects-plus

> **Status**: AUTHORITATIVE navigation document.
> **Created**: 2026-05-02 (Refactoring Session v4.0 / Phase 0 — Documentation Archaeology).
> **Updated by**: every refactoring ticket.
> **Reality anchor**: `manifest.json` version `3.4.2`, **488 source files** (292 TS + 196 Svelte), **~87 800 LOC**, Jest baseline `80 suites / 1176 tests PASS`.

---

## 1. Code-space map (top-level src/ modules → purpose → status → key consumers)

| Path | Layer | Purpose | Status | Consumed by |
|---|---|---|---|---|
| `src/main.ts` | shell | Plugin entry, command registration, lifecycle | active | Obsidian |
| `src/view.ts` | shell | `ItemView` host (mounts `App.svelte`) | active | `main.ts` |
| `src/customViewApi.ts` | shell | External-plugin Custom View bridge | active | external plugins |
| `src/events.ts` | shell | Internal event constants | active | `main.ts`, `App.svelte` |
| `src/managers/CommandManager.ts` | shell | Project-scoped command registration (canonical) | active (REFACTOR-008) | `main.ts` (facade) |
| `src/lib/dataframe/` | engine | Canonical record shape (`DataFrame`, `DataRecord`, `DataFieldType`) | active (A) | engine + UI everywhere |
| `src/lib/datasources/` | engine | Folder / Tag / Dataview / Frontmatter datasource implementations | active (A) | `dataApi.ts`, `viewApi.ts` |
| `src/lib/datasources/helpers.ts` | engine | `parseRecords` + `detectCellType` (Stage A field-type plumbing) | active (B) | datasources |
| `src/lib/datasources/mergeFrames.ts` | engine | Multi-source DataFrame union | active (B) | datasources |
| `src/lib/metadata/` | engine | YAML encode/decode | active (A) | datasources |
| `src/lib/filesystem/` | engine | `IFileSystem` abstraction + Obsidian impl | active (A) | dataApi, datasources |
| `src/lib/dataApi.ts` | engine | CRUD on records (uses `processFrontMatter`) | active (B) | UI |
| `src/lib/viewApi.ts` | engine | View-side helpers (resolveExternalFrame DI) | active (B — fire-and-forget audit) | `App.svelte`, `View.svelte` |
| `src/lib/externalFrameResolver.ts` | engine | Cross-project DataFrame loader (cached, vault-event invalidated) | active (B) | `App.svelte` |
| `src/lib/helpers/formulaParser.ts` | engine | 102-function formula parser/evaluator (canonical) | active (A) | engine v1 |
| `src/lib/formula/index.ts` | engine | Re-export barrel for unified formula entry | active (A) | new code only |
| `src/lib/helpers/dateFormulaParser.ts` | engine | Agenda date DSL (separate engine — out of unified scope) | active (B) | Agenda 2.0 |
| `src/lib/helpers/regexSafety.ts` | engine | ReDoS-safe regex factory | active (A) | filters/search |
| `src/lib/helpers/sanitizeHtml.ts` | engine | HTML sanitizer | active (A) | UI render |
| `src/lib/engine/crossProjectResolver.ts` | engine | Wiki-link resolver across projects (Stage A delivered) | active (B) | `View.svelte` |
| `src/lib/engine/crossProjectRollup.ts` | engine | Cross-project rollup aggregation | active (B) | `View.svelte` |
| `src/lib/relations/inverseIndex.ts` + `inverseIndexStore.ts` | engine | Vault-wide inverse-relation index (live, debounced) | active (A) | Visualizer |
| `src/lib/engine/contracts.ts` | engine | **NEW (REFACTOR-005)** — Canonical type contracts for the unified DataEngine: `FilterIR`, `RollupIR`, `FormulaIR`, `TransformStep`, `DataEngineRequest/Result`, `AggregateFn`. Types-only, no runtime. | active (A) | Layer 1+ tickets |
| `src/lib/relations/contracts.ts` | engine | **NEW (REFACTOR-006)** — `RelationRef`, `RelationIndex` interfaces (types-only). | active (A) | REFACTOR-204 |
| `src/lib/frontmatter/contracts.ts` | engine | **NEW (REFACTOR-006)** — `FrontmatterReader`, `FrontmatterWriter`, `WriteOpts` interfaces (types-only). | active (A) | REFACTOR-202..203 |
| `src/lib/colors/contracts.ts` | engine | **NEW (REFACTOR-006)** — `ColorToken`, `ColorPalette`, `PaletteStore` interfaces (types-only). | active (A) | REFACTOR-401 |
| `src/lib/database/subBase.ts` | engine | Sub-base type model (R2.3) | active (A) | DataTableWidget |
| `src/lib/database/subBasePartition.ts` | engine | Pure sub-base filter/sort partitioner | active (A) | DataTableWidget |
| `src/lib/database/rollupMode.ts` | engine | Notion-style rollup taxonomy (18 modes) | active (A) | DataTableWidget menu |
| `src/lib/database/cellEditor.ts` + `cellEditorWriter.ts` | engine | Inline cell parse + processFrontMatter writer | active (A) | Visualizer + GridCells (R2.1c) |
| `src/lib/visualizer/overlay.ts` + writer | engine | Per-note property overlay (`pp_overlay`) | active (A) | Visualizer |
| `src/lib/visualizer/relations.ts` + writer | engine | Manual relation editor model | active (A) | Visualizer |
| `src/lib/visualizer/colors.ts` | engine | Color value detection / luminance | active (A) | Visualizer |
| `src/lib/visualizer/propertyTypes.ts` + writer | engine | Per-note type override (`pp_types`) | active (A) | Visualizer |
| `src/lib/contextMenu.ts` | engine | Portal-anchored Obsidian Menu wrapper | active (A) | UI surfaces |
| `src/lib/stores/commandBus.ts` | engine | Cross-component command broker (writable) | active (A) | UI surfaces |
| `src/lib/stores/settings.ts` | engine | Settings store (writable, persistent) | active (B) | everything |
| `src/lib/stores/i18n.ts` + `translations/{en,ru,uk,zh-CN}.json` | engine | i18next stores (929 keys, full parity) | active (A) | UI |
| `src/lib/duplicate/` | engine | Duplicate detection | active (B) | UI modals |
| `src/lib/templates/` | engine | Note template renderer | active (B) | UI modals |
| `src/lib/tokens/` | engine | Design tokens (rem only) | active (B) | UI |
| `src/settings/base/settings.ts` | settings | Active schema (`FieldConfig`, `ProjectDefinition`) — single source of truth | active (B) | engine + UI |
| `src/settings/{v1,v2,v3}/` | settings | Versioned migration steps | active (B) | boot |
| `src/ui/app/App.svelte` | ui | Root mount, routing, plugin context | active (B) | `view.ts` |
| `src/ui/app/View.svelte` | ui | Per-view shell (filter/sort/enrich pipeline) | active (B) | `App.svelte` |
| `src/ui/app/useView.ts` | ui | View-mount hook for Svelte / external plugins | active (B) | `View.svelte` |
| `src/ui/components/` | ui | Cross-view reusable components (Navigation, color picker, palette, settings menu) | active (C — color components scattered) | views |
| `src/ui/components/FormulaEditor/FormulaEditor.svelte` | ui | New surface-agnostic formula textarea (R3.1 Stage 1+2 partial) | active (B — incomplete migration) | Visualizer modal pilot |
| `src/ui/modals/` | ui | Modal dialogs | active (B) | UI |
| `src/ui/views/Table/` | ui | **Legacy Table view** (visual bugs since v1) | **F — full rebuild required** | demo / legacy projects |
| `src/ui/views/Table/components/DataGrid/` | ui | Legacy DataGrid (shared with Database via re-import) | **D — coupled, fragile** | Table + Database |
| `src/ui/views/Board/` | ui | Kanban board (DnD via svelte-dnd-action) | active (B) | Board view |
| `src/ui/views/Calendar/` + `agenda/` + `dnd/` | ui | Calendar + Agenda 2.0 + drag manager | active (B — date precision audit) | Calendar view |
| `src/ui/views/Gallery/` | ui | Card gallery view | active (B) | Gallery view |
| `src/ui/views/Dashboard/DashboardCanvas.svelte` | ui | Dashboard canvas (renamed from `DatabaseViewCanvas` in v4.0 / REFACTOR-004) | active (B) | view registry |
| `src/ui/views/Dashboard/dashboardView.ts` | ui | View registration; exports `VIEW_TYPE_DASHBOARD` (canonical) and `VIEW_TYPE_DATABASE` (deprecated alias) | active (B) | `view.ts` |
| `src/ui/views/Dashboard/engine/` | engine | In-frame engine (formula/rollup/relations/transformPipeline) | active (B — duplicate of unified scope) | widgets |
| `src/ui/views/Dashboard/widgets/DataTable/DataTableWidget.svelte` | ui | Primary widget (subBases + rollup mode + presets) | active (B) | canvas |
| `src/ui/views/Dashboard/widgets/DataTable/SubBaseTabs.svelte` | ui | Sub-base tab strip (R2.2) | active (A) | DataTableWidget |
| `src/ui/views/Dashboard/widgets/Chart/` | ui | 7 chart types + `ChartConfig.svelte` | active (B) | canvas |
| `src/ui/views/Dashboard/widgets/Stats/` | ui | KPI cards | active (B) | canvas |
| `src/ui/views/Dashboard/widgets/Comparison/` | ui | Two-series compare | active (B) | canvas |
| `src/ui/views/Dashboard/widgets/Checklist/` | ui | Boolean rollup widget | active (B) | canvas |
| `src/ui/views/Dashboard/widgets/FilterTabs/` | ui | Tab-based filter UI | active (B) | canvas |
| `src/ui/views/Dashboard/widgets/SummaryRow/` | ui | Footer aggregation | active (B) | canvas |
| `src/ui/views/Dashboard/widgets/ViewPort/` | ui | Layout container | active (B) | canvas |
| `src/ui/views/Dashboard/widgets/WidgetHost.svelte` | ui | Resize / drag / error boundary / config | active (B) | canvas |
| `src/ui/views/Dashboard/widgets/FormulaBar.svelte` + `FormulaVisualEditor.svelte` + `FormulaNode.svelte` | ui | Inline formula editor (legacy surface — R3.1 Stage 3 deferred) | **C — duplicate of FormulaEditor** | DashboardCanvas |
| `src/ui/views/Dashboard/widgets/configPanelRegistry.ts` | ui | Per-widget cog-panel registry | active (A) | WidgetHost |
| `src/ui/views/VisualizerPane/visualizerPaneView.ts` + `VisualizerPane.svelte` | ui | YAML Visualizer sidebar leaf (R1) | active (B) | sidebar |
| `src/ui/views/YamlVisualizer/YamlVisualizer.svelte` + view | ui | YAML Visualizer main pane (R1.5 + R3.1 pilot) | active (B) | view registry |
| `src/ui/views/YamlVisualizer/RelationListView.svelte` | ui | Shared relation pill list | active (A) | Visualizer + GridRelationCell |

**Quality grade legend**: `A` = clean & tested · `B` = working with minor issues · `C` = technical debt / duplicates · `D` = bugs / no tests · `F` = full rebuild required.

---

## 2. Architectural-layer map

```
┌────────────────────────────────────────────────────────────────────┐
│ Layer 4 — Plugin shell  (main.ts, view.ts, customViewApi.ts)      │
│ Layer 3 — UI surface    (src/ui/...)                               │
│   3.a Views: Table[F] · Board · Calendar · Gallery · Database     │
│   3.b Components, Modals, Settings, Tokens                         │
│ Layer 2 — Engine core   (src/lib/...)                              │
│   2.a Pure data: dataframe, datasources, metadata                  │
│   2.b Cross-cutting: dataApi, viewApi, externalFrameResolver       │
│   2.c Domain pure: database/, visualizer/, relations/, formula/    │
│   2.d Stores: settings, i18n, commandBus, dataframe                │
│ Layer 1 — Settings + types  (src/settings/, types files)           │
└────────────────────────────────────────────────────────────────────┘
                Dependencies flow strictly inward.
```

---

## 3. Known critical issues (priority map)

| # | Issue | Location | Priority | Owner ticket (Phase 3) |
|---|---|---|---|---|
| K1 | **Dual Formula engine** — `helpers/formulaParser.ts` (canonical) vs `Database/engine/formulaEngine.ts` (in-frame) — different operators, different metadata, fragmented surfaces (FormulaBar, FormulaEditor, AdvancedFilterEditor, DateFormulaInput) | engine | **P0** | REFACTOR-FOUNDATION-FORMULA |
| K2 | **Dual Filter engine** — `lib/datasources/filterFunctions.ts` (global, schema-aware) vs `Database/engine/transformExecutor.ts::executeFilter` (pipeline) — different operator sets, different null/array semantics | engine | **P0** | REFACTOR-FOUNDATION-FILTER |
| K3 | **Table view F-grade** — visual bugs since v1 (column width persist in px, GridColumnHeader uses flex not grid, DataGrid coupled to Database widget) | ui | **P0** | REFACTOR-VIEW-TABLE-REBUILD |
| K4 | **Color/Palette scattered** — `ColorPicker`, `PaletteManager`, favorite-color persistence inconsistent between components | ui | **P1** | REFACTOR-UX-COLOR |
| K5 | **Database View → Dashboard View rename** — concept drift (canvas, not table) | naming | **P1** | REFACTOR-RENAME-DASHBOARD (atomic) |
| K6 | **YAML Visualizer not native-replacement** — sidebar leaf only; not registered as Properties replacement | ui | **P1** | REFACTOR-VISUALIZER-PROPERTIES |
| K7 | **Cross sub-base relations missing** — sub-bases are filter partitions; row-to-row + property-to-property cross-sub-base joins not implemented | engine | **P1** | REFACTOR-DATAMODEL-MATRYOSHKA |
| K8 | ~~**Command duplication** — `main.ts` registers commands AND `CommandManager.ts` registers commands~~ ✅ RESOLVED REFACTOR-008 (main.ts is now a thin facade) | shell | **P2** | REFACTOR-SHELL-COMMANDS |
| K9 | **Fire-and-forget Promises** — `ViewApi`, `App.svelte` cache loaders | engine | **P2** | REFACTOR-ENGINE-PROMISE-AUDIT |
| K10 | **Date precision** — `getTime()` ms-comparisons leak across timezone boundary in some Calendar/Agenda filters | ui | **P2** | REFACTOR-CALENDAR-DATE-AUDIT |
| K11 | **R3.1 Stage 3+4 deferred** — FormulaBar/AdvancedFilterEditor not migrated to `FormulaEditor.svelte` | ui | **P2** | REFACTOR-FORMULA-MIGRATE-FB |
| K12 | **A11y backlog** — 20 audit findings open (focus-visible, modal escape, RelationListView focus-trap) | ui | **P3** | REFACTOR-A11Y-SWEEP |
| K13 | **Accessibility outline:none without :focus-visible** — multiple components | ui | **P3** | REFACTOR-A11Y-SWEEP |

---

## 4. Active vs archived documents

| Status | Document | Notes |
|---|---|---|
| **Active** | `MASTER_MAP.md` | this file — refresh after every ticket |
| **Active** | `ARCHITECTURE.md` | code-space map (will be superseded by `ARCHITECTURE_V4.md` after Phase 2) |
| **Active** | `IMPLEMENTATION_PLAN_CURRENT.md` | living plan — Phase 3 will replace its body with the implementation queue |
| **Active** | `DOCS_INDEX.md` | navigation entry point |
| **Active** | `CODE_STANDARDS.md` / `CODE_STANDARDS-RU.md` | engineering standards |
| **Active** | `api.md` / `api-ru.md` | public Custom View API contract |
| **Active** | `user-guide.md` / `user-guide-EN.md` | end-user guides |
| **Archived 2026-05-02** | `archive/DOCUMENTATION_STRUCTURE.md` | content folded into `MASTER_MAP.md` §4 |
| **Archived 2026-05-02** | `archive/IMPLEMENTATION_BLUEPRINT.md` | superseded by Refactoring Session v4.0 mandate |
| **Archived 2026-05-02** | `archive/ROADMAP_DATABASE_2026.md` | superseded by `ARCHITECTURE_V4.md` (Phase 2) + Phase 3 queue |
| **Archived 2026-05-02** | `archive/architecture-engine-v2.md` | superseded by Unified DataEngine in `ARCHITECTURE_V4.md` |
| **Archived 2026-05-02** | `archive/architecture-database-view.md` | frozen v3.3.x reference — will be re-derived in `ARCHITECTURE_V4.md` Dashboard section |
| **Archived 2026-05-02** | `archive/architecture-agenda.md` | reference (Calendar/Agenda) — out of v4 scope |
| **Archived 2026-05-02** | `archive/architecture-drag-drop.md` | reference (Calendar/Board DnD) — out of v4 scope |
| **Archived 2026-05-02** | `archive/architecture-filters.md` | superseded by Unified Filter Engine in `ARCHITECTURE_V4.md` |
| **Archived 2026-05-02** | `archive/database-view-pivot.md` | frozen v3.3.x reference |
| **Archived 2026-05-02** | `archive/database-view-ui-ux.md` | frozen v3.3.x reference |
| **Archived 2026-05-02** | `archive/v3.0.9-cache.md` | older archive |
| **Archived 2026-05-02** | `archive/v3.3.1-modernization.md` | older archive |
| **Archived 2026-05-02** | `archive/refactoring-spec-v1.md` | older archive |
| **Archived 2026-05-02** | `archive/audit-database-view-specs.md` | older archive |
| **Archived 2026-05-02** | `archive/database-view-v3.4.0-spec.md` | older archive |

Archive policy: read-only by convention. If a fact from an archived document is still needed, copy it forward into `MASTER_MAP.md` or `ARCHITECTURE_V4.md`.

---

## 5. Update protocol

After every refactoring ticket:
1. Update §1 row(s) for any file added / changed / re-graded.
2. Update §3 if a known issue is closed or a new one is found.
3. Update §4 if a document moves between active and archive.
4. Bump the "Updated" date in the header.
5. Record architectural decision in `.ai_internal/context_state.md` (continuity log).
