# UX Flow — Main Scenario: Live Database with Relations

> **Версия**: V1.0
> **Дата**: 2026-05-08
> **Статус**: DRAFT — входной материал для сессий V5.6/V5.9 (relations + reactive loop).
> **Назначение**: Референс пользовательского сценария для проверки архитектурной полноты.
> Каждый шаг помечен зелёным ✅ (работает), жёлтым 🟡 (частично), красным 🔴 (не реализовано).

---

## Контекст

**Пользователь**: продуктовый менеджер ведёт трекер задач и финансов внутри Obsidian.  
**Цель**: создать живую базу данных «Проекты → Задачи → Бюджет», где изменение строки в одной базе автоматически пересчитывает rollup в другой — без ручного обновления.  
**Критерий успеха**: «Я меняю статус задачи и вижу изменение итогового бюджета в родительском проекте в ту же секунду».

---

## Шаг 1 — Создание коллекции (папка → база)

**Действие пользователя**: открывает плагин, нажимает «Новый проект», указывает папку `Projects/`. Задаёт поля:
- `name` (String)
- `status` (Status: Not Started / In Progress / Done)
- `budget` (Number)
- `tasks` (Relation → база `Tasks/`)

**Ожидание**: Dashboard открывается с пустой таблицей. Поле `tasks` показывает кнопку «Добавить» для каждой строки.

| Подсистема | Файл | Статус |
|---|---|---|
| Папка как источник | `datasources/folder/datasource.ts` | ✅ работает |
| Status тип поля | `DataFieldType.Status` | ✅ работает |
| Relation поле (хранение) | `[[wikilink]]` в frontmatter | ✅ хранится |
| Relation UI (pill-chips) | `GridRelationCell.svelte` | 🟡 pill-chips есть, не всегда подключены к resolvedLabels |
| Relation picker popover | нет — только полный модал | 🔴 R5-019 |

---

## Шаг 2 — Добавление строки и связывание записей

**Действие пользователя**: добавляет строку «Проект Alpha», открывает поле `tasks`, ищет задачи из базы `Tasks/` по имени, выбирает несколько.

**Ожидание**: в ячейке появляются цветные pill-chips с именами задач. Нажав на chip — открывается карточка задачи как side-peek. Поле `budget` в проекте обновляется через rollup автоматически.

| Подсистема | Файл | Статус |
|---|---|---|
| Двусторонние relations (bidirectional) | `crossProjectRollup.ts` | 🔴 R5-010 (BACKLOG V5.6) |
| Pill-chip рендеринг | `GridRelationCell.svelte` | 🟡 реализован через RelationListView |
| Side-peek карточки | нет | 🔴 нет тикета |
| Rollup поле auto-compute | `rollupMode.ts` | 🟡 логика есть, UI готов (ConfigureField.svelte 203-318) |

---

## Шаг 3 — Формула и авто-вычисление в Dashboard

**Действие пользователя**: добавляет виджет «Итого бюджет» на Dashboard. Формула: `sum(budget)`. Вешает фильтр «только In Progress».

**Ожидание**: виджет моментально показывает сумму. Если пользователь меняет статус проекта на «Done» — сумма пересчитывается в реальном времени.

| Подсистема | Файл | Статус |
|---|---|---|
| Формула `sum()` | `extendedEvaluator.ts` | ✅ работает |
| Агрегация в Dashboard | `aggregation.ts` | ✅ работает |
| Фильтр в Dashboard | `filterEvaluator.ts` | ✅ работает |
| **Реактивный пересчёт** | `transformCache.ts` → vault events | 🔴 **R5-016 (P0, BACKLOG V5.9)** |
| Дебаунс vault events | нет throttle | 🔴 часть R5-016 |

> ⚠️ **Критический разрыв**: без R5-016 этот шаг требует от пользователя вручную закрыть и открыть Dashboard. «Живой» базы данных нет.

---

## Шаг 4 — Sub-база внутри Dashboard (Matryoshka)

**Действие пользователя**: внутри Dashboard проекта нажимает «+ Добавить вложенную базу». Выбирает `Tasks/` как источник. Задаёт вид «Board по статусу».

**Ожидание**: внутри Dashboard появляется второй канвас с kanban-досками задач. Перетаскивание карточки в колонку «Done» обновляет поле `status` в файле задачи и пересчитывает rollup в родительском Dashboard.

| Подсистема | Файл | Статус |
|---|---|---|
| SubBaseCanvasWidget | `widgets/SubBaseCanvas/SubBaseCanvasWidget.svelte` | ✅ создан R5-009 DONE |
| Регистрация в WidgetRegistry | `widgetRegistry.ts` | ✅ R5-009 |
| SubBaseTabs в DataTableWidget | `SubBaseTabs.svelte` | ✅ интегрирован |
| Board view внутри sub-base | Board rendering в sub-canvas | 🟡 базовый рендер |
| Rollup пересчёт после DnD | vault event → R5-016 → rollup | 🔴 зависит от R5-016 + R5-010 |

---

## Шаг 5 — YAML Visualizer как лицо записи

**Действие пользователя**: кликает на строку «Проект Alpha» в таблице. Справа открывается YAML Visualizer — красивая карточка с иконкой, полями как typed properties, без сырого YAML.

**Ожидание**: поля отображаются с правильными типами. Пустые поля скрыты. Пользователь редактирует `budget` прямо в карточке — таблица обновляется.

| Подсистема | Файл | Статус |
|---|---|---|
| YamlVisualizerWidget | `widgets/YamlVisualizer/YamlVisualizerWidget.svelte` | ✅ R5-011 DONE |
| YAML Visualizer как Properties pane | `VisualizerPane/` + main.ts | 🔴 R5-012 BACKLOG |
| Редактирование → vault write → UI update | `frontmatterApi.ts` + R5-016 | 🔴 зависит от R5-016 |

---

## Сводная таблица готовности сценария

| Шаг | Название | Готовность | Блокер |
|-----|----------|------------|--------|
| 1 | Создание коллекции | 🟡 70% | R5-019 (relation UI) |
| 2 | Связывание записей | 🔴 30% | R5-010 (bidirectional) + R5-019 |
| 3 | Живые вычисления | 🔴 20% | **R5-016 (P0 reactive loop)** |
| 4 | Sub-база Matryoshka | 🟡 60% | R5-016 + R5-010 |
| 5 | YAML Visualizer карточка | 🟡 65% | R5-012 + R5-016 |
| **Весь сценарий** | | 🔴 **~40%** | R5-016 является универсальным блокером шагов 3–5 |

---

## Рекомендуемый порядок спринтов

```
Sprint 1 (параллельно):
  ├── R5-016 (reactive loop) — 3 дня
  └── R5-013 доделать (canvas split) — prerequisite

Sprint 2:
  ├── R5-010 (bidirectional relations) — 5 дней
  └── R5-019 (relation picker popover) — 3 дня, параллельно

Sprint 3:
  ├── R5-012 (YAML as Properties pane)
  └── R5-020 (row chrome: hover/drag/bulk)
```

---

## Связанные документы

- [`REFACTOR_BACKLOG_V5.md`](REFACTOR_BACKLOG_V5.md) — все тикеты R5-*
- [`DATAVIEW_ABSORPTION_PLAN.md`](DATAVIEW_ABSORPTION_PLAN.md) — Gap 1 (Relation UI), Gap 5 (Rollup UI)
- [`DESIGN_CONCEPT_NOTION_AESTHETIC.md`](DESIGN_CONCEPT_NOTION_AESTHETIC.md) — визуальный референс
- [`SESSION_REPROMPT.md`](SESSION_REPROMPT.md) — точка входа следующей сессии реализации
