Статический read-only аудит текущего дерева относительно CX-A (`64863ed`). `MET` ниже означает, что обещанный операционный результат теперь реализован при нормальной записи, а частичный отказ явно виден пользователю.

| Сцена | CX-A | Сейчас | Движение и причина |
|---|---:|---:|---|
| 1. Единая живая сущность | `PARTIAL` | `PARTIAL` | Реальная работа укрепила одиночную запись: откат optimistic state и Notice при ошибке — [viewApi.ts:75](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:75). Но образцовый Board-путь всё ещё использует `updateRecords` без компенсации — [viewApi.ts:137](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:137), а строка журнала в теле заметки по-прежнему не создаётся. |
| 2. База из заметок | `PARTIAL` | `MET` | Реальное закрытие прежнего разрыва: до действия UI показывает число затрагиваемых заметок и сохранность прежних значений — [CreateField.svelte:606](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateField.svelte:606); запись идёт через `allSettled` с учётом failed/missing — [dataApi.ts:95](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dataApi.ts:95), итог выводится пользователю — [viewApi.ts:157](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:157). |
| 3. Прозрачная двунаправленность | `PARTIAL` | `PARTIAL` | Реальная защита внешней Gallery от записи «в родительский проект» — [GalleryView.svelte:39](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Gallery/GalleryView.svelte:39). Но это сознательное ограничение D-3, не выполнение сцены; hover-preview соответствующего frontmatter и открытие на строке всё ещё отсутствуют. |
| 4. Клиент → Сеансы → аналитика | `PARTIAL` | `PARTIAL` | Реальная работа: rollup, созданный через UI, теперь вычисляется от target relation и попадает в frame — [rollupColumns.ts:50](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/rollupColumns.ts:50), [View.svelte:137](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:137). Но сквозной путь всё ещё требует ручного relation/rollup/linked block/chart, поэтому статуса не меняет. Есть новое противоречие интерфейса — ниже. |
| 5. Фильтр как кросс-база | `DIVERGED` | `DIVERGED` | В стеке удалена брошенная модель sub-base; legacy-данные только переносятся, но не исполняются — [types.ts:237](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/types.ts:237). Реальной сущности именованной выборки со своими view нет; M-SAVED-SELECTION всё ещё planned, а #159 — лишь in-progress brief — [BACKLOG.md:2931](/C:/Users/Park/OBSv1.0/obs-projects-plus/docs/internal/BACKLOG.md:2931). |
| 6. Проактивные вычисления | `PARTIAL` | `PARTIAL` | #155 перестал предлагать linked block для Relation без target, то есть устранил ложное обещание пустого блока — [smartSuggest.ts:54](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/smartSuggest.ts:54). Новых правил для роста, тренда, аномалий, частоты и прогноза нет; визуального конструктора формул нет. |
| 7. Интуитивность и старт | `PARTIAL` | `PARTIAL` | Улучшены честность создания проекта — [CreateProject.svelte:526](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/CreateProject.svelte:526) — и наблюдаемость ошибок demo. Но всё ещё два стартовых действия, не три профильных старта; ключевых DnD-жестов нет. |
| 8. Дашборд как Markdown-документ | `DIVERGED` | `DIVERGED` | Появился JSON backup перед миграцией конфигурации — [dashboardView.ts:83](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardView.ts:83). Это повышает восстановимость, но не делает dashboard отдельным переносимым Markdown-файлом. |

### 1) Реальная работа vs. «перестали обещать лишнее»

Единственное изменение статуса — сцена 2, `PARTIAL → MET`, — вызвано реальной работой: преддействующее сообщение с количеством заметок, пофайловый результат, обработка частичного отказа.

Остальные улучшения статуса не получили. В частности:

- D-3 (read-only внешний источник), #155 в сцене 6, тексты про источник/фильтр и D-6 — это главным образом честность интерфейса и границ; их нельзя считать продвижением к исходному обещанию.
- Rollup в сцене 4 и компенсация записи в сцене 1 — реальная работа, но недостаточная для смены статуса всей сцены.
- Удаление dead sub-base в сцене 5 — подготовка к будущей реализации, не прогресс выполнения vision.

Реестр из шести строк в целом не объявляет невыполненное выполненным: D-1/D-2/D-3/D-4 прямо фиксируют отклонение, D-5 говорит «Being closed», а правила требуют удалить строку только после выполнения в коде и именованного коммита — [VISION_DEVIATIONS.md:23](/C:/Users/Park/OBSv1.0/obs-projects-plus/docs/internal/VISION_DEVIATIONS.md:23). Но D-5 нельзя читать как готовность: фактическая реализация ещё не начата.

### 2) Сделал ли стек хуже / создал ли новое расхождение?

Да — новое, узкое расхождение в сцене 4. Реестр D-6 утверждает, что wizard «больше не обещает обратное», но UI одновременно:

- предлагает checkbox **“Create inverse property in schema”** — [RelationSetup.svelte:45](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:45);
- ниже сообщает, что свойство в другой базе **не создаётся** — [RelationSetup.svelte:50](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/modals/components/RelationSetup.svelte:50);
- фактически сохраняет только config исходной relation — [relationSetupController.ts:20](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/relationSetupController.ts:20).

Это не ухудшает саму модель derived backlink, но создаёт новое пользовательское ложное обещание и делает формулировку D-6 недостоверной. Сцена 5 не стала хуже по фактическому соответствию: удалённый sub-base не имел production-подключения; однако его удаление тем более не позволяет засчитать «being closed» как прогресс.

Codex session ID: 01a04614-abf0-7f43-8c2a-3e21fb99670c
Resume in Codex: codex resume 01a04614-abf0-7f43-8c2a-3e21fb99670c
