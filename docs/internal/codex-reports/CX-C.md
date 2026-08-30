# CX-C — аудит `main@64863ed`

Режим read-only; изменений не вносилось. Эталон: `docs/internal/DASHBOARD_V2_VISION.md`, сцена 5 (строки 75–81).

## Сводка

| Пункт | Статус | Вывод |
|---|---|---|
| Один движок и порядок A→C→B→sort | PARTIAL | Канонический evaluator есть, но порядок нарушается ранней сортировкой, C пропускается для linked source, а Stats и поиск фильтруют локально. |
| Сохранённый фильтр как самостоятельная база | PARTIAL | Ближайший эквивалент — именованный Dashboard view с `view.filter`; самостоятельной коллекции, которую можно использовать как источник другого view, нет. |
| `migrateDashboardTransforms` при открытии | PARTIAL | Миграция идемпотентна и ограничена конфигом, но безусловно переписывает `data.json` без снимка исходной конфигурации и без undo. Одноразовый backup нужен. |

## 1. Инвариант: один движок и один порядок

Статус: **PARTIAL**.

- Для обычных `FilterDefinition` канонический движок действительно есть: `filterEvaluator.ts` объявляет себя единственным ядром, а `applyFilter` вызывает `matchesFilterConditions` (`src/lib/engine/filterEvaluator.ts:1–15, 183–231`). `View.svelte` использует лишь re-export-фасад этого же движка (`src/ui/app/filterFunctions.ts:1–23`).
- Filter-tabs также не создают отдельный evaluator: `applyFilterTab` строит условие и передаёт его в `filterByLinkedSelection` (`src/ui/views/Dashboard/dashboardFilters.ts:49–60`), который для обычных полей делегирует в `matchesCondition` (`src/ui/views/Dashboard/widgets/DatabaseCall/relationFilterAdapter.ts:68–90`).
- Однако фактическая последовательность не равна заявленной A→C→B→sort. Верхнеуровневый view выполняет scope-фильтр, затем сортировку (`src/ui/app/View.svelte:179–188`), и уже отсортированный frame передаётся Dashboard (`src/ui/views/Dashboard/dashboardView.ts:47–50`); после этого Canvas применяет filter-tab (`src/ui/views/Dashboard/DashboardCanvas.svelte:90–99`), а `WidgetHost` — scope и transform (`src/ui/views/Dashboard/widgets/WidgetHost.svelte:65–72`). Значит sort происходит до части A и до C/B.
- Даже внутри C доступен обычный шаг `filter`: он предлагается в `PipelineEditor` (`src/ui/views/Dashboard/widgets/PipelineEditor.svelte:114–121, 184–188`) и исполняется transform executor’ом после widget scope (`src/lib/dashboard-engine/transformExecutor.ts:68–101, 601–616`). Это второй пользовательский путь «отобрать записи», пусть и использующий тот же matcher.
- Для scope по полю, созданному transform’ом, `applyWidgetScope` намеренно возвращает `applied: false`; тогда `DatabaseCallBlock` применяет subFilter уже после transform (`src/ui/views/Dashboard/widgets/widgetScope.ts:47–74`; `src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:140–151`). Это совместимость со старыми конфигами, но не строгий A→C.
- Linked-source блок пропускает C полностью: `WidgetHost` сначала вычисляет `transformedFrame`, но `resolveDbCallView` заменяет его внешним raw frame (`src/ui/views/Dashboard/widgets/WidgetHost.svelte:83–93`; `src/ui/views/Dashboard/widgets/linkedSourceState.ts:101–118`). При этом редактор pipeline остаётся доступен и получает внешний frame (`src/ui/views/Dashboard/widgets/WidgetHost.svelte:195–205`).
- Stats добавляет самостоятельный B-фильтр: `StatsWidget` вызывает `filterRecordsBySelection` (`src/ui/views/Dashboard/widgets/Stats/StatsWidget.svelte:62–67`), а тот вручную сравнивает строковые значения и массивы, не вызывая `filterEvaluator` (`src/ui/views/Dashboard/widgets/Stats/statsSelectionReceiver.ts:64–97`).
- Поиск таблицы — ещё один render-local отбор: после table sort `DataTableContent` вызывает `applySearch` (`src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:75–87`), а `applySearch` ищет подстроку по `id` и всем значениям (`src/ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts:146–156`). Он не сохраняется, но способен убрать строки вне A/C/B.
- Предфильтрация datasource существует, но использует канонический evaluator: Dataview применяет `applyFilter` до возврата frame (`src/lib/datasources/dataview/datasource.ts:120–130`), native query — после acquisition (`src/lib/datasources/native-query/nativeQuery.ts:96–124`). Это документированное acquisition-поведение, а не второй comparator.

## 2. Продуктовый разрыв: «фильтр как база»

Статус: **PARTIAL**.

- Ближайший работающий эквивалент — именованный `ViewDefinition`: он имеет `name`, `filter`, `config` и `sort` (`src/settings/base/settings.ts:11–38`). В нём фильтр реактивно пересчитывает frame (`src/ui/app/View.svelte:140–188`), а `DashboardView.onData` обновляет Canvas (`src/ui/views/Dashboard/dashboardView.ts:47–50`).
- Поэтому пользователь может вручную создать отдельный Dashboard view с именем вроде «Повторный приём», фильтром и собственными виджетами. Это закрывает имя, часть представлений и реактивную перестройку, но сущность остаётся **view с вложенным filter**, а не сохранённым filter-collection.
- Модель Dashboard не содержит отдельного списка или идентификатора сохранённых выборок: `DatabaseViewConfig` хранит widgets, table, formula fields и presets, но не `savedFilters`/collection (`src/ui/views/Dashboard/types.ts:315–349`). `WidgetDataContext.subFilter` также является вложенным `FilterDefinition` конкретного блока (`src/ui/views/Dashboard/types.ts:101–133`).
- Такой view нельзя выбрать источником другого view как выборку: `WidgetSourceConfig` содержит только `projectId` (`src/ui/views/Dashboard/types.ts:54–63`), а `resolveBlockSource` загружает только parent либо frame внешнего проекта (`src/ui/views/Dashboard/widgets/linkedSourceState.ts:34–65`).
- В коде есть модель именованных sub-base (`id`, `name`, `filter`, column settings: `src/lib/database/subBase.ts:24–55`), однако dashboard-тип `sub-base-canvas` не имеет entry в `WIDGET_CONTENT`: реестр начинается с data-table/chart/stats/filter-tabs/database-call (`src/ui/views/Dashboard/widgets/widgetComponentRegistry.ts:37–49, 98–153`). Следовательно, она не даёт пользователю живую кросс-базу с представлениями.
- Конфигурация хранится как часть общего plugin `data.json`, а не как экспортируемая самостоятельная выборка: пример содержит `projects[].views[].config` и `filter` в одном документе (`demo-vault/.obsidian/plugins/obs-projects-plus/data.json:1–3, 53–159`). Препятствие одновременно в модели данных и в UI/source-routing.

## 3. Риск миграции на `onOpen`

Статус: **PARTIAL**.

- `DashboardView.onOpen` вызывает `migrateDashboardTransforms`, и при `migrated: true` сразу делает `props.saveConfig(config)` (`src/ui/views/Dashboard/dashboardView.ts:53–85`). Пользователь не подтверждает это действие и не получает undo-path.
- Миграция переносит подряд идущие filter-steps в `config.subFilter`, оставляет только хвост pipeline и возвращает новую конфигурацию (`src/ui/views/Dashboard/widgets/legacyMigration.ts:163–229`; `src/ui/views/Dashboard/migration.ts:154–181`). Значит исходное расположение filter-step в persisted pipeline удаляется.
- Сохранение конфигурации заменяет `view.config` в settings-store (`src/lib/stores/settings.ts:322–347`), а подписка плагина записывает всё состояние через `saveData(value)` (`src/main.ts:355–360`). В этом пути нет резервной копии именно до dashboard migration.
- Существующий backup относится только к случаю, когда глобальная `migrateSettings(raw)` уже не смогла прочитать settings, а не к успешной dashboard-миграции (`src/main.ts:523–544`).
- Реальный сценарий потери: старый `widgets[i].transform.steps = [filter, pivot]` при первом открытии превращается в `config.subFilter + transform:[pivot]`, после чего весь `data.json` сохраняется. При семантической ошибке миграции, несовместимости старого transform или необходимости отката пользователь уже не может восстановить исходный порядок из сохранённого конфига; затронуты настройки dashboard, не Markdown-записи.
- Вывод: **одноразовый backup перед первой мигрирующей записью нужен**. Риск не в потере заметок, а в необратимой потере исходного представления dashboard-конфигурации.

## Предлагаемые тикеты

- **P1 — Восстановить фактический инвариант порядка Dashboard A→C→B→sort.** Сейчас верхнеуровневая сортировка опережает часть scope, transform и selection; linked-source вообще исключает C. Цена ошибки — разные результаты при одинаковой конфигурации источника и разный порядок строк между поверхностями.

- **P1 — Устранить локальный comparator у Stats receiver.** Stats вручную сравнивает строковые значения вместо применения канонического условия. Цена ошибки — агрегаты могут описывать иной набор записей, чем table/database-call при relation и типизированных полях.

- **P1 — Зафиксировать продуктовую сущность «сохранённая выборка / кросс-база».** Нынешний именованный Dashboard view является обходным решением, но не адресуемым источником для других представлений. Цена ошибки — главная инновация сцены 5 остаётся недоступной как пользовательский сценарий.

- **P1 — Добавить одноразовую точку восстановления перед dashboard transform migration.** `onOpen` меняет и сохраняет конфигурацию без обратимого состояния. Цена ошибки — невозможность восстановить прежний pipeline после первого открытия.

- **P2 — Развести либо явно классифицировать остаточные пути отбора: pipeline filter и table search.** Они убирают строки вне понятной пользователю модели трёх осей. Цена ошибки — пользователь не может надёжно ответить, почему запись исчезла.

Codex session ID: 01a0420a-cbd7-72b3-a8ac-7316ab329991
Resume in Codex: codex resume 01a0420a-cbd7-72b3-a8ac-7316ab329991
