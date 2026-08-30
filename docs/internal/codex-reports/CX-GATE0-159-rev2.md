# Gate 0 — revision 2: verdict **REJECT**

## Equivalence claims

| Claim | Verdict | Why |
|---|---|---|
| Claim 1 | **Не подтверждён** | Правая сторона верна для обычного view: `View.svelte` делает `enrich → rollups → applyFilter`. Но resolver selection ещё не существует, поэтому доказать одинаковый frame и тот же evaluator нельзя. |
| Claim 2 | **Не подтверждён** | «Promotion» и его deep-copy пока только в brief; исполняемого пути и теста на сохранение `groups`, `conjunction` и disabled conditions нет. |
| Claim 3 | **Опровергнут текущим кодом** | При незагруженных external frames `View.svelte` временно фильтрует сырой/частичный frame, а не выдаёт `pending`. Кроме того, изменения external frame не являются реактивным входом для `View.svelte`. |

## 1. Claim 3 / Q3: enriched frame, pending и сырой frame

**Вердикт: fail.**

`View.svelte` прямо реализует противоположное обещанию Claim 3:

- При первой загрузке внешних кадров `externalFramesMap` пуст, и [`View.svelte:144-150`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:144) передаёт в rollups исходный `frame`. Затем [`View.svelte:153`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:153) применяет filter к этому сырому/необогащённому frame.
- Если загружена только часть зависимостей, relation enrichment происходит только для ready-кадров, а [`applyRollupColumns`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/rollupColumns.ts:85) просто пропускает rollup без target frame. Это именно усечённый результат, не `pending`.
- При повторной загрузке старый `externalFramesMap` не очищается до завершения async fetch. Значит между invalidation и ответом пользователь видит устаревшее обогащение, а не `pending`.
- `View.svelte` не подписан на `externalFrameInvalidation`: новая загрузка запускается лишь при изменении набора target IDs или локального `dataGeneration` ([`View.svelte:101-109`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:101)). Изменение заметки в целевом проекте очищает cache и двигает tick в [`App.svelte:99-118`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:99), но само view этого tick не наблюдает.

`dashboardPreload.ts` действительно имеет корректную различимость `loading | ready | unavailable | error` ([`dashboardPreload.ts:73-94`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardPreload.ts:73)). Но это решение действует для Dashboard/database-call; оно не используется в `View.svelte`. Следовательно, его нельзя засчитать как реализацию pending для selection.

## 2. Q3: отсутствующие входы в таблице invalidation

**Вердикт: таблица неполная и один из заявленных signal-path не покрывает нужное изменение.**

В таблице отсутствуют как отдельные inputs:

- **Сама selection и F:** изменение filter definition, отключение condition, изменение groups/conjunction, удаление selection или её base.
- **Source-level predicate base:** `dataSource` проекта, `excludedNotes`, folder/tag configuration, Dataview query и его canonical filter, native-query `where`, `sort`, `limit`. Это меняет состав базового frame без изменения note.
- **Конфигурация внешнего проекта:** его datasource/query, `excludedNotes`, field/relation/rollup configuration, а также доступность Dataview. Это меняет внешний frame или его схему.
- **Полное состояние зависимости:** не только «frame finishes loading», но `loading → ready`, `loading → unavailable`, `loading → error`, отмена/замена in-flight запроса, удаление/переименование target project.
- **Временная база вычисления:** timezone/DST, resume приложения после полуночи и точные границы rolling-date operators; не только абстрактный «Clock».
- **Результаты асинхронного индексатора/Dataview:** запись в vault уже завершена, но query result ещё нет.

Отдельно: комментарий в `App.svelte` обещает invalidation при settings mutations, но фактический key содержит только `id|name` ([`App.svelte:133-139`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:133)). Изменение `fieldConfig`, native-query или Dataview query внешнего проекта cache не инвалидирует.

## 3. Q4: verify-after-write всё ещё может соврать

**Вердикт: правило недостаточно определено. Нужны awaitable write outcome, свежий source query и явные состояния verification.**

Ложные результаты возможны в следующих случаях:

- **Оптимистическая запись / write failure — ложный успех.** [`ViewApi.addRecord`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:63) сначала добавляет запись в локальный `dataFrame` (если source её path включает), а затем запускает `createNote` через `void`, без await. Проверка по текущему frame может найти запись, хотя `createNote` или последующая frontmatter write затем упадёт.
- **Асинхронный индекс / Dataview — ложный отказ.** Файл уже записан, но Dataview или source frame ещё не пересчитан; свежий видимый frame не содержит запись. «Не состоит в selection» в этот момент означает лишь «индекс ещё не догнал».
- **Отложенное relation/rollup enrichment — ложный отказ или устаревший успех.** Проверка может увидеть raw frame, частичный frame или старое значение rollup; текущий `View.svelte` не способен сказать, что computed dependency pending.
- **Шаблон — ложный отказ при проверке candidate, а не persisted record.** [`DataApi.createNote`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dataApi.ts:145) сначала читает шаблон, затем накладывает values. Не заданные candidate-полями filter-relevant frontmatter значения из шаблона остаются и могут изменить membership. Проверять надо re-read финального файла, а не только созданный объект.
- **Native-query — ложный успех при проверке по `includes`/локальному frame.** `NativeQueryDataSource.includes()` проверяет лишь folder/tag source ([`datasource.ts:56-57`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/datasources/native-query/datasource.ts:56)); `WHERE` и `LIMIT` применяются только в `queryAll()` ([`nativeQuery.ts:105-125`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/datasources/native-query/nativeQuery.ts:105)). Поэтому оптимистически добавленная запись может «пройти» проверку, но не попасть в фактический query result из-за `where`, `sort` или `limit`.

## 4. Q8: read-time normalizer для `sourceConfig.projectId`

**Вердикт: не покрыто. Единой точки нормализации в текущем коде нет.**

Runtime-точки прямого чтения:

1. [`dashboardPreload.ts:34-35`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardPreload.ts:34) — формирует набор preload IDs.
2. [`linkedSourceState.ts:108`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/linkedSourceState.ts:108) — выбирает parent/loading/ready source.
3. [`WidgetHost.svelte:94`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHost.svelte:94) — валидирует linked selection.
4. [`DatabaseCallSettings.svelte:29`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte:29) — отображает выбранный source в settings panel.

Есть также тестовое чтение в `databaseCallSettings.test.ts`; comment в `linkedSourceState.ts` не является runtime-read.

Нормализация лишь внутри `resolveDbCallView` не защитит preloader, validation и settings panel. Единая точка возможна только как обязательная нормализация при decoding/hydration всех persisted widget definitions до их передачи любому consumer; такого ingress сейчас нет. Формулировка brief «at every read point» пока остаётся требованием, а не доказанным механизмом.

## Непокрытое до implementation tickets

- Формальная модель `pending` должна быть частью результата selection resolver, а не UI-оговоркой.
- Нужны version/token для source frame, каждого external dependency и clock boundary; stale frame нельзя считать current enriched frame.
- Verify-after-write должен возвращать минимум `verified-member | verified-non-member | pending-index | pending-dependency | write-failed`, а не boolean.
- Нужны tests: initial external load, partial dependency load, refresh после external vault change, stale-result race, template-derived membership, Dataview index lag, native `WHERE`/`LIMIT`, и legacy source config во всех четырёх runtime consumers.

Codex session ID: 01a045ff-4f16-7d52-be19-84340fd4198c
Resume in Codex: codex resume 01a045ff-4f16-7d52-be19-84340fd4198c
