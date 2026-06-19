# Текущий контекст — для агентов

> Обновлено: **2026-06-19 (ЭПИК #093 SettingsMenu рециклинг ✅ DONE — стек 6 коммитов на `feat/093-settingsmenu-recycling`, готов к merge/push; НОВЫЙ baseline 158/2246; px-budget 177. Слайсы: 1 i18n ViewConfigTab, 2 verified-clean, 3 field-пикер affordance, 4 §3-аккордеоны+regression-fix, 4b rollout пикера на board/gallery/table. Ранее 2026-06-18: ЭПИК #103 Filter UX unification + UT-R5 audit (origin/main `590ae06`). Следующий шаг = W2.2 эпик #090 панели виджетов §3)**

## Состояние веток

- HEAD `main`: **`590ae06`** (`Bump beta version [skip ci]` — CI поверх стека #103)
  — **HEAD == origin/main == `590ae06`**, всё синхронизировано, ничего не ждёт push-гейта.
- Стек #103 (3 коммита) слит и запушен: `6e6930e` docs (UT-R5 audit+roadmap), `7e0ac3a` feat(#103) filter unification, `28d24a9` fix(i18n) templates-dedup. Ребейзнут поверх CI-бампов `1b399f3`/`590ae06`.
- Эпик #077 (FormulaConstructor unification) отгружен ранее (`7cc3d66`).
- Archive branch: `archive/dashboard-v1` — снимок V1 на момент запуска V2.
- Working tree: `main.js` + `styles.css` модифицированы (build-артефакты, не трекаются для docs-коммита). Свежий билд задеплоен в OBStests 2026-06-18 22:59.
- Plugin version: `3.5.1-alpha`.

## Гейты (стек #093 @ `feat/093`, поверх `590ae06`)

| Гейт | Результат |
|---|---|
| `npm run build` | ✅ 0 errors (1 pre-existing A11y warning) |
| `npm test` | ✅ **158 suites / 2246 tests PASS** |
| `npm run lint` | ✅ 0 errors (130 pre-existing tsdoc warnings) |
| `npm run svelte-check` | ✅ 0 errors / 0 warnings |
| `@ts-ignore` в src | 0 ✅ |
| PX-budget (`R0_3_pxBudget.test.ts`) | **≤177**, locked ✅ |
| Manual API-тест в OBStests (`MANUAL_TESTING_PIPELINE.md`) | ✅ 2026-06-11 baseline; свежий #103-билд задеплоен 2026-06-18, ждёт `app:reload` + визуальную проверку фильтров |

> **Канон baseline = 158 / 2246** (этот файл, «Гейты»). Ratchet 2026-06-19 (#093):
> рост 156/2237 → 158/2246 (+2 suites / +9 tests) — `fieldComboInput.test.ts` (+5),
> `settingsSection.test.ts` (+4). Не регрессия. Предыдущий ratchet 2026-06-18 (#103):
> 155/2232 → 156/2237 (`filterBridge.test.ts`).
> PX-budget ≤ **177** (`R0_3_pxBudget.test.ts`, `PX_BUDGET=177`), отжат в #077 slice 4.
> Предыстория: 155 / 2232 (2026-06-18, #077 +3 suites); 152 / 2205 (#096.4); 152 / 2203 (#101);
> 151 / 2195 (#102); 151 / 2192 (#096).
> `CLAUDE.md` синхронизирован → **158 / 2246** (2026-06-19). CONTEXT.md —
> единственный канонический источник числа (так гласит сам CLAUDE.md).

## Активная работа

### Dashboard V2 (`feat/dashboard-v2`)

Полный перезапуск Dashboard. Документы:
- `docs/internal/DASHBOARD_V2_SPEC.md` — спецификация (rev.3, согласована)
- `docs/internal/DASHBOARD_V2_VISION.md` — пользовательское видение (источник правды для UX)
- `docs/internal/UI_MODERNIZATION_PLAN.md` — M-UI-MODERNIZATION (V2-aligned, 2026-06-10)
- `docs/internal/UI_DESIGN_ARCHITECTURE.md` — Notion-parity mapping + полная архитектурная схема (2026-06-10)
- `docs/internal/AUDIT_ROADMAP_2026-06-18.md` — **глобальный аудит UT-R5 + скорректированная дорожная карта W2–W5** (канон последовательности, декомпозиция всех проблем, процессные гейты)

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
**✅ Сессия 2026-06-14 (W2, #101)**: #101 EditNote — живая модалка (P2) закрыт. Architect-signed план (`fcc5a69`), реализация тремя срезами в одном коммите (`c1becb4`): #101.1 чистый `mergeExternal(local, store, dirty)` helper в `editNoteMerge.ts` (untouched-ключи из store, dirty-ключи из local, id из store) + 8 unit-тестов; #101.2 dirty `Set<string>` заполняется в `setValue`, чистится на обоих save-success путях (autosave + handleManualSave); #101.3 `$dataFrame` auto-subscribe + live-lookup по захваченному `recordId` (фикс Svelte cyclical-dep `record→live→record`) + реактивная склейка. Без `metadataCache.on` (инвариант единственного источника), без ручного unsubscribe (`$store` auto-teardown), реактивная склейка пишет только `record`, не вызывает `onSave`. +1 suite `editNoteMerge.test.ts` (+8 тестов). READY FOR PR (`c1becb4`), все 4 гейта зелёные. Auto-close при удалении записи извне — явный out-of-scope follow-up.
**✅ V2-стек СЛИТ в main** (`1677310` — `Merge feat/dashboard-v2: close #099 epic + #100/#098/#096/#102/#101`): волна W2 (минус #096.4) свёрнута в main, origin/main продвинут. `feat/dashboard-v2` остаётся живой веткой для добивки follow-up-ов поверх merge.
**✅ Сессия 2026-06-15 (W2, #096.4)**: #096.4 truncateDate dayjs-reconcile (P3, был DEFERRED) закрыт. `transformExecutor.ts` truncateDate string-fallback заменён с `new Date(String(dateVal))` на `dayjs(String(dateVal)).toDate()` — унификация на канонический dayjs date-слой (`src/lib/helpers/dateFormatting.ts`), фиксит off-by-one date-bucket drift в negative-offset таймзонах. Fast-path `instanceof Date` сохранён, `isNaN` invalid-guard сохранён. +2 TZ-boundary regression-теста в `transformExecutor.test.ts`. Architect DEFER-опасение проверено semantic-analyzer и НЕ подтвердилось. (`065331e`)
**✅ ЭПИК #077 ЗАКРЫТ ЦЕЛИКОМ** (2026-06-18, отгружен в origin/main `7cc3d66`): «машина функций» — единый FormulaConstructor во всех точках ввода формул. Слайсы: slice 1 (`08398a2`/`a78fe9c`) — formula syntax-highlight overlay + metadata-driven FormulaHelpPanel; slice 2 (`dd90c92`) — composition-wrapper FormulaConstructorFull (toolbar + lean FC + preview-slot + help-panel) + ретайр hand-rolled chrome в AdvancedFilterEditor; slice 4 (`5cbb97f`) — ретайр imperative-портала DateFormulaInput → thin FC-wrapper, px-budget 186→177; финальный XS (`7cc3d66`) — i18n-ключ `views.dashboard.canvas.formula-builder` → «Формулы» (ru) / «Formulas» (en) / «Формули» (uk) / «公式» (zh-CN) + defaultValue-fallback в DashboardToolbar.svelte / YamlVisualizer.svelte (user-decision: «Формулы»). slice 3 (FormulaBar) НАМЕРЕННО отложен архитектором (FormulaBar уже корректен, миграция косметическая). **Архитектурное решение**: lean FormulaConstructor НЕ поглощает все 4 слоя дизайна — добавлен composition-wrapper FormulaConstructorFull; параллельная реализация DateFormulaInput (свой портал/клавиатура/preview/suggestion-движок) полностью ретайрнута — третьего пути ввода формул нет. Все 4 гейта зелёные на merge (build 0, jest 155/2232, lint 0, svelte-check 0). НОВЫЙ baseline 155/2232 (+3 suites: FilterPills, FormulaConstructor, formulaHelpGroups — не регрессия).
**Следующий шаг**: 🔥 **W2.2 эпик #090 — панели настроек виджетов (анатомия §3)** (P1, L, design_required; зависит от #093 ✅). Единая анатомия §3 на все конфиг-панели виджетов: секции-аккордеоны, человеческие подписи с примерами (D1), значения у слайдеров, прогрессивное раскрытие. Переиспользовать `SettingsSection.svelte` + `FieldComboInput.svelte` из #093. ~~W2.1 #093 SettingsMenu рециклинг~~ ✅ DONE (стек `feat/093`, 6 коммитов): i18n ViewConfigTab, field-пикеры с affordance (иконки типов+caret+«новое поле») везде, §3-аккордеоны на calendar, заголовок переведён. Остаток D1-подписей примерами — опционально. ~~W2.0 #103 Filter UX unification~~ ✅ DONE (`590ae06`). Скорректированная дорожная карта на все волны W2–W5 (чёткая последовательность + зависимости + DoD связности + процессные гейты) — **`docs/internal/AUDIT_ROADMAP_2026-06-18.md`** (канон). Последовательность: W2.0 #103 → W2.1 #093 → W2.2 #090 → W2.3 (#071/#089/#094/#095) → W2.4 (#075-rem/#092) → W3 (#091/#076) → W4 (#061/#082/#060) → W5 (#078/#079/#036). Продуктовые решения 2026-06-15: #080 ❌ CLOSED/DECLINED (→#077), #066 ✅ RESOLVED (defer-to-V3). Примечание: ранний вывод аудита «тест на stale build» ОШИБОЧЕН (невалидный grep кириллицы) — реальная причина сырого ключа шаблона = дубликат ключа `views.dashboard.templates` в en/ru, исправлен в #103-стеке; deploy-гейт оставлен как общая гигиена (AUDIT_ROADMAP §4А).

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
| **V2-стек → main** | ✅ MERGED (`1677310`) — `Merge feat/dashboard-v2`: свернул #099/#100/#098/#096/#102/#101; origin/main продвинут. feat/dashboard-v2 продолжается для follow-up-ов поверх merge. |
| **#096.4 — truncateDate dayjs-reconcile** | ✅ DONE (2026-06-15, READY FOR PR) — string-fallback `new Date(String())` → `dayjs(String()).toDate()`, унификация на канонический dayjs-слой; фиксит off-by-one bucket-drift в negative-offset TZ. instanceof Date / isNaN guards сохранены. +2 TZ-boundary теста. DEFER-опасение регрессии опровергнуто semantic-analyzer (6 assertion'ов boundary-safe). Стекается поверх `1677310`. (`065331e`) |
| **EPIC #077 — FormulaConstructor unification + filter-pills** | ✅ COMPLETED (2026-06-18, в origin/main `7cc3d66`) — единый FormulaConstructor во всех точках ввода формул. slice 1 syntax-highlight overlay + metadata FormulaHelpPanel (`08398a2`/`a78fe9c`), slice 2 composition-wrapper FormulaConstructorFull + ретайр AFE chrome (`dd90c92`), slice 4 ретайр DateFormulaInput portal → thin FC-wrapper, px-budget 186→177 (`5cbb97f`), финал i18n «Формулы»/Formulas/Формули/公式 (`7cc3d66`). slice 3 (FormulaBar) намеренно отложен. DateFormulaInput-параллель полностью ретайрнута. Baseline 152/2205 → 155/2232. |

## Открытые тикеты

> План скорректирован 2026-06-11 дважды: (1) UT-блок M-UT-FIXES #068–#077 + спеки UT2026-A..F;
> (2) аудит дизайн-пайплайнов `visual stack` (15 схем) → **UT2026-G**: рескоупы #074-F2/#077/#061,
> новые #078–#082, #011/#012 SUPERSEDED. Закрыто в UT-блоке: #069, #070, #072, #073 ✅;
> #071/#075 PARTIAL.

> ⚠ 2026-06-12: очередь пересобрана в **ВОЛНЫ** глобального дизайн-пайплайна —
> `specs/NOTION_GRADE_PIPELINE.md` (грамматика 5 примитивов, анатомия панелей, W1–W5).
> ⚠ 2026-06-18: **канон последовательности волн W2–W5 теперь — `AUDIT_ROADMAP_2026-06-18.md`**
> (он корректирует и пересеквенирует NOTION_GRADE_PIPELINE по итогам UT-R5). Таблица ниже
> отражает скорректированную очередь.

> ⚠ 2026-06-13: W1 закрыта (`a640180`), EPIC #099 (W2-ядро) закрыт целиком (`2209a8a`).
> #100 (P1 reactivity-hardening) и #098 (P2 FloatingPopup) закрыты (`a4019ed`/`7fe7756`),
> READY FOR PR.
> ⚠ 2026-06-14: #096 (P2, charts axis) закрыт целиком тремя срезами (`b2947c1`/`7e4e4d7`/`e23abbc`),
> READY FOR PR. #096.4 (dayjs-reconcile) остаётся открыт P3.
> ⚠ 2026-06-14: #102 (P2, config-echo guard rapid double-commit edge) закрыт (`57ae744`), READY FOR PR.
> ⚠ 2026-06-14: #101 (P2, EditNote live-modal) закрыт (`c1becb4`), READY FOR PR.
> ⚠ 2026-06-15: V2-стек СЛИТ в main (`1677310`, свернул #099/#100/#098/#096/#102/#101).
> #096.4 (P3, truncateDate dayjs-reconcile) закрыт (`065331e`), READY FOR PR — стекается на
> `feat/dashboard-v2` поверх merge.
> ⚠ 2026-06-18: ЭПИК #077 (P1, FormulaConstructor unification) ✅ COMPLETED, отгружен в
> origin/main (`7cc3d66`). HEAD == origin/main. Baseline 155/2232, px-budget 177.
> ⚠ 2026-06-18: ГЛОБАЛЬНЫЙ АУДИТ UT-R5 → `AUDIT_ROADMAP_2026-06-18.md`. Очередь НЕ исчерпана:
> вскрыт emergent-долг **#103 Filter UX unification** (= СЛЕДУЮЩИЙ, W2.0) + пересеквенированы
> W2–W5. Прежняя пометка «queue исчерпана» снята — она относилась к старой автономной очереди
> до аудита.

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
| — | ~~#096.4 чарты — reconcile dayjs vs raw Date в truncateDate~~ | ✅ DONE `065331e` (2026-06-15, READY FOR PR) |
| — | ~~EPIC #077 FormulaConstructor unification + filter-pills~~ | ✅ COMPLETED `7cc3d66` (2026-06-18, в origin/main) |
| — | ~~**#103 Filter UX unification**~~ | ✅ DONE `590ae06` (2026-06-18, в origin/main; +i18n templates-dedup fix) |
| — | ~~**#093** SettingsMenu рециклинг~~ | ✅ DONE (стек `feat/093`, 6 коммитов; i18n+field-пикеры+§3-аккордеоны; baseline→158/2246) |
| **W2.2** | **#090** панели виджетов (анатомия §3) | 🔥 **СЛЕДУЮЩИЙ** (P1 design; зависит от #093 ✅; переиспользовать SettingsSection/FieldComboInput) |
| W2.3 | #071 cover-реактивность; #089 галерея cover; #094 словарь значений; #095 operator-select | P1/P2, поверх #090/#093 |
| W2.4 | #075-остаток + #092 ясность/recovery конвейера | P1, DoD W2 |
| W3 | **#091** Link-флоу связей; #076 sub-base входы (формулы #077 ✅) | P1/P2, DoD W3 |
| W4 | #061 Template Library; #082 typed-карточка; #060 field transparency; SmartSuggest-discovery | P2, DoD W4 |
| W5 | #078 CalendarView decomp; #079 hex-ratchet; #036 mobile | P2 фундамент |
| — | Канон последовательности/зависимостей/DoD → `AUDIT_ROADMAP_2026-06-18.md` | — |
| — | Решения пользователя: ~~#066 (YAML-конфиг P2)~~ ✅ RESOLVED Option B defer-to-V3, ~~#080 (Formula Node widget P3)~~ ❌ CLOSED/DECLINED Option B (→#077); остаётся #071 (репро консоли P1) | ГЕЙТЫ |
| V3 | #062–#064 (P3), #035 parked, free canvas, SmartSuggest-аналитика | DEFERRED |

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

## Остаточный технический долг (не блокирует, для будущих сессий)

| Источник | Описание | Приоритет |
|---|---|---|
| `FilterRow.svelte:24–137` | Pre-existing mojibake в комментариях dropdown-региона (вне touched-строк #077). | P3 cleanup |
| `DateFormulaInput.svelte:59` | Hardcoded английский `title` (косметика). | P3 |

## Запреты

- ❌ Прямые коммиты/пуши в `main`.
- ❌ Не повышать PX-budget.
- ❌ Не добавлять `@ts-ignore` в `src/`.
- ❌ `filterEvaluator.ts` — только потребление, не модифицировать параллельными реализациями.
- ❌ Не rebuild виджетов, которые V2 spec отправляет в archive (timeline, comparison, summary-row, yaml-visualizer, view-port, data-list).
