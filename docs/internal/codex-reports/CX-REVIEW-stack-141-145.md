## Вердикты

1. **applyRollupColumns эквивалентен прежнему коду — false.**  
   Старый цикл считал следующий rollup от уже изменённого `out`; новый — всегда от `snapshot` ([rollupColumns.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/rollupColumns.ts:62)). Контрпример: конфиг одновременно допускает relation и rollup на одном поле ([тест контракта](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/settings/__tests__/fieldConfig.relation.test.ts:70)); первый rollup перезаписывает поле-relation, второй использует его как `relationField`. Старый и новый код резолвят разные ссылки. Это именно область, где старый код что-то считал: ручной `targetProjectId` был обязателен.

2. **Все rollup считаются от снимка, порядок ключей не влияет — survives.**  
   Для каждого вычисления источником служит неизменяемый `snapshot`, а результаты складываются только в `out` ([rollupColumns.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/rollupColumns.ts:65)). Проверенный ранний выход в `View.svelte` не ломает self-relation: при пустом `externalFramesMap` relation-обогащение по-прежнему не происходит, но rollup теперь вызывается и берёт текущий frame как target ([View.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:144)).  
   Однако тест порядка слабый: его «второй rollup» читает поле из external `sessions`, тогда как первый пишет поле в `clients`; старый порядок он не проверяет.

3. **Явный `targetProjectId` сохраняет приоритет и это безопасно — false.**  
   Приоритет действительно сохранён ([rollupColumns.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/rollupColumns.ts:40)); история подтверждает, что штатный UI его не писал. Но из этого не следует безопасность: ручной/stale id может не совпасть с целью relation. Тогда ссылки relation резолвятся в произвольном другом проекте, и при совпадении basename дадут правдоподобный, но неверный rollup. Код не валидирует согласованность override с relation.

4. **Gallery read-only больше не пишет в родительский проект, standalone не изменён — false в абсолютной формулировке.**  
   Узкий фикс данных работает: внешний Gallery получает `readonly || sourceReadOnly`, скрывает `+` и вместо редактора открывает заметку ([DatabaseCallBlock.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:523), [GalleryView.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Gallery/GalleryView.svelte:56)).  
   Но `sourceReadOnly` не передан в `ViewTabBar` и `BlockFilterBar`; они получают только общий `readonly` и продолжают писать конфигурацию родительского dashboard ([DatabaseCallBlock.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:382)). Кроме того top-level `galleryView.ts` вообще не передаёт `props.readonly`, поэтому standalone действительно «не изменён», но global read-only там обходится.

5. **ViewApi.updateRecord откатывает store, swallow исключения безопасен — false.**  
   Если файл уже исчез, `DataApi.updateRecord` успешно возвращает без записи ([dataApi.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dataApi.ts:51)); отката и Notice нет. Вдобавок `await api.updateRecord()` теперь выглядит успехом для вызывающих: Calendar после него самостоятельно кладёт несохранённую запись в локальный frame ([CalendarView.svelte](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Calendar/CalendarView.svelte:926)).  
   При двух конкурентных изменениях откат полного `oldRecord` также способен затереть более новое optimistic-изменение.

6. **`writeAcrossFiles` на `allSettled` не меняет наблюдаемое успешное поведение — false.**  
   Успешный эффект на файлах обычно тот же, но публичный результат изменён с `void` на outcome, а `ViewApi.addField` из синхронного fire-and-forget стал awaitable ([viewApi.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/viewApi.ts:123)). Модалка создания теперь ждёт все записи до продолжения; это наблюдаемая смена времени/контракта даже без ошибок. При ошибках Notice ждёт самый медленный target, а не первый отказ.

7. **Backup снимается до миграции, отложенная запись безопасна из-за идемпотентности — false.**  
   `onOpen` запускает backup асинхронно и потом сохраняет заранее вычисленный `migratedConfig` ([dashboardView.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardView.ts:87)). Пока идут `list → exists → read → write`, пользователь или другая вкладка может сохранить новое состояние dashboard; поздний `props.saveConfig(migratedConfig)` перезапишет его stale-конфигом. Идемпотентность мигратора не защищает от lost update. Две вкладки также проходят check-then-write параллельно; для legacy migration они могут сгенерировать разные widget id, и победитель зависит от гонки.

8. **Наличие backup-файла эквивалентно флагу в settings — false.**  
   Файл можно удалить, подложить пустой/чужой `data.backup-*` или создать параллельно; все эти состояния отличаются от устойчивого флага. Проверка — неатомарный `list`, а затем отдельные `exists/read/write` ([settingsBackup.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/settingsBackup.ts:31)). Поэтому возможны две копии, копия уже мигрированного JSON либо ложный пропуск копии.

## Дополнительные риски

- Частичный `add/rename/delete` всё равно сразу меняет in-memory schema и `fieldConfig`; failed notes остаются со старой схемой. Для rename/delete вызовы ещё и не awaitятся в controller ([dashboardSchema.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:116)).
- `Notice` о partial bulk-write может появиться после переключения проекта/закрытия view: он не содержит project/view context и создаётся лишь после завершения всех target-операций.
- Закрытие dashboard не отменяет отложенный migration-save; уже закрытый view способен позже записать stale config.
- Новые unit-тесты не покрывают ни межвкладочную гонку backup, ни исчезнувший файл в `updateRecord`, ни интеграцию `View.svelte` с self-relation. Запуск Jest в данном read-only sandbox невозможен: PowerShell блокирует `npx.ps1`, а Node — `lstat C:\Users\Park`.

Codex session ID: 01a043c2-4453-75e0-bb6f-4588a77f6cf5
Resume in Codex: codex resume 01a043c2-4453-75e0-bb6f-4588a77f6cf5
