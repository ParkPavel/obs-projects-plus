# Session 3 Re-prompt — Аналитическая сессия по плану модернизации

> **Назначение**: нулевая точка входа для сессии 3. Прочитай этот файл первым — он восстанавливает полный контекст и запускает аналитическую сессию.
> **Дата создания**: 2026-05-07
> **Результат сессии 3**: новый `docs/internal/MODERNIZATION_PLAN_V5.md` с конкретными tickets и приоритетами

---

## 0. Инструкция для агента

Это не задача на код. Это **аналитическая сессия**:
1. Прочитай все ссылочные документы из §8 ниже
2. Проведи gap-анализ: что из перечисленных целей реализовано, что нет, что несовместимо
3. Задавай уточняющие вопросы пользователю (сессия интерактивная)
4. Создай `docs/internal/MODERNIZATION_PLAN_V5.md` с приоритизированным планом
5. Никакого кода до явного старта сессии 4

---

## 1. Стек проекта

| Параметр | Значение |
|----------|---------|
| Плагин | obs-projects-plus (fork obsidian-projects by Marcus Olsson) |
| Версия | 3.4.2 |
| TypeScript | strict mode, zero `@ts-ignore` |
| UI | Svelte 3.59.2 (не 4, не 5) |
| Build | esbuild + custom mergeCSS |
| Tests | Jest 29 — **102 suites / 1650 tests PASS** |
| i18n | i18next, en/ru/uk/zh-CN |
| Peer deps | obsidian (API), obsidian-dataview (optional) |
| PX-budget | ≤191 hardcoded px (ratchet test locked) |

---

## 2. Архитектурный статус — 4 слоя

```
Shell      → src/main.ts, view.ts, customViewApi.ts, managers/
UI         → src/ui/app/, src/ui/views/ (Dashboard/Calendar/Board/Gallery)
Engine     → src/lib/engine/, lib/database/, lib/relations/, lib/formula/
Data       → src/lib/dataframe/, datasources/, frontmatter/, filesystem/
```

**Что реализовано и работает (Engine):**
- `filterEvaluator.ts` — canonical filter kernel (60+ тест-кейсов), relative date operators
- `extendedEvaluator.ts` — полный formula engine (~700 LOC: финансы, статистика, дата, строки)
- `crossProjectResolver.ts` / `crossProjectRollup.ts` — cross-project relations + rollups
- `inverseIndex.ts` + `crossSubBase.ts` — bidirectional relation resolution
- `rollupMode.ts` — 20+ rollup-функций
- `subBase.ts` + `subBasePartition.ts` — data model для под-баз
- `cellEditor.ts` — типизированное редактирование ячеек

**Что НЕ подключено к UI (критические gaps):**
- Sub-base tabs — движок есть, UI не вписан в DashboardCanvas
- Rollup-поля — движок есть, ConfigureField UI — заглушка
- Relation cell renderer — raw text вместо pill-chips
- Formula column — FormulaBar есть, inline cell render не работает
- Bidirectional relation display — inverse list в записях не показывается

---

## 3. Notion Parity Score (на 2026-05-05)

| Категория | Score | Вес | Вклад |
|-----------|-------|-----|-------|
| Property Types | ~88% | 0.25 | 22.0 |
| View Types | 67% | 0.20 | 13.4 |
| Filter/Sort/Group | ~73% | 0.15 | 10.95 |
| Formula | 95% | 0.15 | 14.25 |
| Table UI Controls | 88% | 0.15 | 13.2 |
| Automation | 0% | 0.05 | 0 |
| Inline UI | 70% | 0.05 | 3.5 |
| **ИТОГО** | **~77%** | 1.00 | 77.3 |

**Цель**: ≥90%. Automation и Timeline view — осознанные N/A для текущего цикла.

---

## 4. Активные технические долги (K-*)

| ID | Описание | Severity | R5-ticket | Статус |
|----|---------|----------|-----------|--------|
| K-1 | Legacy DataGrid (~424 LOC, D-grade) | P1 | R5-001 | BACKLOG V5.4 |
| K-2 | Formula surfaces unification | P2 | R5-002 | Phase 1 DONE, Phase 2 pending |
| K-3 | Calendar agenda parallel filterEngine | P1 | R5-003 | BACKLOG V5.2 |
| K-4 | Footer count semantic divergence | P1 | R5-004 | DEFERRED → R5-001 |
| K-13 | DashboardCanvas.svelte ~700 LOC | P2 | R5-013 | BACKLOG V5.2 |

---

## 5. Принятые решения — не пересматриваются

| Q | Решение |
|---|---------|
| Q1 | Документация: EN-primary public, internal в `docs/internal/`, архив в `docs/archive/` |
| Q2 | User guide отложен до V5.4+ (после Table rebuild) |
| Q3 | Версия остаётся 3.x.x на весь V5 цикл |
| Q4 | Sub-bases = отдельный widget, не рекурсивный DashboardCanvas |
| Q5 | "Database View Modernization" — неверный термин. v3.4.0 = миграция в Dashboard paradigm |
| Q6 | Dataview = adaptive absorption (не замена), аналоги Notion-функций + bridges |

---

## 6. Цель сессии 3 — разработать план модернизации

Требуется новый документ `docs/internal/MODERNIZATION_PLAN_V5.md`, покрывающий:

### 6.1 Dataview Adaptive Bridge (новое, заменяет Engine v2)
- Матрица: Notion function ↔ Dataview analog ↔ bridge (см. `DATAVIEW_ABSORPTION_PLAN.md`)
- Приоритизированные bridges: Relation UI, Rollup UI, Status semantics, Sub-base tabs
- Graceful degradation для пользователей без Dataview

### 6.2 Dashboard Engine improvements
- Sub-base tabs — wire `SubBaseTabs.svelte` в DashboardCanvas как первоклассные вкладки
- Rollup config UI — дополнить `ConfigureField.svelte`
- Bidirectional relation display — inverse list в record detail

### 6.3 Table/DataGrid полная переработка (Notion-spec)
- Sticky title column, type-aware cell renderers, pill chips for relations/select
- Hover actions (↗ open note, checkbox select), column header с type-icon + sort indicator
- Inline cell edit on single click (не double-click, не modal)
- Это заменяет K-1 (R5-001)

### 6.4 UI/UX gap closure (из NOTION_PARITY.md)
- Notion-style cell renderers для всех типов полей
- Record detail panel (full property editor, не generic EditNote)
- Nested filter groups в UI (PARITY-017)

---

## 7. Ограничения (не в scope V5)

- Multi-user / real-time collaboration
- Timeline/Gantt view (PARITY-015) — слишком сложно для V5
- Full DQL (JavaScript eval, JOIN между vault-папками)
- Svelte 4 migration (blocker снят в R5-015, но сама миграция → V6)
- Web export / publishing

---

## 8. Входные материалы для сессии 3

Прочитать в начале сессии:

| Документ | Что даёт |
|----------|---------|
| `docs/ARCHITECTURE_V5.md` | Текущая 4-слойная архитектура, module grades, contracts |
| `docs/internal/NOTION_PARITY.md` | Полная таблица gaps (PARITY-001..PARITY-020+) |
| `docs/internal/DATAVIEW_ABSORPTION_PLAN.md` | Матрица аналогов, gaps, bridges |
| `docs/internal/REFACTOR_BACKLOG_V5.md` | Текущие R5-tickets со статусами |
| `docs/internal/DESIGN_CONCEPT_NOTION_AESTHETIC.md` | Визуальный референс |
| `memories/repo/session-state.md` | Актуальный статус: тесты, версии, constraints |
| `.ai_internal/NOTION_DATABASE_INTEGRATION_MASTER.md` | Полный Notion reverse-engineering (части I-V) |
| `.ai_internal/NOTION_OBJECTS_UI_TREE.md` | Notion UI tree (§§5-20): toolbar, cells, context menus |

---

## 9. Формат вывода сессии 3

**Файл**: `docs/internal/MODERNIZATION_PLAN_V5.md`

**Структура**:
1. Vision одной строкой (уточнённый)
2. Приоритизированный список фаз (V5.x) с описанием целей
3. Для каждой фазы: tickets с DEPENDS_ON / BLOCKS / AC / complexity
4. Gap-analysis: что текущий backlog (REFACTOR_BACKLOG_V5.md) не покрывает
5. Риски и открытые вопросы

**Формат ticket'a**:
```
### MPLAN-XXX — <название>
- **Фаза**: V5.X
- **Цель**: одна строка
- **Scope**: список файлов/модулей
- **AC**: measurable acceptance criteria
- **Depends on**: MPLAN-YYY / R5-ZZZ
- **Complexity**: XS/S/M/L/XL
```
