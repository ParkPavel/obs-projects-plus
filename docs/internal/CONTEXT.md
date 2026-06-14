# Текущий контекст — для агентов

> Обновлено: **2026-06-14 (#101 EditNote live-modal закрыт, READY FOR PR — `c1becb4`; baseline ratchet 152 suites / 2203 tests +1 suite `editNoteMerge.test.ts` +8 tests; next open: #096.4 dayjs-reconcile P3)**

## Состояние веток

- HEAD `main`: **`f23efdb`** — `feat(agents): harden 4-gate verification cycle`
- HEAD `feat/dashboard-v2`: **`c1becb4`** — `fix(modals): #101 — EditNote live modal reacts to external record changes`
- Active branch: `feat/dashboard-v2` — **35 коммитов впереди origin** (push контролирует пользователь). НЕ запушено.
- Archive branch: `archive/dashboard-v1` — снимок V1 на момент запуска V2.
- Working tree: clean.
- Plugin version: `3.5.1-alpha`.

## Гейты (feat/dashboard-v2 @ c1becb4)

| Гейт | Результат |
|---|---|
| `npm run build` | ✅ 0 errors (3 pre-existing unrelated warnings) |
| `npm test` | ✅ **152 suites / 2203 tests PASS** |
| `npm run lint` | ✅ 0 errors (130 pre-existing tsdoc warnings) |
| `npm run svelte-check` | ✅ 0 errors / 0 warnings |
| `@ts-ignore` в src | 0 ✅ |
| PX-budget (`R0_3_pxBudget.test.ts`) | ≤186, locked ✅ |
| Manual API-тест в OBStests (`MANUAL_TESTING_PIPELINE.md`) | ✅ 2026-06-11: deploy + reload + 11 команд + demo smoke A1–A7 + roundtrip. Визуальный чек-лист (#059/#065/#048 strip/zero-state/темы) — ожидает человека, см. pipeline §5 |

> **Канон baseline = 152 / 2203** (этот файл, «Гейты»). Ratchet 2026-06-14:
> +1 suite `editNoteMerge.test.ts` + 8 тестов из #101 (чистый `mergeExternal` helper).
> Было 151 / 2195 (#102: +3 state-machine теста, `reconcile()` симметричный декремент
> `pendingWrites`). Перед этим 151 / 2192 (#096: +1 suite `axisLabels.test.ts` + тесты в
> `transformExecutor.test.ts`, `chartDataPipeline.test.ts`, `configPanelRoundTrip.test.ts`).
> `CLAUDE.md` синхронизирован → **152 / 2203** (2026-06-14). CONTEXT.md —
> единственный канонический источник числа (так гласит сам CLAUDE.md).

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
**✅ NOTION_GRADE_PIPELINE — волны W1/W2** (2026-06-12 → 2026-06-13): глобальный рефакторинг интерфейса в 5 волн (`specs/NOTION_GRADE_PIPELINE.md`). W1 закрыта (`a640180`): #067 F1 (WidgetHost 947→Shell/Actions/Registry, `931d42a`), #074 Table V2 F2.1–F2.5 + #068 F3-миграция (`c507954`, `e105aef`), #088 column-header menu/resize/add-property, #081 RelationPickerPopover. Аудиты UT-R2/UT-R3 (`b0c82cf`, `4ca84a8`), #097 чеклист-debug удалён (`d2ec20e`).  
**✅ EPIC #099 ЗАКРЫТ ЦЕЛИКОМ** (2026-06-13, W2-ядро): Notion-расщепление конвейера трансформаций. #099.1 filter pills bar + #099.2 live-apply pipeline editor (`2db4124`), #099 disable-step — non-destructive skip для шагов с 0 записей (`97b7079`), #099.3 unnest как свойство блока database-call «Развернуть список» (`2209a8a`). Поглощает #092, #095. Audit READY FOR PR, все гейты зелёные. НЕ слит/запушен — гейт пользователя.  
**✅ Сессия 2026-06-13 (W2-продолжение, 5 коммитов)**: #100 Reactivity hardening (P1) закрыт — pure optimistic-echo guard (`dashboardConfigEcho.ts`), wire в DashboardCanvas, config-panel round-trip harness + #071 regression, fix replayed-stale-prop; закрывает класс багов #071, follow-up #102 заведён (`cf87da6`/`b4bd4ea`/`65165ad`/`a4019ed`). #098 FloatingPopup edge-collision (P2) закрыт — viewport width-clamp + resize/scroll reposition (`7fe7756`). Оба READY FOR PR, все 4 гейта зелёные. НЕ слиты/запушены — гейт пользователя.
**✅ Сессия 2026-06-14 (W2, 3 коммита)**: #096 Charts axis management (P2) закрыт целиком — три среза: #096.1 (`b2947c1`) engine date-bucketing в chart pipeline (buildChartPipeline optional `fields`, auto-month для Date X, explicit `dateGranularity` override; computeChartData читает derived `${field}_${gran}`); #096.2 (`7e4e4d7`) новый pure helper `axisLabels.ts` (density-based skip/rotate/truncate/padding) + `axisLabels.test.ts`, LineChart убрал `/8` magic skip, BarChart получил skip+rotate; #096.3 (`e23abbc`) granularity `<select>` в ChartConfig.svelte gated на DataFieldType.Date + i18n en/ru/uk/zh-CN + round-trip тесты. READY FOR PR, все 4 гейта зелёные. #096.4 (dayjs-vs-raw-Date в truncateDate) остаётся открыт P3 (DEFERRED). НЕ слит/запушен — гейт пользователя.
**✅ Сессия 2026-06-14 (W2, #102)**: #102 config-echo guard rapid double-commit edge (P2, follow-up #100) закрыт — `reconcile()` в `dashboardConfigEcho.ts` декрементит `pendingWrites` симметрично с `commit()` (был абсолютный сброс к 0) + clear-pending при `eq(cfg, current)`; фиксит lost-update edge при двух commit подряд в одном microtask-окне с interleaved echo; +3 state-machine теста. READY FOR PR (`57ae744`), все 4 гейта зелёные. НЕ слит/запушен — гейт пользователя.
**✅ Сессия 2026-06-14 (W2, #101)**: #101 EditNote — живая модалка (P2) закрыт. Architect-signed план (`fcc5a69`), реализация тремя срезами в одном коммите (`c1becb4`): #101.1 чистый `mergeExternal(local, store, dirty)` helper в `editNoteMerge.ts` (untouched-ключи из store, dirty-ключи из local, id из store) + 8 unit-тестов; #101.2 dirty `Set<string>` заполняется в `setValue`, чистится на обоих save-success путях (autosave + handleManualSave); #101.3 `$dataFrame` auto-subscribe + live-lookup по захваченному `recordId` (фикс Svelte cyclical-dep `record→live→record`) + реактивная склейка. Без `metadataCache.on` (инвариант единственного источника), без ручного unsubscribe (`$store` auto-teardown), реактивная склейка пишет только `record`, не вызывает `onSave`. +1 suite `editNoteMerge.test.ts` (+8 тестов). READY FOR PR (`c1becb4`), все 4 гейта зелёные. НЕ слит/запушен — гейт пользователя. Auto-close при удалении записи извне — явный out-of-scope follow-up.
**Следующий шаг**: W2 — **#096.4** dayjs-reconcile (P3, DEFERRED), #098-deferred (vertical-overflow gap, при необходимости).

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
| **#067 F1 — WidgetHost decomposition (Shell/Actions/Registry)** | ✅ CLOSED (2026-06-12, `931d42a`) |
| **#074 F2 — Table V2 (F2.1–F2.5) + #068 F3-миграция + #088 column ops** | ✅ CLOSED (W1, `c507954`/`e105aef`/`a640180`) |
| **#097 — debug-строка чеклиста удалена** | ✅ CLOSED (2026-06-12, `d2ec20e`) |
| **EPIC #099 — Notion pipeline split** | ✅ CLOSED (2026-06-13) — filter pills bar, live-apply pipeline editor, disable-step (non-destructive), unnest как свойство блока DatabaseCall. Поглощает #092, #095. (`2db4124`/`97b7079`/`2209a8a`) |
| **#100 — Reactivity hardening (панельный round-trip)** | ✅ DONE (2026-06-13, READY FOR PR) — optimistic-echo guard `dashboardConfigEcho.ts` + wire + round-trip harness + #071 regression. Закрывает класс багов #071. Follow-up #102. (`cf87da6`/`b4bd4ea`/`65165ad`/`a4019ed`) |
| **#098 — FloatingPopup edge-collision** | ✅ DONE (2026-06-13, READY FOR PR) — viewport width-clamp + resize/scroll reposition. Deferred P3: scroll-throttle, max-height vertical cap. (`7fe7756`) |
| **#096 — Charts axis management** | ✅ DONE (2026-06-14, READY FOR PR) — date-bucketing engine wiring + density-based `axisLabels.ts` + granularity config UI. 3 среза. Deferred P3: #096.4 dayjs-vs-raw-Date reconcile. (`b2947c1`/`7e4e4d7`/`e23abbc`) |
| **#102 — config-echo guard rapid double-commit edge** | ✅ DONE (2026-06-14, READY FOR PR) — `reconcile()` теперь декрементит `pendingWrites` симметрично с `commit()` (был абсолютный сброс) — фиксит lost-update edge при rapid double-commit; +3 state-machine теста. Follow-up #100. (`57ae744`) |
| **#101 — EditNote живая модалка** | ✅ DONE (2026-06-14, READY FOR PR) — три среза одним коммитом: чистый `mergeExternal` helper (#101.1) + dirty `Set<string>` (#101.2) + `$dataFrame` auto-subscribe + реактивная склейка с фиксом cyclical-dep (#101.3); +1 suite `editNoteMerge.test.ts` (+8). Auto-close при внешнем удалении записи — out-of-scope follow-up. (`c1becb4`) |

## Открытые тикеты

> План скорректирован 2026-06-11 дважды: (1) UT-блок M-UT-FIXES #068–#077 + спеки UT2026-A..F;
> (2) аудит дизайн-пайплайнов `visual stack` (15 схем) → **UT2026-G**: рескоупы #074-F2/#077/#061,
> новые #078–#082, #011/#012 SUPERSEDED. Закрыто в UT-блоке: #069, #070, #072, #073 ✅;
> #071/#075 PARTIAL.

> ⚠ 2026-06-12: очередь пересобрана в **ВОЛНЫ** глобального дизайн-пайплайна —
> канон: `specs/NOTION_GRADE_PIPELINE.md` (грамматика 5 примитивов, анатомия панелей,
> инвентарь поверхностей, W1–W5). Таблица ниже — историческая, актуален пайплайн.

> ⚠ 2026-06-13: W1 закрыта (`a640180`), EPIC #099 (W2-ядро) закрыт целиком (`2209a8a`).
> #100 (P1 reactivity-hardening) и #098 (P2 FloatingPopup) закрыты (`a4019ed`/`7fe7756`),
> READY FOR PR.
> ⚠ 2026-06-14: #096 (P2, charts axis) закрыт целиком тремя срезами (`b2947c1`/`7e4e4d7`/`e23abbc`),
> READY FOR PR. #096.4 (dayjs-reconcile) остаётся открыт P3.
> ⚠ 2026-06-14: #102 (P2, config-echo guard rapid double-commit edge) закрыт (`57ae744`), READY FOR PR.
> ⚠ 2026-06-14: #101 (P2, EditNote live-modal) закрыт (`c1becb4`), READY FOR PR — стекается на
> `feat/dashboard-v2` рядом с #102 и #096. Следующий открытый тикет — **#096.4** (P3, dayjs-reconcile, DEFERRED).

**Очередь исполнения (W2 → далее):**

| Очередь | Тикет | Статус |
|---|---|---|
| — | ~~F1 #067~~ | ✅ DONE `931d42a` (WidgetHost 947→Shell/Actions/Registry, R0_6) |
| — | ~~F2 #074 Table V2 (F2.1–F2.5)~~ | ✅ DONE `c507954`/`e105aef`/`a640180` (W1) |
| — | ~~F3 миграция + #068~~ | ✅ DONE `e105aef` — 0 импортов из archive (R0_4), генераторы только V2 |
| — | ~~#088 column-header menu/resize/add-property; #081 RelationPickerPopover~~ | ✅ DONE (W1) |
| — | ~~#097 debug-строка чеклиста~~ | ✅ DONE `d2ec20e` |
| — | ~~EPIC #099 pipeline split (#099.1/.2/.3 + disable-step), поглотил #092/#095~~ | ✅ CLOSED `2db4124`/`97b7079`/`2209a8a` (2026-06-13) |
| — | ~~#100 Reactivity hardening — панельный round-trip (закрывает класс «#071 select не применяется»)~~ | ✅ DONE `cf87da6`/`b4bd4ea`/`65165ad`/`a4019ed` (2026-06-13, READY FOR PR) |
| — | ~~#098 FloatingPopup — коллизия с краем окна~~ | ✅ DONE `7fe7756` (2026-06-13, READY FOR PR) |
| — | ~~#096 чарты — менеджмент осей (auto-skip/rotate дат, date-bucketing)~~ | ✅ DONE `b2947c1`/`7e4e4d7`/`e23abbc` (2026-06-14, READY FOR PR; #096.4 → P3) |
| — | ~~#102 config-echo guard — rapid double-commit edge (follow-up #100)~~ | ✅ DONE `57ae744` (2026-06-14, READY FOR PR) |
| — | ~~#101 EditNote — живая модалка (подписка на обновления записи)~~ | ✅ DONE `c1becb4` (2026-06-14, READY FOR PR) |
| **1** | **#096.4 чарты — reconcile dayjs vs raw Date в truncateDate** | **P3, DEFERRED — NEXT** |
| 5 | **#077** единый FormulaConstructor (5 точек входа); **#061** Template Library; #082 typed-карточка записи | прежний план |
| 6 | #078 CalendarView decomposition (2328 LOC); #079 hex-ratchet | аудит |
| 7 | #075-остаток, #076, #060, #036 | прежний план |
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
