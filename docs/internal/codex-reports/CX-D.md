# CX-D — аудит «Подсказывает, а не требует»

Проверено состояние `main` на `64863edb83d82d19f8833300525df44c25437f33`. Режим read-only; изменений не вносилось. Эталон — сцены 6–7 `DASHBOARD_V2_VISION.md`.

| Пункт эталона | Статус | Фактический результат |
|---|---|---|
| Проактивные аналитические подсказки | PARTIAL | Есть только подсказки для числового и relation-поля. |
| Формулы «мышью из слов» | DIVERGED | Реализован текстовый редактор синтаксиса с autocomplete. |
| Первый результат и профили | PARTIAL | Демонстрационный результат доступен в один клик, но нет трёх обещанных стартовых путей и профилей. |
| Прогрессивное раскрытие / плотность настроек | PARTIAL | Нет единой модалки на 40 контролов, но Chart/Stats/Pipeline могут быть плотными и техническими. |
| Drag-to-link и drag-to-add-field | ABSENT | Есть DnD для порядка виджетов/колонок и прикрепления файла, но не для двух обещанных действий. |

## 1. Проактивные подсказки — PARTIAL

- Типы подсказок ограничены union из двух значений: `numeric-stats` и `relation-block`; правил для даты, тренда, аномалий, интервалов или прогноза нет: [smartSuggest.ts:16–17](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/smartSuggest.ts:16).
- `computeSuggestions()` находит первое `Number`-поле и предлагает Stats, если такого виджета ещё нет: [smartSuggest.ts:37–51](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/smartSuggest.ts:37). Сам Stats при пустой конфигурации создаёт count, sum и avg первого числового поля: [StatsWidget.svelte:41–59](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Stats/StatsWidget.svelte:41).
- Relation-подсказка предлагает связанный data block: [smartSuggest.ts:54–67](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/smartSuggest.ts:54). Но при relation без `targetProjectId` принятие добавляет обычный пустой `database-call`, а не связанный результат: [dashboardSuggest.ts:35–47](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSuggest.ts:35).
- Strip показан лишь на непустом редактируемом canvas: [DashboardCanvas.svelte:170–173](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/DashboardCanvas.svelte:170), а не в первоначальном zero state.
- Закрыть подсказку можно временно через × либо навсегда; постоянное закрытие сохраняется в `dismissedSuggestions`: [SmartSuggestionBus.svelte:76–92](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/SmartSuggestionBus.svelte:76), [dashboardSuggest.ts:25–30](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSuggest.ts:25).
- В итоге покрыта только первая треть сцены 6: сумма и среднее. Рост к периоду, динамика/тренд/аномалии, частота визитов, средняя пауза и прогноз следующего обращения кодом не генерируются.

## 2. Конструктор формул — DIVERGED

- Сам компонент прямо фиксирует решение: «No visual/node mode», «Code mode is the only mode»: [FormulaConstructor.svelte:10–18](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FormulaConstructor/FormulaConstructor.svelte:10).
- Ввод выполняется в нативный `textarea`; результатом являются синтаксические фрагменты `SUM(`, `AVG(`, `IF(` и т. п.: [FormulaConstructor.svelte:42–52](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FormulaConstructor/FormulaConstructor.svelte:42), [FormulaConstructor.svelte:221–245](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FormulaConstructor/FormulaConstructor.svelte:221).
- Есть click/keyboard autocomplete и snippets, но они только вставляют кодовые токены в textarea: [FormulaConstructor.svelte:273–338](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FormulaConstructor/FormulaConstructor.svelte:273), [FormulaConstructor.svelte:349–428](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FormulaConstructor/FormulaConstructor.svelte:349).
- Dashboard FormulaBar дополнительно требует вручную ввести имя поля и expression, затем применить его: [FormulaBar.svelte:79–111](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/FormulaBar.svelte:79).
- Следовательно, путь «среднее [боли] по [клиенту] за [30 дней]» не проходит мышью из предметных слов: пользователь должен освоить формульный синтаксис и собрать выражение сам. Это противоположно явному требованию эссе, а не просто неполное покрытие.

## 3. Первый опыт и шаблоны — PARTIAL

- При отсутствии проектов приложение открывает onboarding: [App.svelte:173–199](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:173).
- Первый экран содержит только два действия — «создать» и «попробовать демо»: [Onboarding.svelte:39–50](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/Onboarding.svelte:39). Третьего действия «Импортировать папку» нет.
- Путь «Try demo» требует одного пользовательского выбора: `createDemoProject()` записывает демонстрационные заметки и регистрирует проект с пятью готовыми представлениями: [demoProject.ts:474–505](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:474), [demoProject.ts:567–640](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/demoProject.ts:567). Реактивный выбор первого проекта и первого view происходит автоматически: [App.svelte:62–78](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:62).
- Поэтому «первый видимый результат» у демо-пути достижим без дальнейших решений, но статический код не доказывает SLA «≤5 минут».
- Профилей «Клиенты» / «Тренировки» / «Дневник проекта» в onboarding нет. Вне onboarding существуют приближённые widget-шаблоны `crm-clients` и `fitness-workout`, но нет дневника проекта: [widgetTemplates.ts:299–309](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgetTemplates.ts:299), [widgetTemplates.ts:460–468](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgetTemplates.ts:460). Они доступны из меню шаблонов dashboard, а не как стартовый выбор: [WidgetToolbar.svelte:75–89](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetToolbar.svelte:75).

## 4. Плотность настроек и прогрессивное раскрытие — PARTIAL

Контролы ниже посчитаны как редактируемые параметры; кнопки закрытия/добавления/удаления не включены.

| Панель | Количество | Наблюдение |
|---|---:|---|
| ChartConfig | 11 базовых; до 23 для scatter с correlation | Первые два раздела открыты сразу; корреляция вводит join-термины. |
| StatsConfig | `1 + 5 × карточка`, ещё `+1` для currency | При 4 карточках — 21 параметр. |
| ChecklistConfig | 6 | Компактно. |
| CoverBannerConfig | 5–6 | Компактно. |
| FilterTabsConfig | `2 + 2 × вкладка` | Растёт с числом ручных вкладок. |
| DatabaseCallSettings | 1–3 | Источник, master-block, relation-field. |
| PipelineEditor | 8 типов шагов + неограниченные параметры шагов | Явно обозначен как advanced surface. |

- Registry подтверждает, что основными конфигурационными поверхностями являются chart, stats, checklist, filter-tabs, database-call и cover-banner: [configPanelRegistry.ts:44–129](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/configPanelRegistry.ts:44).
- Chart держит 11 базовых контролов открытыми, включая шесть display toggles: [ChartConfig.svelte:131–278](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Chart/ChartConfig.svelte:131). Scatter/correlation добавляет до 12 контекстных контролов: [ChartConfig.svelte:280–405](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Chart/ChartConfig.svelte:280).
- Controls `Left join key`, `Right join key` и `Semantic groups` используют терминологию движка; рядом есть технический контекст, но нет предметного примера результата: [ChartConfig.svelte:215–222](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Chart/ChartConfig.svelte:215), [ChartConfig.svelte:366–403](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Chart/ChartConfig.svelte:366).
- Stats уже в подзаголовке использует `aggregation` и `post-pipeline`; при четырёх карточках содержит 21 редактируемое поле, не считая действий: [StatsConfig.svelte:99–205](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Stats/StatsConfig.svelte:99).
- Pipeline действительно вынесен в отдельную advanced surface и проговаривает смысл шагов на языке задачи с примерами: [PipelineEditor.svelte:110–139](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/PipelineEditor.svelte:110). Но количество шагов и их строк не ограничено, а Compute принимает синтаксис `fieldA + fieldB * 2`: [PipelineEditor.svelte:690–714](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/PipelineEditor.svelte:690).
- Формально модалки «на 40 настроек» не обнаружено; пользовательская проблема из эссе остаётся частично: сложность распределена по открытым панелям и неограниченному Pipeline, а не снята.

## 5. Прямые манипуляции — ABSENT

- Dashboard поддерживает DnD только для перестановки widget-ов: [WidgetGrid.svelte:19–20](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/WidgetGrid.svelte:19), [WidgetGrid.svelte:82](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/WidgetGrid.svelte:82).
- Relation в основной таблице создаётся click-ом через popover и `handleAdd()`, а не перетаскиванием карточки на карточку: [GridRelationCell.svelte:42–61](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Table/components/DataGrid/GridCell/GridRelationCell/GridRelationCell.svelte:42), [GridRelationCell.svelte:81–89](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Table/components/DataGrid/GridCell/GridRelationCell/GridRelationCell.svelte:81).
- Единственный drag-to-link создаёт WikiLink при drop текста в legacy file-cell; это не связь «карточка → карточка»: [GridFileCell.svelte:45–65](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Table/components/DataGrid/GridCell/GridFileCell/GridFileCell.svelte:45).
- Drag колонок служит только смене порядка уже существующих колонок: [GridHeader.svelte:23–30](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Table/components/DataGrid/GridHeader/GridHeader.svelte:23).
- Добавление свойства в актуальном Dashboard Table — кнопка `[+]`, ведущая в существующий flow создания поля: [TableHeader.svelte:4–6](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/TableHeader.svelte:4), [TableHeader.svelte:98–101](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/TableHeader.svelte:98). Drag field из бокового списка в заголовок отсутствует.

## Предлагаемые тикеты

- **P1 — Полный набор проактивных аналитических подсказок из сцены 6.** Сейчас пользователь получает только stats/relation; отсутствуют подсказки для динамики, тренда, аномалий, пауз и прогноза, то есть ключевая аналитическая ценность не достигается.

- **P1 — Предметный конструктор сложных вычислений без формульного синтаксиса.** Текущий UX явно выбрал code-only, что прямо расходится с обещанием «жесты и слова».

- **P1 — Прямое создание relation и колонки через drag & drop.** Оба базовых жеста сцены 7 отсутствуют; существующий DnD решает только перестановку интерфейса.

- **P2 — Онбординг с тремя стартовыми действиями и профилями из эссе.** Демо-путь хорош как быстрый пример, но не заменяет выбор «Клиенты» / «Тренировки» / «Дневник проекта» и не содержит «Импортировать папку».

- **P2 — UX-лимит для конфигурационных поверхностей.** Нужен проверяемый пользовательский outcome для Chart/Stats/Pipeline: какие параметры показываются сначала, какие термины обязаны иметь пример результата и при каком числе карточек/шагов конфигурация перестаёт быть прогрессивной.

Codex session ID: 01a0420a-e3fc-7602-856a-72129a1d66a5
Resume in Codex: codex resume 01a0420a-e3fc-7602-856a-72129a1d66a5
