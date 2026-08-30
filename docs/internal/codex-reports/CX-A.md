# CX-A — аудит восьми сцен на `main@64863ed`

Проверено только состояние коммита `64863ed`. Эталон — `docs/internal/DASHBOARD_V2_VISION.md`; производные документы использованы лишь для сравнения заявленного статуса.

| Сцена | Фактический статус | Сравнение с `PRODUCT_RESET` §4 | Краткий вывод |
|---|---|---|---|
| 1. Единая живая сущность | `PARTIAL` | Нет: также «частично» | Состояние реактивно обновляет представления, но запись оптимистична и не компенсируется при ошибке; журнал в теле заметки не пишется. |
| 2. База из заметок | `PARTIAL` | Нет: также «частично» | Поле массово пишется во frontmatter, но нет подтверждения последствий и обработки частичного отказа. |
| 3. Прозрачная двунаправленность | `PARTIAL` | **Да: §4 говорит Gap** | Внешняя правка Markdown обновляет frame, но UI не показывает соответствие «колонка ↔ строка frontmatter» и не открывает файл на строке. |
| 4. Связи Клиент → Сеансы → аналитика | `PARTIAL` | **Да: §4 говорит P0 gap** | Есть relation, rollup, linked block и графики, однако целевой путь требует ручной настройки и не собирается автоматически. |
| 5. Фильтр как кросс-база | `DIVERGED` | Нет: «частично» подтверждается | Сохранённый фильтр остаётся полем конкретного view/виджета, а не самостоятельной именованной базой с представлениями. |
| 6. Проактивные вычисления | `PARTIAL` | **Да: §4 говорит Gap** | Есть только две подсказки: numeric → Stats и Relation → linked data block. |
| 7. Интуитивность и старт | `PARTIAL` | **Да: §4 говорит Gap** | Есть zero state, шаблоны и отдельные DnD-механизмы, но нет card-to-card relation DnD, field-to-header DnD и трёх профильных стартов; Pipeline Editor достигает 40 контролов. |
| 8. Дашборд как Markdown-документ | `DIVERGED` | Нет: подтверждает «decision gap» | Конфигурация — JSON в общем plugin `data.json`, а не отдельный переносимый Markdown-файл дашборда. |

## 1. Единая живая сущность — `PARTIAL`

- Перетаскивание карточки на Board меняет поле группы и вызывает `api.updateRecords(...)`: `src/ui/views/Board/BoardView.svelte`, `handleRecordUpdate`, строки 122–130 и 211–240.
- `ViewApi.updateRecord` сперва обновляет единый Svelte-store `dataFrame`, затем пишет файл: `src/lib/viewApi.ts`, `updateRecord`, строки 41–51. `dataFrame.updateRecord` заменяет запись и уведомляет подписчиков: `src/lib/stores/dataframe.ts`, строки 88–98.
- Активный view получает обновлённый `frame` из `DataFrameProvider` (`src/ui/app/DataFrameProvider.svelte`, строки 68–89 и 153) и передаёт его в `useView`; тот повторно вызывает `projectView.onData(...)`: `src/ui/app/useView.ts`, строки 76–99.
- Внешнее изменение Markdown проходит через `metadataCache.changed`: `src/lib/filesystem/obsidian/filesystem.ts`, `ObsidianFileSystemWatcher.onChange`, строки 151–160; `registerFileEvents` обновляет/перезапрашивает frame: `src/events.ts`, строки 40–55.
- Обрыв: локальное обновление происходит до `await dataApi.updateRecord`, а исключение не ловится и отката нет (`src/lib/viewApi.ts`, строки 41–51). Кроме того, `applyRecordToFrontmatter` меняет только frontmatter, не журнал/тело заметки (`src/lib/dataApi.ts`, строки 230–253).
- Поэтому синхронизация представлений без refresh есть, но вся сцена, включая достоверную запись и строку журнала карточки, не достигнута.

## 2. База из заметок — `PARTIAL`

- Добавление поля сразу добавляет его в in-memory schema, затем асинхронно запускает запись по идентификаторам всех текущих записей: `src/lib/viewApi.ts`, `addField`, строки 67–75.
- `DataApi.addField` получает все найденные файлы и выполняет `Promise.all(...)`, записывая ключ через `doAddField`: `src/lib/dataApi.ts`, строки 70–83; сам writer добавляет `[field.name]: value` во frontmatter, строки 256–271.
- Кнопка добавления колонки действительно формулирует, что поле создаётся «in every note»: `src/ui/views/Dashboard/widgets/DatabaseCall/TableHeader.svelte`, строки 96–102.
- Но `CreateFieldModal` немедленно вызывает `onCreate` и закрывается (`src/ui/modals/createFieldModal.ts`, строки 41–44); отдельного подтверждения с количеством файлов и обещанием сохранности существующих данных в этом пути нет.
- `ViewApi.addField` отбрасывает Promise через `void`, а `DataApi.addField` использует единый `Promise.all` без пофайлового результата или UI-обработки ошибки (`src/lib/viewApi.ts`, строки 67–75; `src/lib/dataApi.ts`, строки 75–82). При одной ошибке часть заметок уже изменена, но пользователь не получает перечень успешных/неуспешных записей.

## 3. Прозрачная двунаправленность — `PARTIAL`

- Редактирование ячейки Dashboard-таблицы вызывает `api.updateRecord(...)`: `src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte`, `handleCommitEdit`, строки 123–131; запись затем попадает в frontmatter через `processFrontMatter`: `src/lib/dataApi.ts`, `updateRecord`, строки 37–48.
- Внешняя Markdown-правка действительно возвращается в открытое представление через watcher → `dataFrame.merge`: `src/lib/filesystem/obsidian/filesystem.ts`, строки 151–160; `src/events.ts`, строки 40–55.
- Видимая подсказка заголовка — только строка ``${field.name} · ${field.type}``: `src/ui/views/Dashboard/widgets/DatabaseCall/TableHeader.svelte`, строки 69–85. Это не отображение соответствующей строки или секции Markdown.
- Открытие записи использует `workspace.openLinkText(record.id, record.id, false)`: `src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte`, `handleOpenRecord`, строки 133–136. Номер строки или frontmatter-ключ в вызов не передаётся.
- Поиск не выявил компонента preview заметки/подсветки строки в Dashboard-пути. Следовательно, обратная реактивность реализована, но требуемый прозрачный контракт и навигация на нужную строку отсутствуют.
- Это расходится с §4 `PRODUCT_RESET`: фактический механизм уже больше, чем «Gap», хотя пользовательский результат всё ещё неполный.

## 4. Связи Клиент → Сеансы → аналитика — `PARTIAL`

- Relation-конфигурация резолвит WikiLink к записям целевого проекта и добавляет производное поле `__resolved__<relation>`: `src/lib/engine/crossProjectResolver.ts`, `enrichFrameWithRelations`, строки 31–61.
- Rollup умеет вычислять значение по relation в другом frame: `src/lib/engine/crossProjectRollup.ts`, `computeCrossProjectRollup`, строки 91–122; `View.svelte` внедряет результаты в данные представления, строки 141–159.
- Связанный блок создаётся подсказкой только после ручного принятия: он получает `sourceConfig.projectId`, `sourceWidgetId` и `relationField`: `src/ui/views/Dashboard/dashboardSuggest.ts`, строки 34–49.
- Графики и cross-source scatter доступны, но корреляция настраивается ручными `leftKey/rightKey`, а не выводится из Relation: `src/ui/views/Dashboard/widgets/Chart/ChartConfig.svelte`, `setCorrelationEnabled`, строки 74–98; тип конфигурации — `ScatterChartConfig.correlation`, `src/ui/views/Dashboard/types.ts`, строки 451–468.
- Полный путь требует как минимум вручную создать relation, выбрать целевой проект/поле, настроить rollup, добавить связанный блок и настроить chart. Эти обязательные решения видны в `CreateField.svelte` (relation/rollup-конфигурация, строки 223–250 и 532–586) и `ChartConfig.svelte`.
- Нет кода, который при создании сеанса автоматически создаёт в карточке клиента список сеансов, count и график боли. Поэтому §4 устарел как «P0 gap»: составные механизмы есть, но сквозная сцена не доставлена.

## 5. Фильтр как кросс-база — `DIVERGED`

- Сохранённый фильтр хранится в `view.filter`: `src/ui/app/App.svelte`, `handleViewFilterPillsChange`, строки 80–91; он не имеет собственного `id`, имени, списка представлений или источника данных.
- Локальный Filter Tab хранит лишь `{field, value}` и фильтрует текущий `frame`: `src/ui/views/Dashboard/dashboardFilters.ts`, `ActiveFilterTab` и `applyFilterTab`, строки 10–13 и 48–60.
- «Save as global filter» только добавляет условие в уже существующий `FilterDefinition` view: `src/ui/views/Dashboard/dashboardFilters.ts`, `promoteFilterTabToGlobal`, строки 85–110; `FilterBridge.svelte` прямо называет его владельцем `view.filter`, строки 16–22 и 35–42.
- Существуют `subBases`, но они принадлежат `DataTableConfig` конкретного виджета (`src/ui/views/Dashboard/types.ts`, строки 216–245), а не являются новым проектом/источником, доступным другим view.
- Реактивное обновление самой текущей выборки есть, так как `View.svelte` применяет `applyFilter(enrichedFrame, viewFilter)` (`src/ui/app/View.svelte`, строки 141–159), но сущности «именованная живая база со своими представлениями» в модели нет.
- Реализация расходится с эссе по модели данных, а не только по UI; статус «частично» из §4 это по существу уже признаёт.

## 6. Проактивные вычисления — `PARTIAL`

- Rule engine содержит ровно два вида подсказок: `numeric-stats` и `relation-block`: `src/ui/views/Dashboard/smartSuggest.ts`, строки 16–26.
- Для первого числового поля предлагается только Stats-блок; условие — наличие `DataFieldType.Number` и отсутствие Stats: `computeSuggestions`, строки 37–52.
- Для Relation предлагается linked database block: там же, строки 54–68. Текст подсказок предлагает «sum and average» либо «show related records»: `src/ui/views/Dashboard/SmartSuggestionBus.svelte`, строки 40–57.
- «Не предлагать снова» хранится в `DatabaseViewConfig.dismissedSuggestions`: `src/ui/views/Dashboard/dashboardSuggest.ts`, `persistDismiss`, строки 25–31; разовое закрытие живёт лишь в состоянии компонента: `SmartSuggestionBus.svelte`, строки 32–38 и 84–92.
- Нет правил для роста к прошлому периоду, тренда/аномалий, частоты визитов, средней паузы или прогноза следующего обращения. Также FormulaBar явно отказался от визуального конструктора: `src/ui/views/Dashboard/widgets/FormulaBar.svelte`, строки 2–10.
- Это больше, чем обозначенный в §4 «Gap», но существенно уже набора проактивной аналитики из эссе.

## 7. Интуитивность и старт — `PARTIAL`

- Empty canvas даёт «Add data block» и восемь общих `WIDGET_TEMPLATES`, а не три стартовые пользовательские роли: `src/ui/views/Dashboard/WidgetGrid.svelte`, строки 56–78; шаблоны определены в `src/ui/views/Dashboard/widgetTemplates.ts`, `WIDGET_TEMPLATES`.
- Первичный onboarding предлагает только два действия — создать проект или открыть demo: `src/ui/app/onboarding/Onboarding.svelte`, строки 39–50. Demo — единый B2B Studio-проект, не «Клиенты / Тренировки / Дневник проекта»: `src/ui/app/onboarding/demoProject.ts`, комментарий и seed-модель, строки 1–14 и 62–100.
- DnD существует для перестановки Dashboard-виджетов: `src/ui/views/Dashboard/WidgetGrid.svelte`, строки 79–110, и для перестановки уже существующих столбцов: `src/ui/views/Table/components/DataGrid/GridHeader/GridHeader.svelte`, строки 21–83.
- Нет DnD «карточка на карточку» для создания relation. Ближайший жест — drop текстового file-link в ячейку, который просто оборачивает текст в `[[...]]`: `src/ui/views/Table/components/DataGrid/GridCell/GridFileCell/GridFileCell.svelte`, `handleDrop`, строки 45–65. Нет и перетаскивания поля из бокового списка в заголовок.
- Нагрузка конфигурацией не устранена: `ChartConfig.svelte` содержит до 24 интерактивных input/select-контролов в максимальной ветке (`src/ui/views/Dashboard/widgets/Chart/ChartConfig.svelte`, строки 136–397); `PipelineEditor.svelte` содержит 40 статических input/select/button-узлов, а добавляемые условия/колонки увеличивают это число (`src/ui/views/Dashboard/widgets/PipelineEditor.svelte`, строки 597–942).
- Поэтому §4 «Gap» устарел: zero state, шаблоны и частичные DnD уже существуют. Но эти механизмы не дают обещанной простоты и профилированного старта.

## 8. Дашборд как живой документ — `DIVERGED`

- Dashboard-конфигурация — объект `DatabaseViewConfig` с массивом виджетов, layout, таблицей, формулами и dismissals: `src/ui/views/Dashboard/types.ts`, строки 315–340.
- Изменение canvas передаётся как `onConfigChange`, а `DashboardCanvas.saveConfig` сохраняет объект конфигурации: `src/ui/views/Dashboard/DashboardCanvas.svelte`, `saveConfig`, строки 41–47; `App.mergeViewConfig` кладёт его в `view.config`: `src/ui/app/App.svelte`, строки 201–219.
- Settings сохраняются глобально через `Plugin.saveData(value)`: `src/main.ts`, строки 356–360. Сам код прямо идентифицирует хранилище как `data.json`: `src/main.ts`, строки 532–545.
- Формат JSON в целом читаем человеком, однако конкретный dashboard не является отдельным Markdown-файлом, не имеет Markdown-семантики и не имеет отдельного export/import-пути. Его перенос означает перенос/ручное редактирование общего plugin-state, включая project/view IDs.
- Это прямое расхождение с эссе. Статус §4 «Decision gap» фактически подтверждён, а не снят.

## Предлагаемые тикеты

- **P0 — Наблюдаемость и целостность массового создания поля.** Сейчас пользователь может получить частично изменённый vault без результата по каждому файлу; это риск скрытого расхождения между колонкой и Markdown.

- **P1 — Достоверность записи в представлениях.** Оптимистическое обновление `dataFrame` не имеет видимого исхода ошибки или компенсации; пользователь может видеть состояние, которое не сохранилось в заметке.

- **P1 — Прозрачный контракт колонки и Markdown.** Внешняя реактивность уже есть, но пользователь не может увидеть соответствующую строку frontmatter или открыть файл в нужной позиции; это оставляет двунаправленность непрозрачной.

- **P1 — Сквозной сценарий relation-аналитики.** Relation, rollup, linked block и charts существуют раздельно, но сценарий «Клиент → Сеанс → count → боль» не возникает как единый пользовательский результат.

- **P1 — Продуктовое решение по «фильтру как базе».** Текущая модель привязывает фильтры к view/виджету; без решения о самостоятельной сущности невозможно выполнить центральное обещание сцены 5.

- **P2 — Расширить проактивные подсказки до аналитики из эссе.** Текущие две подсказки не покрывают динамику, аномалии, паузы и прогноз; риск — назвать существующий Stats-блок «умной аналитикой».

- **P1 — Снизить конфигурационную плотность и закрыть прямые манипуляции.** Pipeline и chart-панели противоречат обещанию отсутствия «40 настроек», а ключевые DnD-жесты и профильные старты отсутствуют.

- **P2 — Явно принять или закрыть разрыв формата dashboard.** JSON в `data.json` не обеспечивает отдельный переносимый, версионируемый Markdown-документ; это архитектурное отклонение от исходного видения.

Codex session ID: 01a0420a-a7fe-7a53-a730-ee6636cb27b8
Resume in Codex: codex resume 01a0420a-a7fe-7a53-a730-ee6636cb27b8
