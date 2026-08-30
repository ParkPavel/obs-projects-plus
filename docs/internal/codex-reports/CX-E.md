# CX‑E — метааудит `main` @ `64863ed`

Режим read-only. Код и история подтверждают: проект в нескольких местах считает себя ближе к Vision, чем он есть; главный механизм — устаревшие статусы и незакрытые ручные гейты.

| Пункт | Статус | Ключевой вывод |
|---|---|---|
| 1. Статусы | DIVERGED | Документы называют ветки неслитыми, хотя их код уже в `main`. |
| 2. Источники истины | DIVERGED | Активные V2-документы сохраняют несовместимые модели Relation/видов; `AGENTS.md` и `CLAUDE.md` названы источниками, но в коммите отсутствуют. |
| 3. Отклонения от Vision | PARTIAL | JSON-конфиг и read-only linked source — осознанные компромиссы, но не сведены в единый актуальный product-contract. |
| 4. Порядок R0–R4 | PARTIAL | R1-код появился до R2, но R0 и ручная приемка R1 не закрыты; R2 завершён до них. |
| 5. Правило тикетов | PARTIAL | Правило заявлено, но формат тикета не содержит обязательных полей Vision-сцены и user outcome. |
| 6. Пользовательские гейты | CLAIMED-ABSENT | Автотесты есть, но обязательные OBStests smoke, скриншоты и Gate 3 отсутствуют. |

## 1. Статусные расхождения — DIVERGED

`CONTEXT.md:15–18` и `SESSION_REPORT_2026-08-27.md:3` утверждают, что `feat/116-filter-order-adr` не слита и `main` не затронут. Это неверно для аудируемого состояния: `64863ed` — merge-коммит с родителем `2b00b93`; ancestry также включает relation-first commits `2ed9903` и `d3a11e4`.

Код этих работ действительно присутствует в `main`: [`src/lib/relations/relationContract.ts:42`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationContract.ts:42) `validateLegacyLinkedSelection()` валидирует Relation против целевого проекта, а [`src/ui/views/Dashboard/widgets/WidgetHost.svelte:94`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHost.svelte:94) применяет её к linked selection.

`BACKLOG.md:152–190` одновременно помечает milestone как «pending merge», а #111 как `IN-PROGRESS`; это уже не соответствует коду на `main`. Обратное расхождение тоже есть: `BACKLOG.md:32` называет M-FILTER-CONSOLIDATION ACTIVE, хотя `CONTEXT.md:45–50` называет его COMPLETE, а [`WidgetHost.svelte:68–72`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHost.svelte:68) уже проводит A→C порядок через `applyWidgetScope()` и `executeTransform()`.

## 2. Двойные источники истины — DIVERGED

`CONTEXT.md:99–100` по-прежнему назначает `AGENTS.md`, `CLAUDE.md`, `DASHBOARD_V2_SPEC.md` и `UI_DESIGN_ARCHITECTURE.md` активными источниками. Но `AGENTS.md` и `CLAUDE.md` отсутствуют в дереве `64863ed`: commit `4e094ef` удалил их, а `SESSION_REPORT_2026-08-27.md:22–25` прямо сообщает, что конфигурация агентов больше не tracked. При этом [`src/__tests__/R0_7_configDrift.test.ts:60–81`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/__tests__/R0_7_configDrift.test.ts:60) корректно допускает отсутствие этих файлов в чистом клоне.

Активная UI-архитектура расходится с relation-first контрактом: `UI_DESIGN_ARCHITECTURE.md:37` называет `linkedSelection` V2-core для linked database, тогда как [`relationContract.ts:38–59`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/relations/relationContract.ts:38) определяет его как legacy-фильтр, валидный только поверх объявленного Relation. [`DatabaseCallBlock.svelte:115–133`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:115) подтверждает текущую модель: UI различает `relation`, `broken` и временный `canvas` filter.

`DASHBOARD_V2_SPEC.md:369,434` откладывает Timeline и drag-to-link в V3, хотя Vision требует их в сценах 1 и 7. Код соответствует отсрочке: [`widgetRegistry.ts:172–180`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/widgetRegistry.ts:172) хранит Timeline как `legacy`, а [`legacyMigration.ts:58–81`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/legacyMigration.ts:58) не имеет для него рабочего преемника. Graph вообще отсутствует в union [`types.ts:7–32`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/types.ts:7).

## 3. Отклонения от мандата, не сведённые в единое решение — PARTIAL

Vision, сцена 8, требует dashboard-as-Markdown. Фактический конфиг сохраняется через [`main.ts:356–360`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/main.ts:356) `settings.subscribe() → saveData()`, то есть в plugin `data.json`; [`DashboardView.onOpen()`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardView.ts:53) ещё и автоматически сохраняет мигрированный конфиг на открытии. `BACKLOG.md:1107–1129` фиксирует Option B — defer до V3, тогда как Product Reset всё ещё помечает сцену 8 как decision gap. Это известное отклонение, но его статус между источниками не согласован.

В Vision-сцене 4 создание и редактирование связанных записей — часть единого потока. Для external `database-call` это сейчас запрещено: [`widgetComponentRegistry.ts:143–158`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/widgetComponentRegistry.ts:143) передаёт `sourceReadOnly`, а [`DatabaseCallBlock.svelte:82–92,468–512`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:82) скрывает создание и передаёт `readonly` во все виды. #139 документирует безопасность этого компромисса, но в Product Reset нет отдельного решения, как он влияет на обещание «одна сущность в двух интерфейсах».

Подсказки также уже сознательно ограничены MVP: [`smartSuggest.ts:16–70`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/smartSuggest.ts:16) содержит только `numeric-stats` и `relation-block`; нет предложений по Date, тренду, аномалиям, частоте, паузе или прогнозу из сцены 6. `BACKLOG.md:989–1012` это частично оговаривает, но статус #059 `DONE` без постоянной маркировки MVP создаёт завышенное впечатление о покрытии Vision.

## 4. Порядок работ против R0–R4 — PARTIAL

История показывает правильное начало R1: #110 — 2026-07-18, `relationContract` — 2026-07-19; #112–#115 — 2026-08-22. Это отражено фактическим кодом relation flow: [`relationSetupController.ts:19–44`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/relationSetupController.ts:19) создаёт и предварительно проверяет relation setup.

Но R0 требовал ручного baseline-аудита Clients→Sessions до заявлений о readiness. Его артефактов нет: `MANUAL_TESTING_PIPELINE.md:154–161` содержит четыре незакрытых checkbox, а `docs/internal/screenshots/R1/` отсутствует.

R2/M-FILTER-CONSOLIDATION стартовал через час после R1-кода (#119 — 2026-08-22 21:12) и завершился до ручной приемки R1. Исключение записано лишь для запуска filter work перед R3/R4 (`CONTEXT.md:45–50`), но не отменяет R0 и R1 manual acceptance. Следовательно, порядок реализации формально близок к R1→R2, а порядок доказательства пользовательского результата — нет.

## 5. Правило приемки тикетов — PARTIAL

Правило есть: `PRODUCT_RESET_2026-07-18.md:§6` и `BACKLOG.md:7–10` требуют сцену Vision и проверяемый outcome. Но шаблон тикета в `BACKLOG.md:13–25` не имеет полей `Vision scene` и `user outcome`, поэтому его невозможно системно контролировать.

Механический разбор 127 заголовков `### #…` в текущем `BACKLOG.md` нашёл явную ссылку на сцену только в 20 секциях; 107 не содержат её. Даже #110–#115 (`BACKLOG.md:160–241`) не имеют явной ссылки вида «Vision scene 4», хотя #115 содержит пользовательский сценарий.

Код может подтверждать отдельные результаты — например, [`R1_clientsSessionsIntegration.test.ts:159–268`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/__tests__/R1_clientsSessionsIntegration.test.ts:159) проверяет backlinks и `composeEffectiveFilter()` — но это не заменяет проверяемый user outcome в карточке тикета.

## 6. Незакрытые пользовательские гейты — CLAIMED-ABSENT

#115 помечен `DONE` в `BACKLOG.md:232–241`, но прямо содержит оговорку `manual acceptance pending`. Обязательные действия — внешняя Markdown-правка, keyboard path и скриншоты — заданы в `MANUAL_TESTING_PIPELINE.md:130–161`, все чекбоксы пусты; каталога R1 screenshots нет.

Автоматический слой существует, но не доказывает UI-flow: `MANUAL_TESTING_PIPELINE.md:150–152` ссылается на Jest suite, а [`DatabaseCallBlock.svelte:115–124`](C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:115) показывает реактивную фильтрацию в коде. Пользовательское прохождение в Obsidian этим не подтверждено.

Gate 3 также не был выполнен: `SESSION_REPORT_2026-08-27.md:119–125`; merge commit `64863ed` подтверждает, что merge сделан по явной инструкции пользователя. Поэтому «merged» нельзя читать как «прошёл полный product acceptance».

## Предлагаемые тикеты

- **P0 — Провести и зафиксировать R0/R1 user acceptance в чистом OBStests vault.**  
  Причина: relation-first отмечен DONE при отсутствии обязательных screenshots, keyboard path и внешнего Markdown round-trip; это главный разрыв между кодом и пользовательским обещанием.

- **P1 — Синхронизировать статус `main`, milestone и branch во всех активных документах.**  
  Причина: `CONTEXT`, `BACKLOG` и session report описывают уже слитый код как pending/unmerged, из-за чего следующий исполнитель получает неверную исходную точку.

- **P1 — Утвердить единую иерархию product/UX источников и вывести старые V2-спеки из активного выбора работ.**  
  Причина: `UI_DESIGN_ARCHITECTURE` и `DASHBOARD_V2_SPEC` конфликтуют с relation-first и Vision, оставаясь в списке active sources.

- **P1 — Зафиксировать единое продуктовое решение по двум Vision-отклонениям: dashboard-as-file и external-source writes.**  
  Причина: оба компромисса имеют кодовые последствия, но их статус между Vision, Product Reset и backlog неодинаков.

- **P2 — Сделать ссылку на Vision-сцену и проверяемый user outcome обязательными полями product ticket.**  
  Причина: действующий шаблон не способен обеспечить правило §6; у 107 из 127 тикет-секций нет явной ссылки на сцену.

Codex session ID: 01a0420b-0c3b-7053-83c0-4d8dc820256a
Resume in Codex: codex resume 01a0420b-0c3b-7053-83c0-4d8dc820256a
