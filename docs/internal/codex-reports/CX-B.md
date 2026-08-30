# CX-B — аудит Relation-first на `main` / `64863ed`

Срез проверен в read-only. Вердикт: утверждение о единственной модели связи **не подтверждается**. На runtime сосуществуют как минимум четыре активные семантики связи; Relation-контракт покрывает только одну из них.

| Пункт | Статус | Вывод |
|---|---|---|
| Каноничность Relation | `DIVERGED` | `RelationFieldConfig` + `relationContract` есть, но не является единственным владельцем смысла связи. |
| WikiLink-резолвер | `PARTIAL` | Базовый parser централизован, но есть отдельные relation-парсеры и самостоятельные резолверы. |
| `linkedSelection` | `PARTIAL` | Валидирует declared Relation, но фильтрует по самостоятельной строковой семантике и при ошибке переключается на canvas-filter. |
| Cross-source correlation / Join | `DIVERGED` | Связывает записи по произвольным полям, минуя Relation и `RelationDefinition`. |
| Полнота Relation-фичи | `PARTIAL` | Создание/редактирование/клавиатура/реактивность есть; inverse, related records, rollup и состояния цели не достигают результата эссе. |
| Rename/delete цели | `PARTIAL` | Реестр записей обновляется, но целостность и пользовательское состояние ссылок не обрабатываются. |

## 1. Фактически действующие модели связи

`Relation` как объявленная связь: источником правды служат WikiLink в frontmatter и `RelationFieldConfig`; `adaptRelationFieldConfig()` переводит конфиг поля в `RelationDefinition`, а `resolveRelationValue()` выдаёт `resolved` / `unmatched` / `ambiguous`. См. `src/lib/relations/relationContract.ts`, `adaptRelationFieldConfig()` строки 61–76 и `resolveRelationValue()` строки 98–114.

Ручная связь Visualizer — отдельная модель: она хранится в произвольном YAML-ключе, по умолчанию `links`, без `RelationFieldConfig` и target-project. См. `src/lib/visualizer/relations.ts`, `DEFAULT_RELATION_KEY` строка 23, `readRelations()` строки 52–67; запись идёт через `appendRelationToFile()` в `src/lib/visualizer/relationsWriter.ts:28–40`.

`linkedSelection` владеет отдельной конфигурацией `{ sourceWidgetId, relationField }`, то есть описывает связь widget→widget, а не `RelationDefinition`. См. `src/ui/views/Dashboard/types.ts`, `LinkedSelectionConfig` строки 91–99.

Join и scatter-correlation хранят ещё одну связь: `rightSourceId` плюс пару `leftKey/rightKey`; она допускает любые поля и не читает Relation-конфиг. См. `src/lib/dashboard-engine/transformTypes.ts`, `JoinStep` строки 116–128, и `src/ui/views/Dashboard/types.ts:461–468`.

Отдельно существует `crossSubBase.ts` с собственным индексом и резолвером, но production-импортов его экспортов нет: файл сейчас не образует пользовательский путь. Его семантика всё равно расходится с контрактом: `resolveTargets()` молча отбрасывает неразрешённые ссылки. См. `src/lib/relations/crossSubBase.ts:45–55, 89–104`.

## 2. `relationContract.ts` не является единственным резолвером WikiLink

Позитивная часть: канонический parser WikiLink действительно выделен в `src/lib/engine/wikilink.ts`: `parseWikilink()`, `extractWikilinks()` и `stripToPath()` на строках 44–89. `relationContract` использует его в `extractRawLinks()`: `src/lib/relations/relationContract.ts:132–142`.

Но `parseRelationLinks()` снова содержит собственный regex `WIKILINK_RE` и правила comma-splitting; эти правила не совпадают с `relationContract`, который трактует обычную строку целиком через `stripToPath()`. См. `src/lib/relations/parseRelationLinks.ts:18, 32–58` против `src/lib/relations/relationContract.ts:132–142`.

`relationsWriter.ts` также имеет локальный `stripWikiLink()` и собственный `resolveFile()` через `metadataCache.getFirstLinkpathDest`, не пользуясь `relationContract`. См. `src/lib/relations/relationsWriter.ts:71–83, 130–140`.

Следствие: единый синтаксический kernel есть, но единый relation-resolution contract отсутствует. При ambiguous-ссылке контракт возвращает статус, а `crossSubBase.resolveTargets()` выбирает одно значение в `Map` и отбрасывает отсутствие цели без статуса. См. `src/lib/relations/relationContract.ts:103–114` и `src/lib/relations/crossSubBase.ts:45–55, 94–103`.

## 3. `linkedSelection` объясняет связь только частично

Перед применением Dashboard валидирует, что поле действительно `Relation`, имеет конфиг и ведёт в master-project; статусы: `missing-relation`, `invalid-field`, `wrong-target-project`. См. `validateLegacyLinkedSelection()` в `src/lib/relations/relationContract.ts:42–59` и вызов в `src/ui/views/Dashboard/widgets/WidgetHost.svelte:87–95`.

При валидной конфигурации UI показывает лишь обобщённое `Filtered by relation`, при невалидной — `Relation broken: <status>`; конкретная relation, target и причина неразрешённой WikiLink не показываются. См. `src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:127–133, 398–412`.

Само сопоставление не вызывает `resolveRelationValue()`: `filterByLinkedSelection()` нормализует строку через `parseRelationLinks()` / `canonicalLinkKey()` и передаёт синтетическую запись в filter engine. См. `src/ui/views/Dashboard/widgets/DatabaseCall/relationFilterAdapter.ts:68–90`.

Если Relation невалидна, `composeEffectiveFilter()` пропускает relation-condition, но всё ещё добавляет обычный canvas-condition по имени поля. См. `src/ui/views/Dashboard/canvasSelectionStore.ts:250–274`. Это создаёт иной результат фильтрации вместо явного отсутствия relation-пути.

## 4. Cross-source correlation — параллельная семантика, не Relation

Scatter-correlation строит hash-index правого источника по `joinKey(rightKey)` и ищет совпадения по `joinKey(leftKey)`; `RelationFieldConfig` и `relationContract` не участвуют. См. `computeScatterData()` в `src/lib/dashboard-engine/chartDataPipeline.ts:247–290` и `joinKey()` в `src/lib/dashboard-engine/joinKey.ts:20–38`.

При нескольких совпадениях scatter берёт только первое; при отсутствии — молча пропускает левую запись. См. `src/lib/dashboard-engine/chartDataPipeline.ts:264–273`. Это не поведение `ambiguous` / `unmatched` Relation-контракта.

Общий pipeline Join тоже соединяет произвольные поля: inner-join удаляет unmatched строки, left-join оставляет их с `null`; при множественных совпадениях возможны разворачивание строк или агрегация. См. `executeJoin()` в `src/lib/dashboard-engine/transformExecutor.ts:1077–1089, 1131–1156`.

У scatter есть честная пользовательская диагностика отсутствующего источника, нуля или малого числа совпадений. См. `src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte:90–102, 153–171`. Это снижает риск, но не превращает join в Relation и прямо расходится с relation-first мандатом эссе, сцена 4 (`docs/internal/DASHBOARD_V2_VISION.md:55–71`).

## 5. Покрытие восьми свойств Relation

| Свойство | Статус | Доказательство из кода |
|---|---|---|
| Создание | `DELIVERED` | `createRelationSetupController.save()` создаёт Relation-поле и сохраняет config: `src/ui/views/Dashboard/relationSetupController.ts:20–32`. |
| Редактирование | `DELIVERED` | Picker записывает `[[…]]`, DataTable вызывает `api.updateRecord()`: `RelationPickerPopover.svelte:69–81`; `DataTableContent.svelte:123–131`. |
| Обратная связь | `PARTIAL` | Writer существует, но требует уже существующее inverse-поле и возвращает ошибку: `relationsWriter.ts:95–126`. |
| Related records | `PARTIAL` | Есть backlink-enrichment одного frame и receiver-фильтр, но нет автоматического Client → Sessions-представления из эссе: `relationResolver.ts:191–245`; `DatabaseCallBlock.svelte:115–152`. |
| Rollup | `PARTIAL` | Cross-project rollup вычисляется только по явно настроенному `RollupFieldConfig`, а не автоматически как «Количество сеансов»: `crossProjectRollup.ts:91–122`; `View.svelte:145–176`. |
| Unmatched state | `PARTIAL` | Setup-preview считает resolved/unmatched/ambiguous, но обычный resolver просто исключает неразрешённые цели: `RelationSetup.svelte:50–53`; `relationContract.ts:117–125`. |
| Клавиатурный путь | `DELIVERED` | Relation-cell доступна по Tab/Enter, picker принимает Enter/Escape: `EditableCell.svelte:76–110`; `RelationPickerPopover.svelte:84–92`. |
| Реактивность Markdown | `DELIVERED` | Изменения файлов обновляют `dataFrame`; inverse-index слушает metadata changes/deletes: `events.ts:40–55`; `inverseIndexStore.ts:91–104`. |

Ключевой дефект inverse: UI обещает «Create inverse property in schema», однако контроллер сохраняет только source-project config. См. `src/ui/modals/components/RelationSetup.svelte:43–48` и `src/ui/views/Dashboard/relationSetupController.ts:20–32`.

Далее `adaptRelationFieldConfig()` всегда задаёт `createIfMissing: false`, а `fireInverseRelations()` передаёт именно это значение writer’у. См. `src/lib/relations/relationContract.ts:61–76` и `src/lib/viewApi.ts:100–126`. Поэтому новая inverse-связь не создаёт отсутствующее поле цели, а ошибка writer’а не выводится пользователю.

## 6. Переименование и удаление файла-цели

На rename/delete watcher обновляет или убирает запись активного `dataFrame`, но не выполняет relation-specific rewrite, revalidation или показ повреждённой ссылки. См. `src/events.ts`, `onRename()` строки 17–25 и `onDelete()` строки 28–37.

При удалённой цели `resolveRelationValue()` способен вернуть `unmatched`, но `resolvedRecords()` исключает такую цель из результата. См. `src/lib/relations/relationContract.ts:110–125`. Ссылка в Markdown этим путём не меняется.

Если затем меняется forward-relation с inverse-config, writer вернёт `target-not-found`; результат агрегируется в `RelationWriteOutcome.issues`, но единственный production-вызов в `fireInverseRelations()` не читает outcome. См. `src/lib/relations/relationsWriter.ts:19–30, 91–93, 152–162` и `src/lib/viewApi.ts:113–126`.

Реактивный inverse-index после delete действительно перестраивается, но он обслуживает ручной ключ `links`, а не все declared Relation-поля. См. `src/lib/relations/inverseIndexStore.ts:47–79, 91–104` и `src/lib/relations/inverseIndex.ts:102–127`.

## Предлагаемые тикеты

- **P1 — «Relation: честная обратная связь и обратная связь без скрытых отказов»**  
  UI обещает inverse-property, но код требует заранее существующее поле и скрывает `target-not-found` / `inverse-field-missing`. Цена ошибки — пользователь считает связь двунаправленной, хотя карточка цели остаётся неполной.

- **P1 — «Relation: состояние ссылки при rename/delete цели»**  
  Сейчас обновляется индекс записей, а не пользовательское состояние relation. Цена ошибки — ссылки исчезают из related/rollup-результатов без объяснения, особенно рискованно для сценария «Клиент → Сеансы».

- **P1 — «Зафиксировать границу Relation и field-join/correlation»**  
  Join и scatter создают независимые связи по полям, включая выбор первой из нескольких целей. Цена ошибки — одинаково выглядящие связи имеют разные правила точности и unmatched/ambiguous поведения.

- **P2 — «`linkedSelection`: показывать применяемую relation и не маскировать поломку fallback-фильтром»**  
  Валидность конфигурации проверяется, но фактическое сопоставление строковое, а при поломке остаётся generic canvas-filter. Цена ошибки — пользователь не может установить, какая именно связь сузила результат.

- **P2 — «Единая семантика relation-parsing и resolution»**  
  В коде есть отдельные parser/resolver-пути (`parseRelationLinks`, Visualizer writer, `crossSubBase`). Цена ошибки — alias, comma-значения, ambiguity и отсутствие цели дают различный результат в разных представлениях.

Codex session ID: 01a0420a-b83d-7bc1-96b3-76986da65ea9
Resume in Codex: codex resume 01a0420a-b83d-7bc1-96b3-76986da65ea9
