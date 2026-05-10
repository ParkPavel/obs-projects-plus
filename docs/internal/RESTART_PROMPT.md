# 🔄 RESTART PROMPT — obs-projects-plus
## Перезапуск сессии на полпути разработки

> **Ситуация**: Ты подключаешься к проекту с историей нескольких интенсивных сессий.
> Цикл V5 завершён. Идёт цикл **V6 / Dashboard V2**. Sprints 0-8 закрыты.
> **Язык**: Русский. Код и коммиты — EN.
> **GitHub**: https://github.com/ParkPavel/obs-projects-plus

---

## §0 — ПЕРВЫЕ 5 МИНУТ (не пиши код)

**Порядок жёсткий. Пропуск любого шага = потеря контекста.**

```
1. Прочитай CLAUDE.md (корень проекта) — source of truth по стеку и инвариантам
2. Прочитай memories/repo/session-state.md — статус предыдущей сессии
3. Прочитай docs/internal/NOTION_PARITY.md §10 — какие V6 спринты открыты
4. Запусти `npx jest` — убедись что тесты зелёные. Если нет → чини СНАЧАЛА
5. Спроси пользователя: "Что из предыдущей сессии проверено руками?"
```

**НЕ повторяй уже сделанную работу.** Перед любым действием сверяйся с §3.

---

## §1 — ПРОЕКТ ОДНОЙ СТРОКОЙ

Плагин для Obsidian. Превращает Markdown-заметки с YAML-шапками в систему баз данных а-ля Notion. Работает локально, без облака. **Файл = запись, папка = таблица, frontmatter = схема полей.**

---

## §2 — СТЕК И ОГРАНИЧЕНИЯ (инварианты — нарушение = СТОП)

| Параметр | Значение | Нарушение |
|---|---|---|
| TypeScript | strict + `exactOptionalPropertyTypes: true`, zero `@ts-ignore` | Любой `@ts-ignore` → СТОП |
| Svelte | **3.59.2** (locked, не 4, не 5) | `$effect`, `$state`, `$props` → СТОП |
| Tests baseline | **107 suites / 1700 tests PASS** | Падение → чини сразу |
| PX-budget | **≤191** px (ratchet test заблокирован) | Новые px → только `rem` |
| i18n | i18next, en/ru/uk/zh-CN | Новые строки → только через i18n |
| Dataview | optional peer dep | Без Dataview → всё работает |
| Engine imports | `src/lib/engine/` — pure functions, NO Obsidian/DOM | Нарушение слоёв → СТОП |

**Команды:**
```bash
npm run build        # tsc check + bundle
npm test             # jest (все suites)
npx tsc --noEmit     # только type check
```

---

## §3 — ЧТО СДЕЛАНО (не трогать, не переделывать)

### V5 — полностью закрыт ✅

| Блок | Что закрыто |
|---|---|
| Engine | `filterEvaluator.ts` (60+ тестов), `extendedEvaluator.ts` (115+ функций), `crossProjectResolver`, `inverseIndex`, `rollupMode`, `subBase`, `crossSubBase` |
| V5.1 | R5-006 (Menu migration), R5-007 (ReDoS guard), R5-015 (typed $set) |
| V5.2 | R5-014 (UI tests), R5-002 Phase 1 (formula unification) |
| V5.3 | R5-005 (color/palette system), R5-008 (settings v3→v4 migration) |
| MPLAN | MPLAN-001..MPLAN-012 закрыты (formula inline, linkable URL/Email/Phone, sub-base canvas, cross-base relations, YAML Visualizer widget, Properties replace, nested filters, list view, и др.) |

### V6 Sprints 0-8 — закрыты ✅ (из CLAUDE.md)

| Sprint | Что закрыто |
|---|---|
| S0 | Design tokens (`--ppp-db-*` pastel palette, status/priority/chip/panel/node tokens) |
| S1 | Schema: `AutoTime (V6-A1)`, `UniqueId (V6-A2)`, `statusGroups`, `inverseFieldName` в настройках |
| S2 | `DatabaseCall` widget type — добавлен в `WidgetType`, `WidgetDataContext`, `ViewTab` типы |
| S3 | Slide-in panels: `SlideInPanel/`, `FieldSettingsPanel/`, `FilterPanelVisual/`, `ConditionalFormatBuilder/` |
| S4 | Relations/Rollup/Status: `relationsWriter.ts` (full two-way write-back), rollup full set |
| S5 | Timeline (NPLAN-B2): `Calendar/` timeline improvements |
| S6 | Formula visual toggle (text mode ↔ node toggle в FormulaEditor) |
| S7 | Export/Shortcuts: `ExportService.ts`, keyboard shortcuts layer |
| S8 | Polish: bulk select, drag handle, hide empty fields |

### Виды — стабильны, не рефакторить без причины

| Вид | Статус |
|---|---|
| Calendar | ✅ Лучший в классе (Agenda 2.0, 42 оператора) |
| Board (Kanban) | ✅ Стабилен (динамические колонки из данных) |
| Gallery | ✅ Базовый |
| Dashboard | ✅ 12+ widget types, DatabaseCall в составе |

---

## §4 — ЧТО ОСТАЛОСЬ (V6 текущие цели)

> **Parity score**: ~80%. Цель V6: **≥90%**.
> Полный план: `docs/internal/NOTION_PARITY.md §10` — V6 Sprints и их статусы.

### Открытые V6 задачи (верифицируй актуальный список в NOTION_PARITY.md)

**NPLAN-A1** — AutoTime fields (`created_time`, `last_edited_time`) — pipeline `applyAutoFields`  
**NPLAN-A2** — `unique_id` field — per-project counter в `ProjectDefinition.uniqueIdCounter`  
**NPLAN-B1** — Relative-date filter operators (today/this_week/past_n_days...) + UI пресеты  
**NPLAN-B2** — Timeline (Gantt) widget — `Dashboard/widgets/Timeline/`  
**NPLAN-C1** — Status groups overlay в Board (semantic groups toggle, invariant: default = unique values)  
**NPLAN-C2** — Two-way relations write-back (если не закрыт S4)  
**NPLAN-C3** — Rollup full function set (show_original, percent_empty, percent_per_group...)  
**NPLAN-D1** — RichText annotations (bold/italic/color inline) — XL финальный milestone
**NPLAN-D2** — Page-level icon во всех views — ✅ закрыт (minimal slice); cover-картинка отложена

**Перед стартом: проверь в NOTION_PARITY.md что реально открыто — список мог измениться.**

### Dashboard V2 / Canvas DB — ключевая фича

Концепция и guidelines: `docs/internal/DASHBOARD_V2_MASTER_PROMPT.md`  
Краткий смысл: free-placement canvas, `database-call` block как primary primitive, node formula builder, visual settings (DG-0..DG-10).

---

## §5 — АДАПТИВНАЯ ЛОГИКА (выучи, не нарушай)

### 5.1 Нет фиксированных значений. Нигде. Никогда.

```
Пользователь выбирает поле "этап" для Board
  → плагин читает уникальные значения из его данных
  → создаёт колонки: "планирование", "дизайн", "разработка"
  → появляется новое значение "тест" → появляется колонка автоматически
```

**❌ ЗАПРЕЩЕНО:** `if (field.name === "status")` или `["todo", "in_progress", "done"]`  
**✅ ПРАВИЛЬНО:** `if (field.type === DataFieldType.Select)` → уникальные значения из данных

### 5.2 Status = Select с опциональной пометкой

Status field = обычный Select. Пользователь может отметить в `fieldConfig.statusGroups` какие значения = завершённые (для rollup `percentChecked`). Board колонки строятся из реальных данных — не из групп.

### 5.3 Даты — четыре параметра

```yaml
startDate: 2026-05-12    # когда начинается
startTime: "09:00"       # во сколько (опционально)
endDate: 2026-05-26      # когда заканчивается
endTime: "18:00"         # до скольки (опционально)
```

Имена полей — произвольные, пользователь маппит в настройках вида.  
Date picker везде = 4 поля, не 2.

### 5.4 Имена полей произвольны

`статус`, `Status`, `state` — одно и то же с точки зрения типа.  
Тип в `fieldConfig`, имя — пользовательское на любом языке.

### 5.5 UI-FIRST

> Если фича недоступна из интерфейса — её не существует для пользователя.

Перед каждой задачей:
```
□ Как пользователь узнает что фича существует?
□ Как её вызовет? (кнопка / меню / клик)
□ Как увидит результат?
□ Что увидит при ошибке? (сообщение, не пустота)
□ Работает без перезапуска плагина?
```

---

## §6 — ДИЗАЙН (Design Guidelines)

Полный гайдлайн: `docs/internal/DASHBOARD_V2_MASTER_PROMPT.md` — DG-0..DG-10.

**Краткие обязательные правила:**
- Нейтральная палитра: `--ppp-db-*` токены (уже определены в `tokens.css`)
- Tags/Select → pastel pill-chips, не насыщенные цвета
- Controls (drag handle, `+`, меню) → только при hover, keyboard-reachable
- Settings → slide-in panels (`SlideInPanel/`), не modal overlay
- Hover строк → `--background-modifier-hover`, максимально мягкий
- Transitions → CSS fade, без bounce/spring
- Spacing → `rem`, base unit 4px
- Icons → только Lucide (встроены в Obsidian)

---

## §7 — НЕ ТРОГАТЬ

| Что | Почему |
|---|---|
| Calendar View | Лучший в классе. Только точечные правки |
| Board View | Стабилен. Только точечные правки |
| Svelte версия | 3.59.2 заблокирована на V6 цикл |
| Engine layer | Pure functions. Без DOM/Obsidian API |
| `filterEvaluator.ts` | Canonical engine — нельзя создавать параллельные |
| Multi-user / cloud | Никогда. Single-user = конкурентное преимущество |
| Automation Engine | Phase E — после V6 |

---

## §8 — ФАЙЛЫ-ОРИЕНТИРЫ

```
ОБЯЗАТЕЛЬНО прочитать при старте:
  CLAUDE.md                                   ← source of truth (стек, инварианты, архитектура)
  memories/repo/session-state.md              ← статус прошлой сессии
  docs/internal/NOTION_PARITY.md §10          ← какие V6 спринты открыты

ДИЗАЙН И АРХИТЕКТУРА:
  docs/internal/DASHBOARD_V2_MASTER_PROMPT.md ← Design Guidelines DG-0..DG-10
  docs/ARCHITECTURE_V5.md                     ← 4-слойная архитектура, контракты

БЭКЛОГ И ТИКЕТЫ:
  docs/internal/NOTION_PARITY.md              ← V6 план + gap-анализ vs Notion
  docs/internal/REFACTOR_BACKLOG_V5.md        ← R5-tickets (большинство закрыты)
  docs/internal/MODERNIZATION_PLAN_V5.md      ← MPLAN-tickets

ПРИ НЕОБХОДИМОСТИ:
  docs/internal/DATAVIEW_ABSORPTION_PLAN.md   ← стратегия Dataview
  docs/internal/MASTER_MAP_V5.md              ← навигация по документам V5
```

---

## §9 — СИСТЕМА КОНТРОЛЯ КОНТЕКСТА

> Это не просто советы. Это **протокол**. Следуй ему механически.

### 9.1 Анкерные факты (проверяй при любом сомнении)

Эти факты всегда истинны. Если ты готов сделать что-то им противоречащее — ты потерял контекст.

```
ANCHOR-1: Тесты = 107 suites / 1700 tests PASS (не меньше)
ANCHOR-2: V6 Sprints 0-8 ЗАКРЫТЫ. SlideInPanel, FieldSettingsPanel,
          FilterPanelVisual, ConditionalFormatBuilder — УЖЕ СУЩЕСТВУЮТ в src/
ANCHOR-3: `database-call` — УЖЕ в WidgetType union (Dashboard/types.ts)
ANCHOR-4: AutoTime, UniqueId — УЖЕ в DataFieldType enum
ANCHOR-5: Two-way relations — relationsWriter.ts УЖЕ реализован
ANCHOR-6: filterEvaluator.ts — единственный canonical filter engine
ANCHOR-7: Board колонки = unique values из данных, НИКОГДА хардкод
ANCHOR-8: Даты = 4 параметра (startDate, startTime, endDate, endTime)
ANCHOR-9: Design tokens --ppp-db-* УЖЕ определены в tokens.css
ANCHOR-10: Svelte 3.59.2, zero @ts-ignore, PX-budget ≤191
```

### 9.2 Контрольные точки (checkpoint triggers)

Останавливайся и верифицируй анкеры в следующих ситуациях:

| Триггер | Что делать |
|---|---|
| **После каждых 3 значимых изменений** | Запусти `npx jest`, проверь tsc, сверь с ANCHOR-1 |
| **Перед созданием нового компонента** | Проверь ANCHOR-2 — он уже существует? |
| **Перед реализацией движка/логики** | Grep в `src/lib/` — уже реализовано? |
| **При написании filter/formula/rollup** | Сверь с ANCHOR-6 — используй canonical |
| **Перед хардкодом любого значения** | Сверь с ANCHOR-7 — это данные пользователя? |
| **При работе с датами** | Сверь с ANCHOR-8 — 4 параметра? |
| **При добавлении дизайн-решений** | Сверь с DG-0..DG-10 в DASHBOARD_V2_MASTER_PROMPT.md |
| **Когда контекст диалога >50 сообщений** | Запусти §9.4 Self-audit, обнови session-state.md |

### 9.3 Симптомы потери контекста (дрейф)

Если ловишь себя на любом из этого → **СТОП, перечитай §0 и §3**:

| Симптом | Диагноз |
|---|---|
| Создаёшь SlideInPanel / FieldSettingsPanel | Они уже существуют (ANCHOR-2) |
| Пишешь новый filter engine | Есть canonical filterEvaluator.ts (ANCHOR-6) |
| Хардкодишь `"todo"`, `"done"`, статусы | Плагин адаптивный (ANCHOR-7) |
| Добавляешь `@ts-ignore` | Нарушение invariant (§2) |
| Создаёшь компонент без проверки что он существует | Проверь ANCHOR-2 |
| Пишешь движок без UI к нему | UI-FIRST (§5.5) |
| Делаешь date picker с 2 полями | Нужно 4 (ANCHOR-8) |
| Требуешь Dataview для базового функционала | Optional dep |
| Не обновляешь session-state.md после блока работы | Следующая сессия потеряет контекст |
| Тестов стало меньше чем 1700 | Что-то сломалось (ANCHOR-1) |
| Смотришь на Sprint N как "нужно сделать", а он в S0-S8 | Сверь с CLAUDE.md (ANCHOR-2) |
| Спрашиваешь "какие статусы хардкодить?" | Никакие. Статусы = данные пользователя |
| Пишешь @ts-ignore "временно" | Нет временных @ts-ignore |

### 9.4 Self-audit (запускай при любом сомнении)

Задай себе эти вопросы вслух перед следующим действием:

```
[1] Что я собираюсь сделать прямо сейчас? (одна строка)
[2] Это уже есть в коде? (Grep: src/ + ANCHOR-2)
[3] Это в scope текущего sprint'а? (NOTION_PARITY.md §10)
[4] Это не нарушает ни один из ANCHOR-1..10?
[5] Тесты сейчас зелёные? (npx jest --passWithNoTests)
[6] Если я закончу сейчас — session-state.md обновлён?
```

Если на любой вопрос ответ "не знаю" → остановись, прочитай соответствующий документ.

### 9.5 Протокол восстановления (Recovery)

Если понял что потерял контекст — выполни по порядку:

```
STEP 1: НЕ ПИШИ КОД
STEP 2: Прочитай CLAUDE.md
STEP 3: Прочитай session-state.md
STEP 4: Запусти npx jest — зелёные?
STEP 5: Прочитай NOTION_PARITY.md §10 — какой sprint активен?
STEP 6: Проверь каждый ANCHOR-1..10 — что из них ты нарушал?
STEP 7: Спроси пользователя: "Я потерял контекст в части [X]. 
        Подтверди: мы сейчас работаем над [Y]?"
STEP 8: Продолжай только после явного подтверждения
```

### 9.6 Управление контекстным окном

Контекстное окно конечно. Когда диалог становится длинным:

**Признаки приближения лимита:**
- Тебе сложно вспомнить что делалось 10+ сообщений назад
- Ты начинаешь переспрашивать о вещах которые уже обсуждались

**Действия при приближении лимита:**

```
1. Обнови memories/repo/session-state.md:
   - Что сделано в этой сессии (список)
   - Какой тикет/задача открыта прямо сейчас
   - Тесты: X suites / Y tests PASS
   - Что НЕ сделано из запланированного
   - Следующий шаг (одна строка)

2. Сообщи пользователю:
   "Контекстное окно заполняется. Обновил session-state.md.
   Рекомендую начать новую сессию с RESTART_PROMPT.md"

3. Не пытайся "додавить" в переполненном контексте.
   Лучше чистый перезапуск с сохранённым состоянием.
```

### 9.7 Правило "сначала grep, потом создавать"

**Перед созданием любого нового файла/компонента:**

```bash
# Проверить что не существует:
grep -r "ComponentName" src/ --include="*.svelte" --include="*.ts" -l

# Проверить что тип не определён:
grep -r "WidgetType\|DataFieldType" src/ui/views/Dashboard/types.ts src/lib/dataframe/dataframe.ts
```

Если находишь — используй существующее. Если не находишь — создавай.

---

## §10 — ПОРЯДОК ДЕЙСТВИЙ ПОСЛЕ ПРОЧТЕНИЯ

```
1. Прочитай §0 — выполни все 5 шагов
2. Запусти npx jest — зелёные? (ANCHOR-1)
3. Прочитай NOTION_PARITY.md §10 — какой sprint активен?
4. Спроси пользователя: "Что проверено руками из прошлой сессии?"
5. Начни с первого незакрытого NPLAN-ticket из активного sprint'а
6. После каждого завершённого пункта:
   a. npx jest
   b. Обнови session-state.md
   c. Покажи пользователю что изменилось
7. При любом сомнении → §9.4 Self-audit
8. При потере контекста → §9.5 Recovery protocol
```

---

## §11 — ТЕХНИЧЕСКИЕ ЯКОРЯ (быстрый справочник)

```typescript
// DataFieldType (dataframe.ts) — полный список
String | Number | Boolean | Date | List | Select | Status |
Formula | Relation | Rollup | AutoTime | UniqueId | Unknown

// WidgetType (Dashboard/types.ts) — полный список
"data-table" | "chart" | "stats" | "comparison" | "checklist" |
"view-port" | "filter-tabs" | "summary-row" | "data-list" |
"sub-base-canvas" | "yaml-visualizer" | "database-call"

// Canonical filter engine
src/lib/engine/filterEvaluator.ts → matchesFilterConditions()

// Canonical formula engine
src/lib/formula/extendedEvaluator.ts → evaluateFormulaValue()

// Two-way relations
src/lib/relations/relationsWriter.ts

// Design tokens
src/ui/tokens/tokens.css → prefix --ppp-* (general), --ppp-db-* (V6)

// Slide-in panel
src/ui/components/SlideInPanel/ → <SlideInPanel> (уже существует)

// Per-widget data context
Dashboard/types.ts → WidgetDataContext, ViewTab
```

---

> **Версия**: RESTART 2.0  
> **Дата**: 2026-05-08  
> **Контекст**: V5 закрыт. V6 Sprints 0-8 закрыты. Активны NPLAN-tickets.  
> **Главная задача**: довести Notion parity с ~80% до ≥90% через V6 NPLAN-roadmap.  
> **Source of truth**: `CLAUDE.md` в корне проекта.
