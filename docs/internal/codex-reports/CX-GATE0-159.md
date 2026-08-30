# Gate 0: не пройден

## Equivalence claims

| Claim | Verdict | Механизм опровержения / пробел |
|---|---|---|
| 1. `selection(B,F)` эквивалентен `B + subFilter(F)` | **false** | Это не один путь и не один порядок. `subFilter` проходит через `applyWidgetScope`: если все поля уже есть, фильтруется до C; если нет — намеренно откладывается до transform ([widgetScope.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/widgetScope.ts:36)). Значит фильтр по `_value`, `_group_size` или вычисленной колонке работает после C. Выборка, определённая как `applyFilter(frame(B), F)`, на сыром frame такого поля не имеет и даст иной результат, обычно пустой. Для linked source ещё хуже: `resolveDbCallView` отдаёт внешний frame напрямую, обходя transform; это известный разрыв ADR ([FILTER_ORDER_ADR.md](/C:/Users/Park/OBSv1.0/obs-projects-plus/docs/internal/FILTER_ORDER_ADR.md:84)). Общий evaluator не означает общего pipeline. |
| 2. Promote фильтра view в selection не меняет view | **unproven** | В коде нет ни сущности selection, ни операции promote, поэтому доказательства нет. Утверждение выжило бы только при точной, независимой копии всего `FilterDefinition` — включая `groups`, `conjunction` и disabled conditions — без замены/нормализации исходного `view.filter`. Это существенно: `View.svelte` уже реактивно чистит верхнеуровневые условия по полям текущего frame ([View.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:58)); нужно определить, что именно копируется и в какой момент. |
| 3. Membership пересчитывается ровно при изменении frame, потому что нет record ids | **false** | Отсутствие сохранённых ids не запрещает кэш. Реальный путь уже кэширует внешние frame: `App.svelte` держит `externalFrameCache`, Canvas хранит готовые `sourceStates`, а повторный preload запускается только при изменении набора ids либо `externalFrameInvalidation` ([App.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:96), [dashboardPreload.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardPreload.ts:157)). Кроме того, membership меняется и без изменения frame: `is-today`, `is-overdue`, rolling date ranges используют текущую дату в evaluator. Для relation/rollup membership меняется при загрузке или изменении внешнего frame, хотя сырой B не менялся. «Exactly when» неверно и без нового performance-кэша. |

## Q4 — создание записи в selection

Рекомендация «разрешить, когда все conditions выражаются значениями» пока не определена достаточно, чтобы быть безопасной.

- Простое копирование RHS условия в frontmatter часто создаёт запись, которая **не проходит** фильтр: `status is-not active`, `count gt 3`, `count lt 3`, `date is-after X`, `date is-before X`, `has-none-of [x]`, `not-contains x`. Граница для строгих сравнений сама не удовлетворяет условию.
- Unary и относительные условия не имеют стабильного «значения по умолчанию»: `is-empty`, `is-not-empty`, checked/unchecked, `is-today`, `is-overdue`, `is-last-n-days`, `is-upcoming`. Даже если запись видна сейчас, она может исчезнуть в полночь.
- Для `OR` не нужно и зачастую невозможно записать все условия; для противоречивых `AND` нет удовлетворяющего набора значений вообще. Нужен solver/satisfiability contract, а не признак «value-expressible».
- Relation-derived `__resolved__…`, rollup и любые transform-поля нельзя записать в заметку. `DataApi` прямо исключает derived fields из frontmatter ([dataApi.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dataApi.ts:233)).
- Даже удовлетворив F, запись может не попасть в базу: source project может быть folder/tag/native-query; `native-query.where`, Dataview-условия и template-content остаются дополнительными предикатами. `createDataRecord` умеет выставить folder/tag, но не доказывает membership произвольного query source.
- Создание через внешний source сейчас намеренно запрещено: блок читает чужой project, но имеет `api` и `project` родительского dashboard, поэтому external source read-only ([DatabaseCallBlock.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:81)). Для selection нужен source-specific write API, а не только defaults.

Следствие: правило должно быть не «все conditions value-expressible», а «система умеет построить и проверить запись, удовлетворяющую **всему** source predicate + selection predicate после фактической записи». Иначе честный UX — “Create in base”, без обещания появления в selection.

## Q6 — «selection это axis A»

Формулировка в брифе внутренне противоречива ADR.

ADR уже задаёт `enrich → A → C`, а `View.svelte` реально делает relation enrichment, затем rollup folding, и только потом `applyFilter` ([View.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:137)). Значит условие selection по rollup или `__resolved__relation` требует **не пересмотра ADR**, а явного определения selection resolver как потребителя обогащённого frame.

Если же selection резолвится как заявленное `applyFilter(frame(B), F)`:

- rollup-поле в raw frame отсутствует;
- relation-derived поле отсутствует;
- при ещё не загруженном external target `View.svelte` временно использует raw frame;
- membership становится временно пустым/другим и меняется при асинхронном enrichment.

Дополнительно linked-source path уже не соблюдает обещанную композицию: внешний frame получает backlinks, но не полный View-level relation/rollup enrichment; C вообще bypassed. Поэтому выборка как source не может просто занять «ось A» без отдельного, единого контракта: какой именно frame является базой selection и кто ждёт его зависимые frames.

## Q8 — «ничего не мигрирует, виды не меняются»

**false.** Не конвертировать `view.filter` в selection — разумное решение, но это не означает отсутствия миграции/изменения существующего поведения.

Предложенная замена `WidgetSourceConfig` с `{ projectId }` на tagged union ломает уже сохранённые external database-call widgets. Сегодня все потребители ожидают `sourceConfig.projectId`: preloader, resolver, picker и suggest path. Старый `{ projectId: "p" }` в новом union не содержит `kind/id`; новый `{ kind: "project", id: "p" }` не содержит `projectId`. Без compatibility adapter старый widget упадёт в parent-frame fallback через `sourceConfig?.projectId`, то есть покажет не тот источник.

Следовательно, нужен либо read-time normalizer старой формы, либо миграция сохранённых config. Это миграционная работа, даже если data.json не переписывается автоматически. Также нужно решить, как selection refs переживают deletion/rename source project и как отличить unavailable selection от empty result.

## Пропущенные вопросы — по цене ошибки

1. **Какой точный persisted schema и compatibility contract?** Где живут selections, как версионируются, как старые `{projectId}` source configs читаются, и что происходит с неизвестными ключами.
2. **Какой canonical frame определяет membership?** Raw source, enriched View frame, frame после rollups, и каковы условия готовности асинхронных relation targets.
3. **Каков lifecycle и invalidation contract?** Какие зависимости инвалидируют selection: source notes, target notes rollup/relation, schema, project settings, время, rename/delete; допустима ли временная stale/empty выдача.
4. **Как устроена запись через selection?** Откуда берутся корректные `ProjectDefinition` и `ViewApi`, как проверяется satisfiability, как обрабатываются templates/native queries и результат после записи.
5. **Что значит broken selection?** Deleted field, deleted relation target, invalid operator/value, source project gone, partial enrichment unavailable — и какие из них error, loading или empty.
6. **Как selection взаимодействует с source-level predicates?** Folder/tag/native-query/Dataview уже ограничивают базу; selection не является единственным фильтром membership.
7. **Какова семантика snapshot/copy при promote?** Deep copy или shared reference, включаются ли groups/disabled conditions, что происходит при дальнейшем редактировании view/filter/schema.
8. **Как selection references удаляются/сохраняются?** Deletion selection, deletion base, duplicate names, orphaned widget sources, undo/restore.
9. **Что разрешено relation model в v1?** Q7 deferred недостаточно: нужно явно запретить selection в picker/relation targets либо описать reference identity и порядок scope для relation resolution.
10. **Какие инвариантные тесты и ручной сценарий обязательны?** Минимум: C-derived filter, rollup/relation filter с delayed load, relative-date rollover, старый external source config, create success/failure, deleted field/source.

Codex session ID: 01a045fa-0e8c-73d2-aed6-96f6b044c653
Resume in Codex: codex resume 01a045fa-0e8c-73d2-aed6-96f6b044c653
