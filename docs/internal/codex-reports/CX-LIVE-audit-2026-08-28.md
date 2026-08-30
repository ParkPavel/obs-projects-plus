# Вердикты

| Пункт | Вердикт |
|---|---|
| 1. Команды | Подтверждено: в [src/main.ts](C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:174) ровно 10 вызовов `addCommand`. Список: `show-projects`, `create-project`, `create-note`, `open-schema`, `add-field`, `toggle-visualizer-pane`, `open-visualizer-for-file`, `add-relation`, `open-formula-editor`, `create-demo-project`. Другой команды незаметно не пропало; `add-sub-base` удалена. Документ устарел: всё ещё требует 11 и перечисляет её. |
| 2. Демо | Это дрейф документации, не регресс генератора: [demoProject.ts](C:\Users\Park\OBSv1.0\obs-projects-plus\src\ui\app\onboarding\demoProject.ts:270) действительно создаёт для «Обзора» `stats + chart + 4×database-call`. Раздел 3 MANUAL_TESTING_PIPELINE с `2×database-call` устарел. Там также устарело `Клиенты: stats + data-table`: исходник теперь создаёт `stats + database-call`. |
| 3. REST roundtrip | Наблюдение подтверждает PUT/GET/DELETE и сохранение frontmatter для этой заметки. Это успешный API-контракт. |
| 4. #118 и backup | Поведение миграции подтверждено для корректно заданного кейса `widget.transform.steps`: ведущий enabled/non-empty `filter` переносится в `widget.config.subFilter`, а хвост, включая `sort`, остаётся в `transform.steps`. Backup задуман и в нормальном потоке формируется из до-миграционной конфигурации, но само наличие двух файлов этого не доказывает без чтения их поля `config`. |

# Миграция и backup

В [dashboardView.ts](C:\Users\Park\OBSv1.0\obs-projects-plus\src\ui\views\Dashboard\dashboardView.ts:59) `preMigrationConfig` захватывается до обоих преобразований. Затем мигрированная конфигурация сохраняется, и только после этого запускается `writeMigrationBackup(... config: preMigrationConfig)`.

Сама #118 в [legacyMigration.ts](C:\Users\Park\OBSv1.0\obs-projects-plus\src\ui\views\Dashboard\widgets\legacyMigration.ts:163) действует консервативно:

- распознаёт только `step.type === "filter"`;
- только ведущие шаги;
- только не-disabled и с непустым `conditions.conditions`;
- сохраняет хвост через `steps.slice(filterCount)`.

Поэтому ваш `filter → sort` должен стать `config.subFilter` + `transform: { steps: [sort] }`, ровно как вы увидели.

В [settingsBackup.ts](C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settingsBackup.ts:74) сериализуется переданный `config`, а не повторно прочитанный `data.json`. Отдельный unit-тест прямо проверяет, что в backup попадает переданная до-миграционная конфигурация, даже когда условный `data.json` уже содержит migrated shape.

Но доказательство из наблюдений ограничено: два файла с нужным именем доказывают, что записи, вероятно, запускались; они не доказывают содержимое, принадлежность именно вашим двум событиям или возможность восстановления. Для этого надо сравнить `backup.config` с точным seed-состоянием, а также `projectId`/`viewId` в payload.

# Найденные дыры

- Backup пишется fire-and-forget (`void writeMigrationBackup`). Миграция уже сохранена, а backup может не успеть при reload/unload Obsidian.
- Если `get(app)` вернёт falsy, миграция сохранится, а backup вообще не будет запущен.
- Любая ошибка `exists`, `write`, `JSON.stringify` или доступа к каталогу ловится, логируется только в console и возвращает `null`; пользовательского Notice нет. Это сознательный выбор «не блокировать миграцию», но это дыра в recoverability.
- Если `vault.adapter.exists(target)` бросает, цикл выбора имени немедленно прерывается, `write` не вызывается, функция логирует `migration backup failed` и возвращает `null`. Миграция остаётся применённой.
- `preMigrationConfig` — ссылка, а не глубокий снимок. Текущие миграторы создают новые объекты, а штатный `settings.updateViewConfig` тоже заменяет конфигурацию, поэтому в обычном пути это практически до-состояние. Но между первым `await exists(...)` и `JSON.stringify(config)` внешняя мутация того же объекта могла бы сделать backup промежуточным или пост-состоянием.
- Нет интеграционного теста жизненного цикла `DashboardView.onOpen`: есть отдельные тесты pure-миграции и отдельные тесты writer-а, но не их порядок, не fire-and-forget и не отказ `exists`.

Отдельно: новый demo-generator сам содержит четыре ведущих `filter`-pipeline у `database-call` и ещё один у chart. Значит свежий демо-проект при первом открытии «Обзора» сам подпадает под #118 и создаёт backup. Это противоречит комментарию генератора о выдаче актуальных конфигураций и является отдельной дырой provenance-тестов: они проверяют только миграцию агрегаций, не #118.

# Ошибочные формы test data

Молчание сейчас корректно для контракта мигратора:

- `kind` вместо `type` не распознаётся и остаётся нетронутым;
- `config.transform` не читается, потому что поддерживаемое место — `widget.transform`.

Мигратор специально предпочитает silent no-op потенциально опасному переписыванию неизвестного шага. Это не регресс #118 и не потеря данных. При этом диагностика — реальная UX-дыра: для ручного JSON/импорта полезен хотя бы dev-console warning или валидационная ошибка на границе импорта, но не обязательный пользовательский Notice при каждом неизвестном шаге.

# Что ваши наблюдения не доказывают

- Ровно 10 команд не доказывают работоспособность callbacks или идентичность загруженного `main.js` исходнику — только наличие регистраций в запущенном экземпляре.
- Успешное демо не доказывает корректность содержимого всех 28 заметок, отсутствие старого состояния или качество UI-рендера.
- REST roundtrip не доказывает, что Projects+ корректно построил из заметки DataFrame; это отдельный путь.
- Видимый итог миграции и наличие backup-файлов не доказывают их до-миграционное содержимое, успешность backup при ошибках adapter-а или восстановление из него.

Codex session ID: 01a04729-0222-7e33-8c97-2a75f9574fc7
Resume in Codex: codex resume 01a04729-0222-7e33-8c97-2a75f9574fc7
