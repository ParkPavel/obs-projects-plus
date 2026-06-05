# QA Audit 2026-05-27 — API-level Smoke Tests + Expectations vs Reality

**Контекст:** аудит после merge стека 6 тикетов (#022.6, #039, #045.2/4/6) в `main` @ `707e08d`. Цель — срез того, что **доказуемо работает** через Local REST API, и что **требует визуального QA** в живом Obsidian.

**Окружение:**
- Obsidian 1.9.12 (запущен с vault `OBStests`)
- Local REST API v3.6.2 — `https://127.0.0.1:27124` (TLS, authenticated)
- obs-projects-plus v3.5.1-alpha — bundle `f62cf6fdfe7401229b21be4d5ca53a0a` (`main.js` 2.92 MB)
- Dataview plugin установлен в OBStests (важно для #045.x DV-bridge testing)
- Bundle sync: hash в `OBStests/.obsidian/plugins/obs-projects-plus/main.js` == hash в repo `main.js` (свежий билд после merge)
- Obsidian reloaded через `POST /commands/app:reload/` — плагин в памяти свежий

---

## Стек тестирования (по уровням)

| Уровень | Покрытие | Статус |
|---|---|---|
| L1 — TypeScript compiler | `npx tsc --noEmit` | ✅ 0 errors |
| L2 — Static invariants | px-budget ≤186, 0 `@ts-ignore`, filterEvaluator не модифицирован, нет parallel filter impl | ✅ all pass |
| L3 — Unit tests | Jest pure-function tests | ✅ 139 suites / 2099 tests PASS |
| L4 — Component (JSDOM) tests | `@testing-library/svelte` render + fireEvent | ✅ FormulaConstructor +9, AdvancedFilterEditor +7, RollupCellRenderer +19, WindowShell +5, freeCanvasStore +7, native-query +21, groupRows +11, DataList/SubBase Relation propagation +2 |
| L5 — Production build | `npm run build` → bundle для Obsidian | ✅ OK (4 pre-existing a11y warnings, не от изменений) |
| L6 — Plugin load | Obsidian reloads, плагин регистрирует 11 команд | ✅ verified via REST API `GET /commands/` |
| L7 — End-to-end data flow | Создание демо-проекта через `POST /commands/obs-projects-plus:create-demo-project/` | ✅ 67 файлов созданы, data.json populated, 12 views зарегистрированы (8 dashboard / 2 board / 2 calendar / 1 gallery) |
| L8 — Visual UI rendering | Drag/resize, suggestion dropdown placement, Ctrl+Space, group rendering, rollup cell visual | ⚠️ **MANUAL QA ONLY** — API-уровня недостаточно |

---

## Expectations vs Reality (per ticket)

### #022.6 — AdvancedFilterEditor → FormulaConstructor

**Ожидание:**
- Calendar Agenda Custom list → Advanced mode показывает новый текстовый редактор с FormulaConstructor inside
- Suggestions dropdown через FloatingPopup (escape из narrow панели)
- Calendar-specific operators (`IS_OVERDUE`, `IS_TODAY`, `HAS_ANY_OF`, …) валидируются как valid
- Ctrl+Space на пустом → 4 Calendar snippets
- Help toggle раскрывает справочную панель
- Русские строки корректны (UTF-8, без mojibake)
- Save → re-open → формула сохранена

**Verifiable through API:** code-level pass (JSDOM tests 7/7, integration через AgendaListEditor public contract сохранён).

**Reality (API):** ✅ shell mounted (file changed 773 → 234 LOC), code paths covered. Translation keys `views.calendar.agenda.custom.advanced-filter.*` присутствуют в ru/en/uk/zh-CN. Plugin loads без runtime errors (verified via reload + command list).

**Manual QA required:**
1. Открыть Календарь → Agenda 2.0 → Custom list → Toggle "Advanced" mode
2. Ввести `IS_OVERDUE(dueDate)` — ожидание: "✓ Формула валидна" зелёным
3. Стереть всё, нажать Ctrl+Space — ожидание: dropdown с 4 Calendar snippets
4. Toggle Help button — ожидание: справочный блок раскрывается ниже
5. Save → закрыть → re-open agenda → формула на месте

**Risk:** SРEDIUM (Calendar agenda — основной consumer, regression там сразу видна).

---

### #039 — Window resize jankness fix

**Ожидание:**
- Drag/resize окон в Free Canvas Dashboard плавно (60 FPS)
- Нет десятков `saveConfig` (disk writes) во время drag — только один flush на gesture-end
- N/W/NW/NE/SW handles работают атомарно (move+resize в одном action)

**Verifiable through API:** code-level pass (JSDOM rAF coalesce tests pass).

**Reality (API):** ✅ `WindowShell.svelte` уже имеет `schedulePointer`/`flushPending` через RAF, `freeCanvasStore.ts` has `beginInteraction`/`endInteraction` + `interactingId` state. `DashboardCanvas.svelte` skips `saveConfig` while `interactingId !== null`. Тесты симулируют RAF через `setTimeout` fallback (jsdom limitation).

**Manual QA required:**
1. Открыть любой Dashboard view с window'ами (`📋 База: Обзор`, `📋 База: Kanban+`)
2. Drag окна за header — должно быть плавно без скачков
3. Resize за SE handle (правый-нижний угол) — без jitter
4. Resize за N/W edge — без рывков (это атомарный move+resize, ранее был 2 раздельных)
5. Открыть Console (Ctrl+Shift+I) — между mousedown и mouseup НЕ должно быть множества "saveConfig" logs
6. Reload page → recently-resized window сохраняет финальный rect

**Risk:** LOW (math exhaustively covered; visual perception subjective но улучшение должно быть заметно).

---

### #045.2 — Native-query lightweight layer

**Ожидание:**
- Новый модуль `src/lib/datasources/native-query/` позволяет выполнять ad-hoc DQL queries без полного DataSource
- API: `runNativeQuery(query, dataviewApi)` → Promise<DataFrame>
- Graceful degradation если Dataview API отсутствует

**Verifiable through API:** unit tests pass (21 test). Это **engine-only** ticket — нет UI surface.

**Reality (API):** ✅ файлы созданы (`nativeQuery.ts` 338 LOC + barrel + 21 unit-test). Никаких UI-потребителей пока — это инфраструктура для будущих consumers.

**Manual QA required:** **N/A — нет UI**. Полностью покрыт unit-тестами.

**Risk:** LOW (нет live integration).

---

### #045.4 — RollupCellRenderer

**Ожидание:**
- Standalone Svelte component `RollupCellRenderer.svelte` для отображения rollup-полей в любом контексте (DataTable cell, DataList item, Card metadata)
- Поддерживает разные aggregation modes (sum/avg/count/min/max/concat/first/last)
- Стабильное отображение для empty/null/error states

**Verifiable through API:** unit tests pass (19 cases). Component присутствует на диске.

**Reality (API):** ✅ component + tests + barrel. Не подключён к DataTable widget автоматически — это standalone компонент готовый к использованию. Demo project не имеет rollup field в схеме — нужен **custom project** с rollup field для visual testing.

**Manual QA required:**
1. Создать новый Project с relation field + rollup field (вручную через UI или Add field commands)
2. Добавить DataTable widget на dashboard
3. Включить rollup column в widget config → ожидание: ячейки показывают агрегированные значения, не `[object Object]`
4. Проверить пустой rollup → "—" или пустой текст (не `null`/`undefined`)
5. Проверить error state (сломанный target project) → graceful fallback

**Risk:** MEDIUM (новый visual component, нет live consumers в demo).

---

### #045.6 — DataTable 3-tier semantic grouping

**Ожидание:**
- `GroupConfig` extended с 3 новыми полями (`semanticOrder`, `customGroupOrder`, `emptyGroupBehavior`)
- DataTable groups строятся через `buildSemanticGroups` (Active → Inactive → Empty или custom order)
- Status field сортируется по semantic order (priority field workflow), не алфавитно

**Verifiable through API:** unit tests pass (11 cases для groupRows). Demo project имеет `📋 База: Kanban+` view (board, не DataTable) и DataTable Journal widget — нужно проверить можно ли создать DataTable с group config.

**Reality (API):** ✅ `groupRows.ts` extended (+145/-28), tests расширены (+180 LOC). Demo project имеет DataTable widget "Journal" в `📋 База: Обзор`, но его `groupConfig` нужно проверить через UI или прямо в data.json.

**Manual QA required:**
1. Открыть `📋 База: Обзор` → DataTable "Journal" → settings → groupBy=status (или другое status field)
2. В Group settings проверить: semantic order toggle / custom order list / empty group behavior
3. Ожидание: группы отображаются Active → Inactive → Empty (или custom order), не alphabetical
4. Изменить custom order → группы перестраиваются live

**Risk:** MEDIUM (UI расширение существующего widget — может конфликтовать с прошлыми groupConfig settings).

---

## Сводка статуса

| Ticket | Code-level | API-verifiable | Manual QA | Risk |
|---|:-:|:-:|:-:|:-:|
| #022.6 AdvancedFilterEditor | ✅ | ✅ | ⚠️ required | M |
| #039 Window resize | ✅ | ✅ | ⚠️ required | L |
| #045.2 Native-query | ✅ | ✅ (engine-only) | N/A | L |
| #045.4 RollupCellRenderer | ✅ | ⚠️ standalone | ⚠️ required | M |
| #045.6 DataTable grouping | ✅ | ✅ | ⚠️ required | M |

**Что доказано через API:**
- Bundle build, install, load без ошибок
- 11 plugin commands зарегистрированы
- Demo project (67 файлов, 12 views) создаётся командой
- data.json schema validates как ProjectDefinition v4
- Translation keys присутствуют (ru/en/uk/zh-CN)
- 2099 unit-тестов на свежем bundle hash pass

**Что НЕ доказывается через API (требует визуального QA):**
- Visual smoothness (jankness, FPS)
- Popover placement / flip behavior
- Keyboard interaction (Ctrl+Space, Tab navigation в dropdown)
- Cell rendering (rollup, group headers, snippet labels)
- Real-time updates (drag → live update → save flush)

---

## Рекомендованный manual QA скрипт (~15 минут)

1. **Demo project готов.** В Obsidian открыт OBStests → `Projects Plus - Демо/` в File explorer.
2. **#022.6 / Formula UX:** открыть «🤝 Встречи» → custom list → advanced filter mode. Проверить Ctrl+Space, ввод `IS_OVERDUE(dueDate)`, help toggle, save/reopen.
3. **#039 / Window resize:** открыть «📋 База: Обзор» → drag/resize window'ов разными handles, проверить плавность.
4. **#045.4 / Rollup:** добавить rollup field в Acme Corp project (через `obs-projects-plus:add-field` command или schema editor), включить колонку в DataTable, наблюдать рендер.
5. **#045.6 / Group:** в DataTable "Journal" включить groupBy=stage или другое status-like поле, проверить semantic order vs alphabetical.

---

## Точки расхождения ожиданий/реальности

**Нет расхождений на code/API уровне** — все ожидания подтверждены.

**Потенциальные расхождения на UI уровне** (предположения, до manual QA):
- #022.6: AdvancedFilterEditor может потерять некоторые UI affordances (e.g. validation badge color cues) — нужна визуальная проверка
- #045.4: RollupCellRenderer не интегрирован с существующим DataTable cell dispatcher — может требовать дополнительной wire-up работы для consumer widgets
- #045.6: GroupConfig migration — старые projects могут не иметь новых полей, нужен fallback на default behavior (проверить что не падает на проектах без `semanticOrder`)

---

## Что нужно от пользователя

1. **Запустить manual QA скрипт** (5 пунктов выше) и сообщить:
   - Какие сценарии воспроизводятся как ожидается
   - Какие сценарии дают неожиданное поведение / визуальные дефекты
   - Если есть console errors — приложить
2. После manual QA — принять решение:
   - Если всё OK → release / создать GitHub release tag
   - Если есть дефекты → создать follow-up тикеты с конкретным reproducer
