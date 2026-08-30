Реконструкция выполнена для `main @ 64863ed`, без изменений. UI ниже — английские фактические строки из `en.json`/`defaultValue`. Важный вывод: сценарий из эссе не проходит до обещанного результата только через UI.

## Маршрут и экраны

Счёт ниже — только для контролов данного сценария, без Obsidian chrome и hover-иконок.

### 0. Пустой vault: onboarding

```text
Get started with Projects Plus

Projects Plus lets you manage groups of related notes using front matter.
For example, a folder with the blog posts you're working on.

---
status: Backlog
due: 2023-01-01
published: false
---

# My blog post

Start from scratch, or explore a demo project 👇

[Create new project]  [Try a demo project]

Psst! 👋 Next time you can create your projects using any of the following ways:
[Projects view] [Command palette] [File explorer]
```

Контролов: 5; обязательное решение для нужного маршрута: 1 — `Create new project`.

Откуда: [Onboarding.svelte:20](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/Onboarding.svelte:20), [строки локализации:1717](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/en.json:1717).

Действие: `Create new project`.

Что происходит на самом деле: модалка закрывается и открывается создание проекта; файлов и папок ещё нет ([App.svelte:176](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:176), [onboardingModal.ts:20](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/onboarding/onboardingModal.ts:20)).

Разрыв: из этого экрана нельзя создать папки `Clients` и `Sessions`. Для двух раздельных баз пользователь должен сначала создать их вне этого UI — иначе оба folder-project могут указывать лишь на root vault.

### 1. База «Clients»

```text
Create new project

Name                  [Untitled project]
Set as default         [off]
Data source            [Folder ▼]
Path                   [/]
Include subfolders     [off]

[Create project]
```

Контролов: 6; обязательных решений для базы `Clients`: 3 — имя, путь `Clients`, `Create project`. `Path` называет только источник: описание прямо допускает пустой путь как root.

Откуда: [CreateProject.svelte:421](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateProject.svelte:421), [CreateProject.svelte:504](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateProject.svelte:504), [en.json:89](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/en.json:89).

Действие: заполнить `Clients` и нажать `Create project`.

Что происходит на самом деле: в plugin settings добавляется проект с UUID и одним view `Dashboard`; проект не создаёт папку и не создаёт `.md` ([dataApi.ts:307](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dataApi.ts:307), [settings.ts:33](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/settings.ts:33)).

Разрыв: «Create project» создаёт конфигурацию, не базу файлов.

### 2. Пустой Dashboard клиентов

```text
[Widgets] [Schema] [Formulas]

Empty canvas
Start with a data block, or pick a ready-made template

[Add data block]
[Database V2 starter]
[Finance overview]
[Dashboard]
[Analytics]
[Kanban+]
[Fitness — workout log]
[Finance — accounting]
[CRM — clients]
```

Контролов: 12; обязательное решение: 1 — `Add data block` для буквального сценария. Шаблоны — альтернативы, но не подготавливают именно «Clients → Sessions».

Откуда: [DashboardToolbar.svelte:22](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/DashboardToolbar.svelte:22), [WidgetGrid.svelte:56](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/WidgetGrid.svelte:56), [widgetTemplates.ts:38](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgetTemplates.ts:38).

Действие: `Add data block`.

Что происходит на самом деле: в config Dashboard добавляется widget `Database`, но ни данных, ни табличного представления ему не назначается ([dashboardWidgets.ts:48](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardWidgets.ts:48)).

Разрыв: нет «создать базу из папки» или готового маршрута для двух связанных баз.

### 3. Новый data block клиентов

```text
Database (database)
[collapse] [Configure widget] [Widget menu] [Lock] [Remove]

No views configured

[Add first view]
```

Контролов сценария: 6; обязательное решение: 1 — `Add first view`.

После нажатия создаётся tab:

```text
[Table] [+]
[Filter]

No records yet

[Add first record]
```

Контролов контента: 3; обязательное: 1 — `Add first record`, если нужен клиент.

Откуда: [DatabaseCallBlock.svelte:364](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:364), [DatabaseCallBlock.svelte:460](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:460), [ViewTabBar.svelte:146](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/ViewTabBar.svelte:146).

Действие: создать `Ivan Petrov`/другого клиента.

Что происходит на самом деле: `Add first record` открывает только имя, проект и, при наличии, template:

```text
Create new note
Name     [Untitled]
Project  [Clients ▼]
[Create note]
```

Создаётся `Clients/Ivan Petrov.md`; затем frontmatter пишется через `DataApi` ([CreateNote.svelte:95](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateNote.svelte:95), [viewApi.ts:34](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:34), [dataApi.ts:324](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dataApi.ts:324)).

Разрыв: никаких полей клиента UI при создании записи не спрашивает.

### 4. База «Sessions»

Это повтор экрана 1 с фактическими значениями:

```text
Create new project
Name                  [Sessions]
Data source            [Folder ▼]
Path                   [Sessions]
Include subfolders     [off]
[Create project]
```

Контролов: 6; обязательных решений: 3 — имя, путь, создание. Затем снова нужны `Add data block` → `Add first view`.

Разрыв: папка `Sessions` также не создаётся. Для самого графика нужно вручную создать schema-поля `date` (Date) и `pain` (Number), хотя сценарий не предлагает их как шаг.

### 5. Relation `client` в Sessions

В `Schema` сначала виден пустой экран:

```text
Project schema

No fields defined yet.

Append a new property to this project.
[+ Add field]

[Close]
```

Контролов: 2; обязательный: `Add field`.

Откуда: [Schema.svelte:159](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/Schema.svelte:159).

В `Create new field` пользователь видит:

```text
Name           [New field]
Type           [Relation ▼]
Default value  This type is computed or linked — no default value to set here.

Target project
Records linked through this field will resolve against this project.
[Clients ▼]

Display field (optional) [e.g. title]
[Link database…]
[Create field]
```

Контролов: 7; обязательные решения: 4 — имя `client`, тип `Relation`, `Clients`, `Create field`. `Display field` и `Link database…` необязательны.

Откуда: [CreateField.svelte:360](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateField.svelte:360), [CreateField.svelte:495](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateField.svelte:495), [en.json:348](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/en.json:348).

После создания поля надо открыть ячейку `client` сеанса:

```text
[Search records…]
No linked records yet

Ivan Petrov
[Cancel]
```

При нескольких целях — checkbox у каждой, счётчик выбранных, `Done` и `Cancel`; пока frame цели грузится, вместо списка виден `…`; при пустой цели — `No records to link` ([RelationPickerPopover.svelte:95](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:95)).

Что происходит на самом деле: ячейка записывает `client: "[[Ivan Petrov]]"` в frontmatter сеанса ([EditableCell.svelte:105](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/EditableCell.svelte:105), [viewApi.ts:41](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:41)).

Разрыв: Relation — только декларация и запись WikiLink; само появление обратного поля в schema клиента не гарантировано.

### 6. Попытка «Create inverse property in schema»

Альтернативная кнопка `Link database…` открывает:

```text
Link property to database
Values stay as WikiLinks in Markdown. Preview makes no changes.

Property   [client]
Database   [Clients ▼]
Display field [e.g. title]
[x] Create inverse property in schema
Inverse property name [sessions]

The inverse property will only be declared after saving.
Existing notes are not rewritten.

Matched: 0; Not found: 0; Ambiguous: 0.

[Cancel] [Save relation]
```

Контролов: 7 при включённом inverse; обязательных для inverse: 5 — property, database, checkbox, inverse name, save.

Откуда: [RelationSetup.svelte:20](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:20), [relationSetup.ts:29](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationSetup.ts:29), [en.json:1772](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/en.json:1772).

Промежуточные/ошибочные состояния:

- пустой database: `Choose a database to link.`;
- пустое inverse name: `An inverse property name is required.`;
- в preview выводятся только три суммарных счётчика;
- если внешний frame не загрузился, preview вообще не рисуется.

Что происходит на самом деле: Save сохраняет `targetProjectId` и `inverseFieldName` в project field config; показывает `Relation saved.` ([relationSetupController.ts:20](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/relationSetupController.ts:20)). При последующем редактировании `client` runtime пытается написать inverse WikiLink.

Разрыв: UI обещает «Create inverse property in schema», но Save не добавляет поле в schema целевого проекта. Если frontmatter `sessions` в карточке клиента заранее отсутствует, writer возвращает `inverse-field-missing`, а вызывающий код результат игнорирует — пользователь не увидит ошибку ([relationsWriter.ts:96](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationsWriter.ts:96), [viewApi.ts:113](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:113)).

### 7. Rollup «Количество сеансов»

На Clients надо вручную создать отдельное Relation-поле `sessions` с target `Sessions` — иначе экран rollup останавливается на:

```text
This project has no Relation fields yet.
Create one first to enable rollups.
```

Откуда: [CreateField.svelte:532](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateField.svelte:532), [en.json:362](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/stores/translations/en.json:362).

После такого поля доступен экран:

```text
Create new field
Name           [Number of sessions]
Type           [Rollup ▼]
Default value  This type is computed or linked — no default value to set here.

Through relation   [sessions ▼]
Aggregate field    [date ▼]
Function           [Count ▼]

[Create field]
```

Контролов: 7; обязательных решений: 5 — name, type, relation, aggregate field, function/create. Термин движка неизбежен: фактическая подпись — `Through relation`; далее `Aggregate field`, `Function`.

Откуда: [ConfigureField.svelte:750](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/ConfigureField.svelte:750), [ConfigureField.svelte:800](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/ConfigureField.svelte:800).

Разрыв критический: UI вычисляет target project из Relation только для списка полей, но сохраняет rollup без `targetProjectId`. Рендер Dashboard считает rollup лишь когда `rollupCfg.targetProjectId` задан. Поэтому экран выглядит как настроенный (`Count(date) via sessions`), но колонка не вычисляется ([ConfigureField.svelte:416](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/ConfigureField.svelte:416), [View.svelte:153](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:153)).

### 8. Связанный блок сеансов

На Dashboard клиентов добавляется второй `Database`, затем `Configure widget`:

```text
Data Source
Load data from a different project instead of the current view.

Source project  [Sessions ▼]
By default the block shows this view's records. Pick another project to show its data instead.

Link to block   [Database ▼]
Without a link the block shows all records. With a link it shows only records
related to the chosen block.

Filter by field [client ▼]
```

Контролов: 3 select; обязательных решений: 3 — source `Sessions`, master block клиентов, `client`.

Откуда: [DatabaseCallSettings.svelte:55](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:55), [DatabaseCallSettings.svelte:95](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:95).

Промежуточные/ошибочные состояния блока:

```text
Loading the linked project…
Linked project unavailable
The project this block reads was not found: <id>
Could not load the linked project
<runtime error message>
```

После выбора строки клиента через row menu `Filter linked blocks by this row`:

```text
Filtered by relation
[Table] [+]
[Filter]
<только сеансы, у которых client совпал с выбранным клиентом>
```

Откуда: [DatabaseCallBlock.svelte:338](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:338), [DatabaseCallBlock.svelte:398](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:398), [TableRow.svelte:64](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte:64).

Разрыв: блок чужого проекта read-only. В нём нельзя создать или редактировать session; это намеренно отключено, потому что родительский API иначе записал бы файл не в тот project ([DatabaseCallBlock.svelte:82](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:82), [widgetComponentRegistry.ts:143](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/widgetComponentRegistry.ts:143)).

### 9. Chart боли

Chart можно добавить лишь в Dashboard `Sessions`: Chart не имеет выбора source project. Сразу после добавления:

```text
Chart (chart)

Chart is not configured

[Configure]
```

Контролов: 1; обязательный: `Configure`.

После Configure:

```text
Data
Chart Type       [Line ▼]
X Axis           [date ▼]
Group dates by   [Day | Week | Month | Quarter | Year ▼]
Y Axis           [pain ▼]
Aggregation      [Average ▼]
Sort By          [Label ▼]
Height           [Medium ▼]

Display
[x] Show grid
[x] Show labels
[x] Show values
[ ] Show legend
```

Контролов: 11; обязательные решения для графика боли: 5 — тип `Line`, `date`, `pain`, aggregation, height/сохранение происходит мгновенно. Терминов `join key` тут нет; он появляется только в Scatter → `Correlate with another source`: `Left join key (this source)` и `Right join key (right source)` ([ChartConfig.svelte:131](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Chart/ChartConfig.svelte:131), [ChartConfig.svelte:371](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Chart/ChartConfig.svelte:371)).

Состояния графика:

```text
No data
```

или, при одном значении X:

```text
⚠ All records share the same value of 'date' — the chart shows only one category.
Add variety to your data or change the X field.
```

Откуда: [ChartWidget.svelte:137](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte:137).

Разрыв: получившийся line chart строится по текущему frame Sessions, то есть по всем сеансам. Selection клиента фильтрует Database block, но не Chart; автоматического графика «сеансы Ивана» нет.

## Карточка клиента

Единственная отдельная «карточка» в коде — YAML Visualizer активной заметки:

```text
Ivan Petrov
Clients/Ivan Petrov.md

[Show hidden] [Reset overlay] [+ Add relation]

<ключи и значения frontmatter клиента>

LINKED FROM
No notes link here yet.
```

При индексируемой ссылке:

```text
LINKED FROM
Session 2026-08-27    via client
```

Откуда: [VisualizerPane.svelte:335](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/VisualizerPane/VisualizerPane.svelte:335), [VisualizerPane.svelte:524](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/VisualizerPane/VisualizerPane.svelte:524).

Видно: basename и путь клиента, его frontmatter, имя сеанса, откуда пришла ссылка (`via client`). Не видно: таблица сеансов, даты, pain, амплитуда, rollup, число связей или график. Более того, default inverse index ищет только ключ `links`, а не `client`, так что для данного Relation даже строка `Session … via client` по умолчанию не появится ([inverseIndexStore.ts:43](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/inverseIndexStore.ts:43)).

## Итог

- Экранов/состояний в минимальном маршруте: 10 основных, плюс 6 обязательных empty/loading/error состояний.
- Минимум обязательных решений: 25, включая создание двух внешних папок, schema-поля `date`/`pain`, relation и chart.
- Мест с непредсказуемой без документации терминологией: 4: `Relation`, `Rollup`, `Through relation`, `Function`; дополнительно `Data pipeline`/`join key` доступны в продвинутых настройках.
- До «связанный список сеансов» можно дойти вручную.
- До «Количество сеансов» и автоматически отфильтрованного графика боли — нет, несмотря на видимые конфигурации.

## ЧЕГО НЕ ВИДНО

- Создал ли UI реальные папки: нет, он хранит только путь в settings.
- Удалась ли запись поля или inverse relation: ошибки inverse writer не выводятся пользователю.
- Почему Relation не совпала: preview показывает лишь `Matched / Not found / Ambiguous`, без причин и строк.
- Почему rollup пуст: UI не показывает, что `targetProjectId` отсутствует в сохранённом rollup config.
- Что внешний linked block read-only и почему: кнопки создания/редактирования просто исчезают.
- Какой именно клиент сейчас управляет `Filtered by relation`: label не показывает имя выбранной записи.
- Какие записи исключили filter/pipeline/selection: при `No matches` причина не раскрыта.
- Что chart строится по всем Sessions, а не по выбранному клиенту.

Codex session ID: 01a04220-55f1-7dd3-9fdb-d317771cb6c3
Resume in Codex: codex resume 01a04220-55f1-7dd3-9fdb-d317771cb6c3
