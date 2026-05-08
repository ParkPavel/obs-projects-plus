# MASTER_MAP_V5

> **Версия**: V5.1
> **Дата**: 2026-05-07
> **Статус**: ACTIVE — главная навигационная точка для текущей рефакторинг-сессии.
> **Замещает**: `MASTER_MAP.md`, `IMPLEMENTATION_PLAN_CURRENT.md`, `PHASE_1_MAPPING.md`, `PHASE_3_TICKETS.md`, `ARCHITECTURE.md`, `ARCHITECTURE_V4.md` (см. [archive/](../archive/)).

---

## 1. Что такое V5 одной строкой

Перенос плагина с парадигмы «Database view с виджетами» на парадигму **«Dashboard-as-canvas + Matryoshka sub-bases»**: каждая заметка с frontmatter — мини-база, между внутренними базами проекта живут двусторонние relations и rollups; Dataview используется как адаптивный query-backend с Notion-семантикой поверх.

## 2. Карта документов

| Документ | Роль |
|---|---|
| [MASTER_MAP_V5.md](MASTER_MAP_V5.md) | Навигация. Этот файл. |
| [ARCHITECTURE_V5.md](../ARCHITECTURE_V5.md) | Целевая архитектура: 4 слоя, контракты, инварианты. |
| [REFACTOR_BACKLOG_V5.md](REFACTOR_BACKLOG_V5.md) | Приоритизированный backlog R5-001…R5-015 с зависимостями. |
| [DATAVIEW_ABSORPTION_PLAN.md](DATAVIEW_ABSORPTION_PLAN.md) | Адаптивное поглощение Dataview: аналоги Notion-функций + bridges. |
| [SESSION_REPROMPT.md](SESSION_REPROMPT.md) | Нулевая точка входа для сессии 3 (аналитическая). |
| [CODE_STANDARDS.md](../CODE_STANDARDS.md) / [CODE_STANDARDS-RU.md](../CODE_STANDARDS-RU.md) | Нормы кода (TS strict, Svelte, тесты). |
| [api.md](../api.md) / [api-ru.md](../api-ru.md) | Публичный API плагина (custom views). |
| [user-guide.md](../user-guide.md) / [user-guide-EN.md](../user-guide-EN.md) | Гайд пользователя (отложен до V5.4+). |
| [DESIGN_CONCEPT_NOTION_AESTHETIC.md](DESIGN_CONCEPT_NOTION_AESTHETIC.md) | Визуальный референс. |
| [NOTION_PARITY.md](NOTION_PARITY.md) | Список фич Notion-parity (входной материал). |
| [UX_FLOW_MAIN_SCENARIO.md](UX_FLOW_MAIN_SCENARIO.md) | Главный UX сценарий: 5 шагов → живая база со связями. Матрица готовности. Добавлен 2026-05-08. |
| [archive/](../archive/) | Все исторические документы (read-only). |

## 3. Карта кода (4-слойная Matryoshka)

```
Shell (entry)        →  src/main.ts, src/view.ts, src/customViewApi.ts, src/managers/
UI surfaces          →  src/ui/{app, views, components, modals, settings}
Engine               →  src/lib/engine/, src/lib/database/, src/lib/relations/,
                        src/lib/visualizer/, src/lib/formula/,
                        src/ui/views/Dashboard/engine/
Data                 →  src/lib/dataframe/, src/lib/dataApi.ts, src/lib/datasources/,
                        src/lib/filesystem/, src/lib/frontmatter/, src/lib/metadata/
```

Подробная таблица модулей с грейдами (A-F) — в [ARCHITECTURE_V5.md §Inventory](../ARCHITECTURE_V5.md#inventory).

## 4. Топ долгов (что чинить в V5)

| ID | Что | Severity | Backlog item | Статус |
|---|---|---|---|---|
| K-1 | Legacy DataGrid (Table view, ~424 LOC, D-grade) | P1 | R5-001 | BACKLOG V5.4 |
| K-2 | 4 разрозненных formula surfaces | P2 | R5-002 | Phase 1 ✅ |
| K-3 | Calendar agenda filterEngine = параллельный filter engine | P1 | R5-003 | BACKLOG V5.2 |
| K-4 | Footer `count` ≠ kernel `count` (расхождение семантики) | P1 | R5-004 | DEFERRED → R5-001 |
| K-5 | Color palettes: мёртвый контракт + 5 ad-hoc реализаций | P2 | R5-005 | ✅ DONE V5.3 |
| K-6 | 7 файлов с прямым `new Menu()` мимо `openContextMenu` helper | P2 | R5-006 | ✅ DONE V5.1 |
| K-7 | `new RegExp(userInput)` без ReDoS guard в formulaEngine | P1 sec | R5-007 | ✅ DONE V5.1 |
| K-8 | Legacy `view.type === "table"` ремап жив в useView.ts | P2 | R5-008 | ✅ DONE V5.3 |
| K-9 | App.svelte / View.svelte / useView / DataFrameProvider — без unit tests | P2 | R5-014 | ✅ DONE V5.2 |
| K-11 | Svelte 4 blocker: `(projectView.view as any).$set` | P3 | R5-015 | ✅ DONE V5.1 |
| K-13 | DashboardCanvas.svelte ~700 LOC, 4+ concerns | P2 | R5-013 | BACKLOG V5.2 |
| K-17 | Transform cache NOT wired to vault events → dashboard is static, no live recalculation | **P0** | R5-016 | BACKLOG V5.9 — добавлен 2026-05-08 |

## 5. Фазы V5

| Фаза | Цель | Статус |
|---|---|---|
| **V5.0 Foundation** | Документы V5 + архив старых docs | ✅ DONE |
| **V5.1 Cleanup** | ReDoS, JSON.parse, count, context menu, $set | ✅ DONE |
| **V5.2 Engine unification** | Formula stack + Calendar filterEngine + dashboard split | 🔄 IN PROGRESS |
| **V5.3 Color/Settings** | Palette унификация, settings v4 migration | ✅ DONE |
| **V5.4 Table rewrite** | Удаление legacy DataGrid, Notion-spec table | BACKLOG |
| **V5.5 Sub-bases** | SubBase canvas widget + UI wiring в DashboardCanvas | BACKLOG |
| **V5.6 Cross-base** | Bidirectional relations + rollups между sub-bases | BACKLOG |
| **V5.7 YAML Visualizer** | Перенос в Dashboard widgets, optional Properties pane | BACKLOG |
| **V5.8 Dataview Adaptive Bridge** | Dataview как query-backend + Notion-semantic bridges | PLANNING (сессия 3) |
| **V5.9 Reactive Loop** | vault events → cache invalidation → UI push (R5-016 P0) | BACKLOG — добавлен 2026-05-08 |

## 6. Активные/архивные документы (быстрый чек-лист)

**Активные (в `docs/`)**: `ARCHITECTURE_V5.md`, `DOCS_INDEX.md`, `CODE_STANDARDS.md(+RU)`, `api.md(+ru)`, `user-guide.md(+EN)`.

**Активные (в `docs/internal/`)**: `MASTER_MAP_V5.md`, `REFACTOR_BACKLOG_V5.md`, `DESIGN_CONCEPT_NOTION_AESTHETIC.md`, `NOTION_PARITY.md`, `DATAVIEW_ABSORPTION_PLAN.md`, `SESSION_REPROMPT.md`.

**Архивные (в `docs/archive/`)**: `MASTER_MAP.md`, `ARCHITECTURE.md`, `ARCHITECTURE_V4.md`, `IMPLEMENTATION_PLAN_CURRENT.md`, `PHASE_1_MAPPING.md`, `PHASE_3_TICKETS.md` плюс ранее заархивированные.

## 7. Контекст и память

- `.ai_internal/context_state.md` — приватный лог решений сессии.
- `memories/repo/session-state.md` — состояние текущей сессии для агента.
- `memories/repo/contract-registry.md` — публичные контракты модулей.
- `memories/repo/decision-log.md` — лог архитектурных решений.

## 8. Граничные правила (V5 в целом)

1. `styles.css` — hand-maintained источник; токены вмерживаются `esbuild.config.mjs::mergeCSS()` пост-сборкой.
2. PX-budget ratchet locked at **191** ([R0_3_pxBudget.test.ts](../../src/__tests__/R0_3_pxBudget.test.ts)).
3. Все архитектурные решения, затрагивающие >2 модуля, уходят в `architect` субагента до начала кода.
4. После любого крупного блока — `context-keeper` субагент для сохранения состояния.
5. TypeScript strict — zero new `@ts-ignore`.
