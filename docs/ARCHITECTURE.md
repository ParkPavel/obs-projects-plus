# Architecture Map — obs-projects-plus

> **Status**: Authoritative codebase map | **Updated**: 2026-04-30 | **Version**: 3.4.1 (WIP)

This is the master document for understanding the codebase. It maps **every top-level code space** to its purpose, key files, and the design document that owns it. Start here before reading any subsystem-specific document.

---

## 1. Architectural overview

The plugin is structured as four concentric layers (the "Matryoshka" pillar):

```
┌─────────────────────────────────────────────────────────────┐
│  4. Plugin shell                main.ts, view.ts            │
│     ┌───────────────────────────────────────────────────┐   │
│     │  3. UI surface             src/ui/                │   │
│     │     ┌────────────────────────────────────────┐    │   │
│     │     │  2. Engine core    src/lib/  (+widget  │    │   │
│     │     │     ┌──────────────────────────────┐   │    │   │
│     │     │     │  1. Data layer  dataframe/   │   │    │   │
│     │     │     │     datasources/             │   │    │   │
│     │     │     └──────────────────────────────┘   │    │   │
│     │     └────────────────────────────────────────┘    │   │
│     └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Dependencies flow **inward only**. The data layer knows nothing of the UI; the engine knows nothing of Obsidian widgets; widgets compose the engine but cannot bypass it.

---

## 2. Top-level layout

```
obs-projects-plus/
├── src/                          ← all source code (241 .ts + 190 .svelte files)
├── docs/                         ← architecture, specs, guides
├── obsidian-projects-types/      ← published type package for the Custom View API
├── demo-vault/                   ← onboarding sample notes
├── templates/                    ← markdown templates shipped with the plugin
├── scripts/                      ← build, i18n, version-bump tooling
├── releases/                     ← per-version snapshots (main.js + manifest)
├── memories/                     ← agent context cache (gitignored where applicable)
├── manifest.json / manifest-beta.json
├── package.json / tsconfig.json / esbuild.config.mjs / jest.config.js
├── README.md / README-EN.md / CHANGELOG.md / RELEASES.md
└── CONTRIBUTING.md / CODE_OF_CONDUCT.md / LICENSE
```

---

## 3. `src/` — code space map

### 3.1 Entry points

| File | Role | Notes |
|---|---|---|
| [src/main.ts](../src/main.ts) | Plugin entry, command registration, lifecycle | Registers `view.ts` and the Custom View API bridge |
| [src/view.ts](../src/view.ts) | Main `ItemView` host for all project views | Mounts `src/ui/app/App.svelte` |
| [src/customViewApi.ts](../src/customViewApi.ts) | External-plugin view registration | See [obsidian-projects-types/](../obsidian-projects-types/) |
| [src/events.ts](../src/events.ts) | Internal event constants | — |
| [src/global.d.ts](../src/global.d.ts) / [src/obsidianProjects.d.ts](../src/obsidianProjects.d.ts) | Ambient types | — |

### 3.2 `src/lib/` — Engine core

The engine is **UI-agnostic**: the same code runs in tests, in Node, and in Obsidian.

| Subspace | Purpose | Key files | Owning doc |
|---|---|---|---|
| [src/lib/dataframe/](../src/lib/dataframe/) | Canonical record shape (`DataFrame`, `DataRecord`, `DataValue`, `DataFieldType`) | [dataframe.ts](../src/lib/dataframe/dataframe.ts) | [architecture-engine-v2.md](architecture-engine-v2.md) §4 |
| [src/lib/datasources/](../src/lib/datasources/) | DataFrame producers — Folder, Tag, Dataview, Frontmatter | each subfolder has `datasource.ts` | [architecture-engine-v2.md](architecture-engine-v2.md) §2 |
| [src/lib/datasources/dataview/](../src/lib/datasources/dataview/) | Dataview-backed source | Boundary point with the Dataview plugin | [architecture-engine-v2.md](architecture-engine-v2.md) §2 |
| [src/lib/metadata/](../src/lib/metadata/) | Frontmatter encode/decode | `encode.ts`, `decode.ts` | self-documenting (`README.md`) |
| [src/lib/filesystem/](../src/lib/filesystem/) | `IFileSystem` abstraction (Obsidian + in-memory) | `filesystem.ts` + `obsidian/` + `inmem/` | self-documenting (`README.md`) |
| [src/lib/dataApi.ts](../src/lib/dataApi.ts) | CRUD operations on records (write path) | Uses `fileManager.processFrontMatter` | [api.md](api.md) |
| [src/lib/viewApi.ts](../src/lib/viewApi.ts) | View-side helpers consumed by Svelte | — | [api.md](api.md) |
| [src/lib/externalFrameResolver.ts](../src/lib/externalFrameResolver.ts) | Resolves a sibling project's DataFrame by id | Foundation for cross-project Relations/Rollups (M0) | [architecture-engine-v2.md](architecture-engine-v2.md) §4.3 |
| [src/lib/helpers/](../src/lib/helpers/) | Pure utilities — date formulas, formula parser, ReDoS-safe regex, sanitizers | `dateFormulaParser.ts`, `formulaParser.ts`, `regexSafety.ts`, `sanitizeHtml.ts` | inline JSDoc |
| [src/lib/stores/](../src/lib/stores/) | Svelte stores (singletons) — settings, i18n, dataframe, capabilities | `settings.ts`, `i18n.ts`, `translations/{en,ru,uk,zh-CN}.json` | inline JSDoc |
| [src/lib/duplicate/](../src/lib/duplicate/) | Duplicate-detection logic | — | inline JSDoc |
| [src/lib/templates/](../src/lib/templates/) | Note templating engine (Templater-style placeholders) | — | inline JSDoc |
| [src/lib/tokens/](../src/lib/tokens/) | Design tokens (rem/spacing) | — | "Zero Pixels" pillar |

### 3.3 `src/managers/` — Plugin lifecycle services

| File | Role |
|---|---|
| [src/managers/CommandManager.ts](../src/managers/CommandManager.ts) | Dynamic registration / cleanup of project-scoped commands |

### 3.4 `src/settings/` — Settings & migration

| Subspace | Role | Notes |
|---|---|---|
| [src/settings/base/](../src/settings/base/) | Current `settings.ts` (active schema, `FieldConfig`, `ProjectDefinition`) | **Single source of truth for schema** |
| [src/settings/v1/](../src/settings/v1/) / [v2/](../src/settings/v2/) / [v3/](../src/settings/v3/) | Versioned migration steps | Chained at boot |
| [src/settings/settings.ts](../src/settings/settings.ts) | Public re-export façade | — |

### 3.5 `src/ui/` — UI surface

UI is split between a **shared Svelte app shell** (`ui/app/`) and **per-view trees** (`ui/views/<ViewName>/`). View trees own their components, types, and (where relevant) engines.

| Subspace | Role | Owning doc |
|---|---|---|
| [src/ui/app/](../src/ui/app/) | Shell — `App.svelte`, `View.svelte`, `DataFrameProvider.svelte`, sort/filter helpers, onboarding | inline JSDoc |
| [src/ui/components/](../src/ui/components/) | Cross-view reusable components | inline JSDoc |
| [src/ui/modals/](../src/ui/modals/) | Modal dialogs (create note, settings, etc.) | inline JSDoc |
| [src/ui/settings/](../src/ui/settings/) | Settings tab UI | inline JSDoc |
| [src/ui/tokens/](../src/ui/tokens/) | UI-side design tokens | "Zero Pixels" pillar |
| [src/ui/views/Table/](../src/ui/views/Table/) | Legacy Table view (deprecated by Database View) | — |
| [src/ui/views/Board/](../src/ui/views/Board/) | Kanban board, persist columns, zoom, collapse | [architecture-drag-drop.md](architecture-drag-drop.md) |
| [src/ui/views/Calendar/](../src/ui/views/Calendar/) | Calendar with timeline, agenda 2.0, gestures, DnD | [architecture-agenda.md](architecture-agenda.md), [architecture-drag-drop.md](architecture-drag-drop.md) |
| [src/ui/views/Calendar/agenda/](../src/ui/views/Calendar/agenda/) | Filter UI engine for agenda | [architecture-filters.md](architecture-filters.md) |
| [src/ui/views/Calendar/dnd/](../src/ui/views/Calendar/dnd/) | TimelineDragManager, SnapEngine, HapticManager | [architecture-drag-drop.md](architecture-drag-drop.md) |
| [src/ui/views/Gallery/](../src/ui/views/Gallery/) | Card gallery view | inline JSDoc |
| [src/ui/views/Database/](../src/ui/views/Database/) | Database View canvas (8 widgets, in-frame engine) | [architecture-database-view.md](architecture-database-view.md), [architecture-engine-v2.md](architecture-engine-v2.md) |

### 3.6 `src/ui/views/Database/` — Database View internals

| Subspace | Role |
|---|---|
| [DatabaseViewCanvas.svelte](../src/ui/views/Database/DatabaseViewCanvas.svelte) | Top-level canvas, widget host, layout grid |
| [databaseView.ts](../src/ui/views/Database/databaseView.ts) | View registration |
| [engine/](../src/ui/views/Database/engine/) | **In-frame** computation engine (see §3.7) |
| [widgets/](../src/ui/views/Database/widgets/) | 8 widget implementations (see §3.8) |
| [migration.ts](../src/ui/views/Database/migration.ts) | Per-config migrations |
| [fieldTypes.ts](../src/ui/views/Database/fieldTypes.ts) | Field-type metadata for widgets |
| [designTokens.ts](../src/ui/views/Database/designTokens.ts) | Local tokens (rem-only) |
| [widgetTemplates.ts](../src/ui/views/Database/widgetTemplates.ts) | Pre-canned widget configurations |

### 3.7 Database engine (`src/ui/views/Database/engine/`)

| File | Role |
|---|---|
| [aggregation.ts](../src/ui/views/Database/engine/aggregation.ts) | Column / pipeline aggregations |
| [chartDataPipeline.ts](../src/ui/views/Database/engine/chartDataPipeline.ts) | DataFrame → chart-ready series |
| [conditionalFormat.ts](../src/ui/views/Database/engine/conditionalFormat.ts) | Per-cell colour & icon rules |
| [formulaEngine.ts](../src/ui/views/Database/engine/formulaEngine.ts) | 102-function formula evaluator |
| [formulaMetadata.ts](../src/ui/views/Database/engine/formulaMetadata.ts) | Function catalog (signatures + docs) |
| [formulaSerializer.ts](../src/ui/views/Database/engine/formulaSerializer.ts) | AST ↔ string |
| [joinKey.ts](../src/ui/views/Database/engine/joinKey.ts) | Multi-source merge key builder |
| [relationResolver.ts](../src/ui/views/Database/engine/relationResolver.ts) | **In-frame** wiki-link resolver (`[[Note]]` → record). Cross-project resolver is M0. |
| [rollup.ts](../src/ui/views/Database/engine/rollup.ts) | **In-frame** rollup (sum/avg/count/min/max/median/range/concat). Cross-project rollup is M0. |
| [transformExecutor.ts](../src/ui/views/Database/engine/transformExecutor.ts) | Pipeline runner (FILTER/COMPUTE/UNPIVOT/UNNEST/AGGREGATE/PIVOT) |
| [transformPivot.test.ts](../src/ui/views/Database/engine/transformPivot.test.ts) | Pivot/unpivot tests |
| [transformCache.ts](../src/ui/views/Database/engine/transformCache.ts) | Memoization (steady-state recomputation guard) |
| [virtualScroll.ts](../src/ui/views/Database/engine/virtualScroll.ts) | Row virtualization helper |
| [accessibility.ts](../src/ui/views/Database/engine/accessibility.ts) | A11y helpers used by widgets |

### 3.8 Database widgets (`src/ui/views/Database/widgets/`)

| Widget | Folder | Notes |
|---|---|---|
| DataTable | [DataTable/](../src/ui/views/Database/widgets/DataTable/) | Primary table widget — rem widths, group rows, field presets |
| Chart | [Chart/](../src/ui/views/Database/widgets/Chart/) | 7 chart types (Bar, Line, Pie, Scatter, Number, Progress) + `ChartConfig.svelte` |
| Stats | [Stats/](../src/ui/views/Database/widgets/Stats/) | Aggregated KPIs |
| Comparison | [Comparison/](../src/ui/views/Database/widgets/Comparison/) | Two-series compare |
| Checklist | [Checklist/](../src/ui/views/Database/widgets/Checklist/) | Boolean field rollup |
| FilterTabs | [FilterTabs/](../src/ui/views/Database/widgets/FilterTabs/) | Tab-based filter UI |
| SummaryRow | [SummaryRow/](../src/ui/views/Database/widgets/SummaryRow/) | Footer aggregation row |
| ViewPort | [ViewPort/](../src/ui/views/Database/widgets/ViewPort/) | Layout container |
| (host) | [WidgetHost.svelte](../src/ui/views/Database/widgets/WidgetHost.svelte) | Resize, drag, error boundary |
| (toolbar) | [WidgetToolbar.svelte](../src/ui/views/Database/widgets/WidgetToolbar.svelte) | Per-widget controls |
| (formula bar) | [FormulaBar.svelte](../src/ui/views/Database/widgets/FormulaBar.svelte), [FormulaVisualEditor.svelte](../src/ui/views/Database/widgets/FormulaVisualEditor.svelte), [FormulaNode.svelte](../src/ui/views/Database/widgets/FormulaNode.svelte) | Visual formula editor |
| (registry) | [widgetRegistry.ts](../src/ui/views/Database/widgets/widgetRegistry.ts), [configPanelRegistry.ts](../src/ui/views/Database/widgets/configPanelRegistry.ts) | Add new widgets here |

### 3.9 Tests (`src/__tests__/` and `src/**/*.test.ts`)

- Total: **54 test suites**, ≈923 tests
- Run: `npm test` (Jest 29 + jsdom)
- Coverage by area: `dataframe/`, `helpers/`, `Database/engine/`, `Calendar/dnd/`, `agenda/filters/`
- Mocks: [src/\_\_mocks\_\_/](../src/__mocks__/) (Obsidian API), [src/lib/stores/\_\_mocks\_\_/](../src/lib/stores/__mocks__/)

---

## 4. Build & runtime

| Concern | Tool | File |
|---|---|---|
| Bundling | esbuild | [esbuild.config.mjs](../esbuild.config.mjs) |
| Type checking | `tsc -noEmit -skipLibCheck` | [tsconfig.json](../tsconfig.json) |
| Tests | Jest 29 + jsdom | [jest.config.js](../jest.config.js) |
| Lint | ESLint 9 (flat config) + `eslint-plugin-obsidianmd` | [eslint.config.mjs](../eslint.config.mjs) |
| Format | Prettier | — |
| Svelte compile | esbuild-svelte (Svelte 3.59.2) | — |
| Output | `main.js` + `styles.css` | repo root |

`npm run build` → `tsc -noEmit -skipLibCheck && esbuild production`. Both the type pass and the build pass must be green for a release.

---

## 5. Custom View API (external)

[obsidian-projects-types/](../obsidian-projects-types/) is a **public NPM-style type package** that other Obsidian plugins can install to register their own project views.

- Bridge: [src/customViewApi.ts](../src/customViewApi.ts)
- Contract: implement `onRegisterProjectView()` returning a `ProjectView`
- Status: experimental — kept for compatibility with the original [obsidian-projects](https://github.com/marcusolsson/obsidian-projects)

---

## 6. Documentation map

Active documents only — see [docs/archive/README.md](archive/README.md) for historical context.

### Authoritative

| Document | Audience | Purpose |
|---|---|---|
| [DOCS_INDEX.md](DOCS_INDEX.md) | All | Navigation index |
| **ARCHITECTURE.md** (this file) | Contributors | Codebase map (single source of truth) |
| [DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md) | Maintainers | Where each doc type lives |
| [architecture-engine-v2.md](architecture-engine-v2.md) | Contributors | Engine v2 design (cross-project Relations/Rollups, Custom Properties Viewer, Formula Editor Popup) |
| [IMPLEMENTATION_PLAN_CURRENT.md](IMPLEMENTATION_PLAN_CURRENT.md) | Maintainers | Active plan, findings, milestones |
| [ROADMAP_DATABASE_2026.md](ROADMAP_DATABASE_2026.md) | All | Calendar roadmap M0–M5 |

### Reference (still valid, not the active plan)

| Document | Subject |
|---|---|
| [architecture-database-view.md](architecture-database-view.md) | Database View widget architecture (v3.3.x baseline) |
| [architecture-agenda.md](architecture-agenda.md) | Agenda 2.0 |
| [architecture-drag-drop.md](architecture-drag-drop.md) | Calendar/Board DnD |
| [architecture-filters.md](architecture-filters.md) | 42-operator filter engine |
| [database-view-ui-ux.md](database-view-ui-ux.md) | UI/UX patterns for Database View (v3.3.x reference) |
| [database-view-pivot.md](database-view-pivot.md) | TransformPipeline spec (v3.3.x reference, implemented) |

### User & API

| Document | Audience |
|---|---|
| [user-guide.md](user-guide.md) / [user-guide-EN.md](user-guide-EN.md) | End users |
| [api.md](api.md) / [api-ru.md](api-ru.md) | Plugin API consumers |
| [CODE_STANDARDS.md](CODE_STANDARDS.md) / [CODE_STANDARDS-RU.md](CODE_STANDARDS-RU.md) | Contributors |

### Process

- [../CONTRIBUTING.md](../CONTRIBUTING.md) — onboarding & PR rules
- [../CHANGELOG.md](../CHANGELOG.md) — Keep a Changelog format
- [../RELEASES.md](../RELEASES.md) / [../RELEASES-EN.md](../RELEASES-EN.md) — narrative release notes

---

## 7. Project vector (2026 → )

The product is moving from "multi-view project manager" toward a **local-first, YAML-native, Notion-class data workspace**. Concretely:

1. **Engine v2** — autonomous YAML reading independent of Dataview; cross-project Relations and Rollups (Notion-class linkage); typed Custom Properties Viewer; unified Formula Editor popup. Tracked in [architecture-engine-v2.md](architecture-engine-v2.md).
2. **Database View** as the primary surface — Table View remains for backward compatibility but receives no new features.
3. **Six pillars** (immutable design constraints):
   - **P1 Matryoshka** — concentric layers, dependencies inward only.
   - **P2 Zero Pixels** — UI sizing in `rem`/tokens; pixels only at engine→library boundaries.
   - **P3 Data Flow over Folders** — projects are queries, not folders.
   - **P4 Interface Reclamation** — every UI affordance must produce a user-visible value.
   - **P5 Complex Data Modeling** — typed fields, relations, rollups, formulas.
   - **P6 Fix to Every Pixel** — accessibility, mobile parity, no regressions.
4. **No public release** until milestone M5 (Stabilization). Versions 3.4.X are internal WIP.

---

## 8. How to navigate this codebase

- **Adding a new widget** → [src/ui/views/Database/widgets/](../src/ui/views/Database/widgets/) + register in `widgetRegistry.ts`. See [architecture-database-view.md](architecture-database-view.md) §6.
- **Adding a new chart type** → extend [Chart/](../src/ui/views/Database/widgets/Chart/) + add a case in `chartDataPipeline.ts`.
- **Adding a new datasource** → new folder under [src/lib/datasources/](../src/lib/datasources/), implement `IDataSource`, register in `index.ts`.
- **Adding a new field type** → extend `DataFieldType` in [dataframe.ts](../src/lib/dataframe/dataframe.ts), update encoders/decoders in [src/lib/metadata/](../src/lib/metadata/), add UI in [src/ui/views/Database/fieldTypes.ts](../src/ui/views/Database/fieldTypes.ts).
- **Adding a new formula function** → extend [formulaEngine.ts](../src/ui/views/Database/engine/formulaEngine.ts) + register in [formulaMetadata.ts](../src/ui/views/Database/engine/formulaMetadata.ts) (provides UI tooltip + i18n).
- **Adding a new language** → new file under [src/lib/stores/translations/](../src/lib/stores/translations/), register in `i18n.ts`. Run `node scripts/sync-translations.mjs` to detect missing keys.

---

## 9. What this document does **not** cover

- Per-feature implementation details — see the corresponding `architecture-*.md`.
- Active in-flight work — see [IMPLEMENTATION_PLAN_CURRENT.md](IMPLEMENTATION_PLAN_CURRENT.md).
- Release history — see [../CHANGELOG.md](../CHANGELOG.md) and [../RELEASES.md](../RELEASES.md).
- Removed or superseded designs — see [docs/archive/](archive/).

---

## 10. Update protocol

This document is updated when **any** of the following changes:

- A top-level folder under `src/` is added, removed, or renamed.
- A new architectural pillar is adopted or retired.
- A documentation document is moved between Active / Reference / Archive.
- The vector statement in §7 changes.

Other changes (new widget, new formula, new translation key) update the linked subsystem doc, not this one.
