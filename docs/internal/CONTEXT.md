# Текущий контекст — для агентов

> Обновлено: **2026-06-11 (#048 + #065 + #059 SmartSuggest закрыты; #052 закрыт удалением dead code → открыт #067)**

## Состояние веток

- HEAD `main`: **`f23efdb`** — `feat(agents): harden 4-gate verification cycle`
- HEAD `feat/dashboard-v2`: **`2b9d1fd`** — `feat(ux): #059 SmartSuggest — proactive data-shape suggestions (Vision §6)`
- Active branch: `feat/dashboard-v2` — **11 коммитов впереди origin** (push контролирует пользователь).
- Archive branch: `archive/dashboard-v1` — снимок V1 на момент запуска V2.
- Working tree: clean.
- Plugin version: `3.5.1-alpha`.

## Гейты (feat/dashboard-v2 @ 2b9d1fd)

| Гейт | Результат |
|---|---|
| `npm run build` | ✅ 0 errors |
| `npm test` | ✅ **138 suites / 2051 tests PASS** |
| `npm run lint` | ✅ 0 errors (130 pre-existing tsdoc warnings) |
| `npm run svelte-check` | ✅ 0 errors / 0 warnings |
| `@ts-ignore` в src | 0 ✅ |
| PX-budget (`R0_3_pxBudget.test.ts`) | ≤186, locked ✅ |
| Manual API-тест в OBStests (`MANUAL_TESTING_PIPELINE.md`) | ✅ 2026-06-11: deploy + reload + 11 команд + demo smoke A1–A7 + roundtrip. Визуальный чек-лист (#059/#065/#048 strip/zero-state/темы) — ожидает человека, см. pipeline §5 |

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
**✅ M-UI-MODERNIZATION ЗАВЕРШЁН**: #050–#058 выполнены (2026-06-10). #052 закрыт 2026-06-11 удалением dead code (`d4b7f4a`); правильная декомпозиция WidgetHost вынесена в **#067**.  
**✅ Сессия 2026-06-11** (5 коммитов): #048 native-query как персистентный datasource + UI в CreateProject (`ae1e167`); #065 canvas zero-state + общий EmptyState (`35a1d49`); #059 SmartSuggest — rule engine + suggestion strip (`2b9d1fd`).  
**Следующий шаг**: #067 WidgetHost decomposition (P1/XL — требует architect-план по DASHBOARD_V2_SPEC §6 ДО кода). Без анализа доступен #036 (mobile gestures, P2/M).

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
| **M-UI-MODERNIZATION (#050–#058)** | ✅ DONE (2026-06-10) — #052 закрыт 2026-06-11, продолжение в #067 |
| **#048 native-query datasource + CreateProject UI** | ✅ DONE (2026-06-11, `ae1e167`) |
| **#065 canvas zero-state + EmptyState** | ✅ DONE (2026-06-11, `35a1d49`) |
| **#059 SmartSuggest (Vision §6)** | ✅ DONE (2026-06-11, `2b9d1fd`) |

## Открытые тикеты

> План скорректирован 2026-06-11 дважды: (1) UT-блок M-UT-FIXES #068–#077 + спеки UT2026-A..F;
> (2) аудит дизайн-пайплайнов `visual stack` (15 схем) → **UT2026-G**: рескоупы #074-F2/#077/#061,
> новые #078–#082, #011/#012 SUPERSEDED. Закрыто в UT-блоке: #069, #070, #072, #073 ✅;
> #071/#075 PARTIAL.

**Очередь исполнения (UT2026-G, согласована с дизайн-стеком):**

| Очередь | Тикет | Статус |
|---|---|---|
| 1 | ~~F1 #067~~ | ✅ DONE `931d42a` (WidgetHost 947→230-, Shell/Actions/Registry, R0_6) |
| 2 | **F2** #074 Table V2 по `specs/TABLE_V2_CANON.md` — F2.1 ✅ `c507954`, F2.2+F2.3 ✅ `e105aef`; **осталось F2.4 (меню колонок/resize/[+] property) + F2.5 (группировка + sub-base вкладка)** | IN PROGRESS |
| 3 | ~~F3 миграция + L1~~ | ✅ DONE `e105aef` — **#068 закрыт**, 0 импортов из archive (R0_4), генераторы только V2 |
| 4 | **#077** единый FormulaConstructor (5 точек входа) + filter-pills | P1, DESIGN READY (anatomy-схема) |
| 5 | **#061** Template Library: 4 канвас-пресета (visual stack) + 3 профиля (Vision §7) | рескоуплен |
| 6 | #081 RelationPickerPopover; #082 typed-карточка записи | новые (дизайн-стек) |
| 7 | #078 CalendarView decomposition (2328 LOC); #079 hex-ratchet (32 вхождения) | новые (аудит) |
| 8 | #075-остаток, #076 (дизайн-сессия UT2026-E), #060, #036 | прежний план |
| — | Решения пользователя: #066 (YAML-конфиг), #080 (Formula Node widget), #071 (репро консоли) | ГЕЙТЫ |
| V3 | #062–#064, free canvas, SmartSuggest-аналитика | DEFERRED |

## Ключевые решения (зафиксированные)

| Решение | Документ | Статус |
|---|---|---|
| V2 widget fate table (data-table → database-call, timeline/comparison → archive) | DASHBOARD_V2_SPEC.md §4 | СОГЛАСОВАНО |
| M-UI-MODERNIZATION выравнен с V2 spec (не rebuild того, что удаляется) | UI_MODERNIZATION_PLAN.md | 2026-06-10 |
| SelectionState.values[] + is-any-of (Phase 4.5) | canvasSelectionStore.ts | DONE |
| Selection Bus API контракт заморожен (не меняется в UI-M) | CROSS_WIDGET_SPEC.md | ИНВАРИАНТ |
| #048: `NativeQueryDataSource` — аддитивный kind в v3/v4 settings union, без миграции; queryOne = полный re-query | BACKLOG #048 | 2026-06-11 |
| #059: relation-CTA добавляет `database-call`, не legacy `sub-base-canvas`; accept персистит dismissal | BACKLOG #059, smartSuggest.ts | 2026-06-11 |
| `DatabaseViewConfig.dismissedSuggestions?: string[]` — аддитивное поле, persisted opt-out подсказок | types.ts | 2026-06-11 |
| Jest gotcha: TS barrel re-export `.svelte` default ломает esbuild-jest — импортировать `.svelte` напрямую | session-state | ПРАВИЛО |

## Запреты

- ❌ Прямые коммиты/пуши в `main`.
- ❌ Не повышать PX-budget.
- ❌ Не добавлять `@ts-ignore` в `src/`.
- ❌ `filterEvaluator.ts` — только потребление, не модифицировать параллельными реализациями.
- ❌ Не rebuild виджетов, которые V2 spec отправляет в archive (timeline, comparison, summary-row, yaml-visualizer, view-port, data-list).
