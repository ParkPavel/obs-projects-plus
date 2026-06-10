# Текущий контекст — для агентов

> Обновлено: **2026-06-10 (M-UI-MODERNIZATION DONE — #050–#058 закрыты; #052 PARTIAL — WidgetShell dead code)**

## Состояние веток

- HEAD `main`: **`f23efdb`** — `feat(agents): harden 4-gate verification cycle`
- HEAD `feat/dashboard-v2`: **`53ed8a8`** — `fix(tokens): #058 resolve z-index scale`
- Active branch: `feat/dashboard-v2` — новый цикл разработки Dashboard V2.
- Archive branch: `archive/dashboard-v1` — снимок V1 на момент запуска V2.
- Working tree: clean.
- Plugin version: `3.5.1-alpha`.

## Гейты (feat/dashboard-v2 @ 53ed8a8)

| Гейт | Результат |
|---|---|
| `npm run build` | ✅ 0 errors |
| `npm test` | ✅ **134 suites / 2020 tests PASS** |
| `npm run lint` | ✅ 0 errors |
| `npm run svelte-check` | ✅ 0 errors |
| `@ts-ignore` в src | 0 ✅ |
| PX-budget (`R0_3_pxBudget.test.ts`) | ≤186, locked ✅ |

## Активная работа

### Dashboard V2 (`feat/dashboard-v2`)

Полный перезапуск Dashboard. Документы:
- `docs/internal/DASHBOARD_V2_SPEC.md` — спецификация (rev.3, согласована)
- `docs/internal/DASHBOARD_V2_VISION.md` — пользовательское видение (источник правды для UX)
- `docs/internal/UI_MODERNIZATION_PLAN.md` — M-UI-MODERNIZATION (V2-aligned, 2026-06-10)
- `docs/internal/UI_DESIGN_ARCHITECTURE.md` — Notion-parity mapping + полная архитектурная схема (2026-06-10)

**✅ Фаза 0 ЗАВЕРШЕНА** — все 4 CI ворот зелёные на `feat/dashboard-v2`.  
**✅ Фаза 1 ЗАВЕРШЕНА** — Engine перенесён в `src/lib/dashboard-engine/`.  
**✅ Фаза 2 ЗАВЕРШЕНА** — `FilterPanel.svelte` — единый компонент фильтрации.  
**✅ Фаза 3 ЗАВЕРШЕНА** — `DashboardCanvas.svelte` = 200 LOC, FreeCanvas удалён.  
**✅ Фаза 4 ЗАВЕРШЕНА** — DatabaseCallBlock (Board/Calendar/Gallery вкладки), Canvas Selection Bus, LinkedSelection настройки.  
**✅ Фаза 4.5 ЗАВЕРШЕНА** — Multi-select: `is-any-of` оператор + `SelectionState.values[]` + все receiver/driver мигрированы. Commit `92f5073`.  
**✅ M-UI-MODERNIZATION ЗАВЕРШЁН**: #050–#058 выполнены (5 коммитов, 2026-06-10). Исключение: #052 PARTIAL (WidgetShell dead code — интеграция в WidgetHost не выполнена).  
**Следующий шаг**: Блок B — first-glance UX fixes (demoProject + widgetRegistry + templates) + #052 integration decision.

## Завершённые milestones

| Milestone | Статус |
|---|---|
| M-ENGINE-CLEANUP | ✅ DONE |
| M-COLOR-SETTINGS | ✅ DONE |
| M-CANVAS-REACTIVE Phase 1–3 (#016, #031, #032) | ✅ DONE |
| M-TABLE-REWRITE (#001) | ✅ DONE |
| M-FREE-CANVAS | ✅ DONE |
| M-POPUP-STANDARDISATION (#034) | ✅ DONE |
| M-INTERACTIVE-DASHBOARD (#044) | ✅ DONE |
| M-DATAVIEW-BRIDGE (#045.1–.6) | ✅ DONE |
| #022 Formula Constructor series | ✅ DONE |
| #046 Demo project refactor | ✅ DONE (merged) |
| #047 UX audit / emoji→lucide sweep | ✅ DONE (merged) |
| **#049 Phase 0 — CI baseline fix** | ✅ DONE |
| **Dashboard V2 Phase 1 — Engine move** | ✅ DONE |
| **Dashboard V2 Phase 2 — Unified Filter** | ✅ DONE |
| **Dashboard V2 Phase 3 — Canvas decompose** | ✅ DONE |
| **Dashboard V2 Phase 4 — DatabaseCallWidget + Selection Bus** | ✅ DONE |
| **Dashboard V2 Phase 4.5 — Multi-select (is-any-of + values[])** | ✅ DONE (2026-06-10, `92f5073`) |
| **M-UI-MODERNIZATION (#050–#058)** | ✅ DONE (2026-06-10, HEAD `53ed8a8`) — #052 PARTIAL |

## Открытые тикеты

| Тикет | Приоритет | Статус | Описание |
|---|---|---|---|
| **#052** | P1 | ⚠️ PARTIAL | WidgetShell создан (161 LOC) но не подключён к WidgetHost — dead code. Нужно: wire или перенести в #059 |
| **#048** | P2 | 📋 BACKLOG | UI точка входа native-query в CreateProject.svelte |
| **#059** | P0 | 📋 NEW | First-glance UX: demoProject→database-call, widgetRegistry order, legacy widget hiding, templates |

## Ключевые решения (зафиксированные)

| Решение | Документ | Статус |
|---|---|---|
| V2 widget fate table (data-table → database-call, timeline/comparison → archive) | DASHBOARD_V2_SPEC.md §4 | СОГЛАСОВАНО |
| M-UI-MODERNIZATION выравнен с V2 spec (не rebuild того, что удаляется) | UI_MODERNIZATION_PLAN.md | 2026-06-10 |
| SelectionState.values[] + is-any-of (Phase 4.5) | canvasSelectionStore.ts | DONE |
| Selection Bus API контракт заморожен (не меняется в UI-M) | CROSS_WIDGET_SPEC.md | ИНВАРИАНТ |

## Запреты

- ❌ Прямые коммиты/пуши в `main`.
- ❌ Не повышать PX-budget.
- ❌ Не добавлять `@ts-ignore` в `src/`.
- ❌ `filterEvaluator.ts` — только потребление, не модифицировать параллельными реализациями.
- ❌ Не rebuild виджетов, которые V2 spec отправляет в archive (timeline, comparison, summary-row, yaml-visualizer, view-port, data-list).
