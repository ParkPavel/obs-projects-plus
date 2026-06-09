# Текущий контекст — для агентов

> Обновлено: **2026-06-09 (Dashboard V2 новый цикл разработки)**
> Предыдущий снимок: `docs/internal/archive/` (исторические документы V1-цикла)

## Состояние main

- HEAD: **`f23efdb`** — `feat(agents): harden 4-gate verification cycle`
- `origin/main` = `main` (синхронизирован).
- Active branch: `feat/dashboard-v2` — новый цикл разработки Dashboard V2.
- Archive branch: `archive/dashboard-v1` — снимок V1 на момент запуска V2.
- Working tree: clean.
- Plugin version: `3.5.1-alpha`.

## Гейты (baseline on main @ f23efdb)

| Гейт | Результат |
|---|---|
| `npm run build` | OK ✅ |
| `npm test` | **139 suites / 2099 tests PASS** ✅ |
| `npx tsc --noEmit` | 0 errors ✅ |
| `npm run lint` | 🔴 55 errors (issue #049) |
| `npm run svelte-check` | 🔴 72 errors in 26 files (issue #049) |
| `@ts-ignore` в src | 0 ✅ |
| PX-budget (`R0_3_pxBudget.test.ts`) | ≤186, locked ✅ |

## Активная работа

### Dashboard V2 (`feat/dashboard-v2`)

Полный перезапуск Dashboard. Документы:
- `docs/internal/DASHBOARD_V2_SPEC.md` — спецификация (rev.3, согласована)
- `docs/internal/DASHBOARD_V2_VISION.md` — пользовательское видение (источник правды для UX)

**Следующий шаг**: Фаза 0 — исправить #049 (55 ESLint + 72 svelte-check ошибки) на `feat/dashboard-v2`.

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

## Открытые тикеты

| Тикет | Приоритет | Статус |
|---|---|---|
| **#049** | P0 | 🔴 BACKLOG — исправить lint + svelte-check (Фаза 0 Dashboard V2) |
| **#048** | P1 | 📋 BACKLOG — UI точка входа native-query в CreateProject.svelte |
| **#013** | P2 | 📋 BACKLOG — декомпозиция DashboardCanvas (заменяется V2) |

## Запреты

- ❌ Прямые коммиты/пуши в `main`.
- ❌ Не повышать PX-budget.
- ❌ Не добавлять `@ts-ignore` в `src/`.
- ❌ `filterEvaluator.ts` — только потребление, не модифицировать.

