# MASTER_MAP_V5

> **Версия**: V5.0-foundation
> **Дата**: 2026-05-05
> **Статус**: ACTIVE — главная навигационная точка для текущей рефакторинг-сессии.
> **Замещает**: `MASTER_MAP.md`, `IMPLEMENTATION_PLAN_CURRENT.md`, `PHASE_1_MAPPING.md`, `PHASE_3_TICKETS.md`, `ARCHITECTURE.md`, `ARCHITECTURE_V4.md` (см. [archive/](archive/)).

---

## 1. Что такое V5 одной строкой

Перенос плагина с парадигмы «Database view с виджетами» на парадигму **«Dashboard-as-canvas + Matryoshka sub-bases»**: каждая заметка с frontmatter — мини-база, между внутренними базами проекта живут двусторонние relations и rollups.

## 2. Карта документов

| Документ | Роль |
|---|---|
| [MASTER_MAP_V5.md](MASTER_MAP_V5.md) | Навигация. Этот файл. |
| [ARCHITECTURE_V5.md](ARCHITECTURE_V5.md) | Целевая архитектура: 4 слоя, контракты, инварианты. |
| [REFACTOR_BACKLOG_V5.md](REFACTOR_BACKLOG_V5.md) | Приоритизированный backlog R5-001…R5-015 с зависимостями. |
| [CODE_STANDARDS.md](CODE_STANDARDS.md) / [CODE_STANDARDS-RU.md](CODE_STANDARDS-RU.md) | Нормы кода (TS strict, Svelte, тесты). |
| [api.md](api.md) / [api-ru.md](api-ru.md) | Публичный API плагина (custom views). |
| [user-guide.md](user-guide.md) / [user-guide-EN.md](user-guide-EN.md) | Гайд пользователя. |
| [DESIGN_CONCEPT_NOTION_AESTHETIC.md](DESIGN_CONCEPT_NOTION_AESTHETIC.md) | Визуальный референс. |
| [NOTION_PARITY.md](NOTION_PARITY.md) | Список фич Notion-parity (входной материал). |
| [archive/](archive/) | Все исторические документы (read-only). |

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

Подробная таблица модулей с грейдами (A-F) — в [ARCHITECTURE_V5.md §Inventory](ARCHITECTURE_V5.md#inventory).

## 4. Топ долгов (что чинить в V5)

| ID | Что | Severity | Backlog item |
|---|---|---|---|
| K-1 | Legacy DataGrid (Table view, ~1800 LOC, D-grade) | P1 | R5-001 |
| K-2 | 4 разрозненных formula surfaces | P2 | R5-002 |
| K-3 | Calendar agenda filterEngine = параллельный filter engine | P1 | R5-003 |
| K-4 | Footer `count` ≠ kernel `count` (расхождение семантики) | P1 | R5-004 |
| K-5 | Color palettes: мёртвый контракт + 5 ad-hoc реализаций | P2 | R5-005 |
| K-6 | 7 файлов с прямым `new Menu()` мимо `openContextMenu` helper | P2 | R5-006 |
| K-7 | `new RegExp(userInput)` без ReDoS guard в formulaEngine | P1 sec | R5-007 |
| K-8 | Legacy `view.type === "table"` ремап жив в useView.ts | P2 | R5-008 |
| K-9 | App.svelte / View.svelte / useView / DataFrameProvider — без unit tests | P2 | R5-014 |
| K-10 | Fire-and-forget Promises с `.catch(console.error)` в main.ts/viewApi | P2 | (внутри R5-013) |
| K-11 | Svelte 4 blocker: `(projectView.view as any).$set` | P3 | R5-015 |
| K-12 | `JSON.parse` без try/catch в DataFrameProvider:51 и filterEvaluator:70 | P2 sec | (внутри R5-007) |
| K-15 | DashboardCanvas.svelte ~700 LOC, 4+ concerns | P2 | R5-013 |

## 5. Фазы V5

| Фаза | Цель | Backlog items |
|---|---|---|
| **V5.0 Foundation** | Документы V5 (этот файл, ARCHITECTURE_V5, REFACTOR_BACKLOG_V5) + архив старых docs | (текущая фаза) |
| **V5.1 Cleanup** | ReDoS fixes, JSON.parse safety, `count` divergence, context menu helper migration, kill `(view as any).$set` | R5-004, R5-006, R5-007, R5-015 |
| **V5.2 Engine unification** | Унифицированный formula stack + поглощение Calendar filterEngine + dashboard split | R5-002, R5-003, R5-013, R5-014 |
| **V5.3 Color/Settings foundation** | Унифицированная palette, settings v4 migration | R5-005, R5-008 |
| **V5.4 Table rewrite** | Удаление legacy DataGrid, миграция table → Dashboard config | R5-001 |
| **V5.5 Sub-bases** | Matryoshka: SubBase canvas widget + add-sub-base subscriber | R5-009 |
| **V5.6 Cross-base** | Bidirectional relations + rollups между sub-bases | R5-010 |
| **V5.7 YAML Visualizer как Properties pane** | Перенос в Dashboard widgets, optional default replace | R5-011, R5-012 |

## 6. Активные/архивные документы (быстрый чек-лист)

**Активные (в `docs/`)**: `MASTER_MAP_V5.md`, `ARCHITECTURE_V5.md`, `REFACTOR_BACKLOG_V5.md`, `DOCS_INDEX.md`, `CODE_STANDARDS.md(+RU)`, `api.md(+ru)`, `user-guide.md(+EN)`, `DESIGN_CONCEPT_NOTION_AESTHETIC.md`, `NOTION_PARITY.md`.

**Архивные (в `docs/archive/`)**: `MASTER_MAP.md`, `ARCHITECTURE.md`, `ARCHITECTURE_V4.md`, `IMPLEMENTATION_PLAN_CURRENT.md`, `PHASE_1_MAPPING.md`, `PHASE_3_TICKETS.md` плюс ранее заархивированные.

## 7. Контекст и память

- `.ai_internal/context_state.md` — приватный лог решений сессии.
- `memories/repo/session-state.md` — состояние текущей сессии для агента.
- `memories/repo/contract-registry.md` — публичные контракты модулей.
- `memories/repo/decision-log.md` — лог архитектурных решений.

## 8. Граничные правила V5.0 (сейчас)

1. Никаких правок `src/` в фазе V5.0. Только документация.
2. `styles.css` — hand-maintained источник; токены вмерживаются `esbuild.config.mjs::mergeCSS()` пост-сборкой.
3. PX-budget ratchet locked at **191** ([R0_3_pxBudget.test.ts](../src/__tests__/R0_3_pxBudget.test.ts)).
4. Все архитектурные решения, затрагивающие >2 модуля, уходят в `architect` субагента до начала кода.
5. После любого крупного блока — `context-keeper` субагент для сохранения состояния.
