# Текущий контекст — для агентов

> Обновлено: **2026-06-10 (Phase 4 complete — DatabaseCallWidget + Selection Bus + Board/Calendar/Gallery tabs)**

## Состояние веток

- HEAD `main`: **`f23efdb`** — `feat(agents): harden 4-gate verification cycle`
- HEAD `feat/dashboard-v2`: **`902302b`** — `feat(dashboard): Phase 4 — DatabaseCallWidget + Canvas Selection Bus + Board/Calendar/Gallery tabs`
- Active branch: `feat/dashboard-v2` — новый цикл разработки Dashboard V2.
- Archive branch: `archive/dashboard-v1` — снимок V1 на момент запуска V2.
- Working tree: clean.
- Plugin version: `3.5.1-alpha`.

## Гейты (feat/dashboard-v2 @ 902302b)

| Гейт | Результат |
|---|---|
| `npm run build` | ✅ 0 errors |
| `npm test` | ✅ **134 suites / 2020 tests PASS** |
| `npm run lint` | ✅ 0 errors |
| `npm run svelte-check` | ✅ 0 errors |
| `@ts-ignore` в src | 0 ✅ |
| PX-budget (`R0_3_pxBudget.test.ts`) | ≤186, locked ✅ |

> Baseline обновлён: +6 тестов (dataProviderRegistration.test.ts Phase 4).

## Активная работа

### Dashboard V2 (`feat/dashboard-v2`)

Полный перезапуск Dashboard. Документы:
- `docs/internal/DASHBOARD_V2_SPEC.md` — спецификация (rev.3, согласована)
- `docs/internal/DASHBOARD_V2_VISION.md` — пользовательское видение (источник правды для UX)

**✅ Фаза 0 ЗАВЕРШЕНА** — все 4 CI ворот зелёные на `feat/dashboard-v2`.  
**✅ Фаза 1 ЗАВЕРШЕНА** — Engine перенесён в `src/lib/dashboard-engine/`.  
**✅ Фаза 2 ЗАВЕРШЕНА** — `FilterPanel.svelte` — единый компонент фильтрации.  
**✅ Фаза 3 ЗАВЕРШЕНА** — `DashboardCanvas.svelte` = 200 LOC, FreeCanvas удалён.  
**✅ Фаза 4 ЗАВЕРШЕНА** — DatabaseCallBlock (Board/Calendar/Gallery вкладки), Canvas Selection Bus, LinkedSelection настройки.  
**Следующий шаг**: Фаза 4.5 — Multi-select (`is-any-of` оператор + Selection Bus), затем Фаза 5 — Utility виджеты.

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
| **#049 Phase 0 — CI baseline fix** | ✅ DONE (feat/dashboard-v2) |
| **Dashboard V2 Phase 1 — Engine move** | ✅ DONE (feat/dashboard-v2) |
| **Dashboard V2 Phase 2 — Unified Filter** | ✅ DONE (feat/dashboard-v2) |
| **Dashboard V2 Phase 3 — Canvas decompose** | ✅ DONE (feat/dashboard-v2) |
| **Dashboard V2 Phase 4 — DatabaseCallWidget + Selection Bus** | ✅ DONE (feat/dashboard-v2) |

## Открытые тикеты

| Тикет | Приоритет | Статус |
|---|---|---|
| **Dashboard V2 Phase 4.5** | P1 | 📋 NEXT — Multi-select: `is-any-of` фильтр-оператор + Selection Bus multi-value |
| **Dashboard V2 Phase 5** | P1 | 📋 BACKLOG — Utility виджеты: Chart, Stats, FilterTabs, Checklist, Text, Divider |
| **#048** | P2 | 📋 BACKLOG — UI точка входа native-query в CreateProject.svelte |

## Запреты

- ❌ Прямые коммиты/пуши в `main`.
- ❌ Не повышать PX-budget.
- ❌ Не добавлять `@ts-ignore` в `src/`.
- ❌ `filterEvaluator.ts` — только потребление, не модифицировать.

