# Коды ошибок Projects Plus / Error codes

Найдите код из уведомления, например `PPP-104`, поиском на этой странице. В каждом разделе сначала приведены объяснение и действия на русском, затем на английском. При сообщении о проблеме укажите код, версию плагина и действие, после которого появилась ошибка.

Search this page for the code shown in a notice, such as `PPP-104`. Each section contains Russian and English explanations and recovery steps. When reporting a problem, include the code, plugin version and action that triggered it.

## Быстрый переход / Find a category

| Коды / Codes | Область / Area |
| --- | --- |
| [1xx](#ppp-101) | Настройки и сохранение / Settings and persistence |
| [2xx](#ppp-201) | Запись заметок / Note writes |
| [3xx](#ppp-301) | Действия в виде / View actions |
| [4xx](#ppp-401) | Настройка дашборда / Dashboard configuration |
| [5xx](#ppp-501) | Связи записей / Record relations |
| [6xx](#ppp-601) | Первый запуск / Onboarding |
| [7xx](#ppp-701) | Источники и фильтры / Sources and filters |

Код сохраняет свой смысл независимо от языка интерфейса. Английские сообщения сверяются с [реестром ошибок](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/errors/errorCodes.ts); русский текст объясняет те же ситуации. Набор тестов проверяет наличие кодов и совпадение английских сообщений с реестром.

Codes identify the same condition in every interface language. Tests check code coverage and English message parity with the [error registry](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/lib/errors/errorCodes.ts). The Russian text explains the same conditions.

## PPP-101

### Что случилось

Настройки не удалось записать на диск.

### Почему

Запись прошла без ошибки, но в `data.json` осталось прежнее значение — значит изменение живёт только
в текущем сеансе Obsidian.

### Что делать

Нажмите пометку «Не сохранено» на панели, чтобы повторить запись. Если она возвращается снова —
проверьте, не открыт ли `data.json` в другой программе и не стоит ли на нём атрибут «только чтение».
Не перезагружайте хранилище до успешной записи: изменение потеряется.

### What happened

Projects+: settings could not be written to disk. Your change is still here, but it will be lost on reload. Retry from the "Not saved" mark in the toolbar.

### Why

The write was accepted but data.json still holds the old value, so the change exists only in this session.

### What to do

Click the "Not saved" mark in the toolbar to retry. If it keeps coming back, check whether `data.json` is open in another program or marked read-only. Do not reload the vault until a write succeeds — the change would be lost.

## PPP-102

### Что случилось

Файл `data.json` изменён не этим окном.

### Почему

Файл перезаписан вторым окном Obsidian или синхронизацией, поэтому это окно не может сказать,
уцелело ли его собственное изменение.

### Что делать

Не продолжайте править настройки в этом окне: повтор записи затёр бы чужое изменение. Переоткройте
хранилище, посмотрите, каким стало нужное вам значение, и внесите правку заново.

### What happened

Projects+: data.json was changed outside this window. Your latest change may not be saved — reopen the vault before making more.

### Why

Another window or a synchroniser replaced the file, so this window cannot tell whether its own change survived.

### What to do

Reopen the vault so the plugin reads the file as it now stands. Make no further changes until you do: the next save would write over whatever arrived from outside.

## PPP-103

### Что случилось

Файл настроек не удалось прочитать; плагин работает на значениях по умолчанию.

### Почему

`data.json` не читается или не разбирается как JSON — чаще всего это оборванная запись. Файл на
диске оставлен нетронутым, а рядом по возможности сделана его копия.

### Что делать

Сначала посмотрите текст уведомления: путь копии называется только после её полной проверки чтением.
Если копию проверить не удалось, плагин не разрешает перезаписывать оригинал. Проверьте доступ
к хранилищу и сделайте ручную копию `data.json`. Новые изменения остаются только в текущем сеансе
до проверенного резервирования; не перезагружайте плагин с несохранёнными правками. После восстановления
доступа следующая правка или внешнее событие запускает повторную сверку.

### What happened

The settings file could not be read; defaults are in use.

### Why

data.json could not be read or parsed, so the plugin started from defaults and left the file on disk untouched.

### What to do

The file was left untouched. A recovery path is reported only after its complete contents are read back. If verification fails, the plugin refuses to overwrite the original. Check storage access and keep a manual backup of data.json. Changes remain in this session until a recovery copy is verified; do not reload with unsaved edits. After access is restored, a subsequent edit or external settings event triggers reconciliation again.

## PPP-104

### Что случилось

Файл настроек повреждён; восстановлены значения по умолчанию.

### Почему

`data.json` разобрался как JSON, но не совпал ни с одной известной версией схемы настроек, поэтому
переносить было нечего.

### Что делать

То же, что и при `PPP-103`: сохраните копию, названную в уведомлении, и только потом меняйте
настройки. Причина несовпадения — в консоли разработчика.

### What happened

The settings file is corrupted; defaults were restored.

### Why

data.json parsed but matched no known settings version, so there was nothing that could be migrated.

### What to do

Defaults are in use in this session. Check the notice for a verified copy path; if no copy could be verified, the original is protected from overwrite. Follow the PPP-103 recovery steps above.

## PPP-105

### Что случилось

`data.json` изменил кто-то другой, и плагин не стал принимать чужую версию: ваша осталась в силе, а
версия с диска сохранена в соседний файл.

### Почему

Второе окно Obsidian, синхронизатор или правка руками заменили файл в тот момент, когда в этом
сеансе были свои несохранённые изменения. Слить две версии автоматически нельзя: счётчик
идентификаторов, признак проекта по умолчанию и раскладка виджетов ломаются каждый по-своему.
Поэтому ни одна из сторон не выбрасывается.

### Что делать

Ничего не потеряно. **Смотрите на путь в самом уведомлении** — он и есть ответ, потому что мест два:

- `data.conflict-…json` **рядом с `data.json`**, в папке плагина. Обычный случай; файл можно
  переименовать обратно в `data.json` при закрытом Obsidian, если нужна именно чужая версия целиком.
- заметка `Projects+ recovery/settings conflict ….md` **внутри хранилища**. Так бывает, когда писать
  рядом с файлом настроек не удалось; чужая версия лежит в ней блоком кода, и её видно с телефона,
  где консоли нет. Заметка обычная, поэтому проект с источником, покрывающим эту папку, покажет её
  записью — удалите, когда заберёте нужное.

Плагин ни то, ни другое никогда не читает. Если сообщение повторяется, скорее всего синхронизатор
пишет в хранилище во время работы: дождитесь окончания синхронизации, прежде чем менять настройки.

### What happened

Projects+: data.json was changed outside this window and could not be adopted. Your version is kept, and the one from disk was saved as {{path}}.

### Why

Another window, a synchroniser or a hand edit replaced data.json while this session held changes of its own, so neither version could be discarded.

### What to do

Nothing is lost. **Follow the path in the notice** — it is the answer, because there are two places it can be. A `data.conflict-….json` beside `data.json` in the plugin folder is the ordinary case, and it can be renamed back over `data.json` with Obsidian closed. A note under `Projects+ recovery/` inside the vault is what you get when nothing could be written beside the settings file: the other version is in a fenced block, readable on a phone where there is no console, and — being an ordinary note — a project whose source covers that folder will list it as a record. Projects+ never reads either one, so delete it once you are done.

## PPP-106

### Что случилось

Другую версию data.json не удалось сохранить в проверенную резервную копию.

### Почему

Ни копию рядом с data.json, ни заметку восстановления не удалось записать и полностью прочитать
обратно. Это может быть отказ записи, неполное содержимое или ошибка чтения. Плагин не разрешает
перезапись оригинала без проверенной копии. Отказ резервирования не означает, что хранилище
не принимает обычную запись вообще.

### Что делать

Плагин сохраняет оригинал и не считает обычную правку разрешением его затереть. На компьютере
откройте консоль разработчика (Ctrl+Shift+I), найдите строку PPP-106 и скопируйте другую версию.
Можно вручную скопировать data.json из папки плагина. Проверьте доступ к хранилищу. Следующая
правка или внешнее событие повторит сверку; сохранить изменения поверх оригинала можно только
после проверенной копии. Не перезагружайте плагин с несохранёнными правками: они существуют
только в текущем сеансе. Причину отказа ищите в консоли: возможны права на папку, конфликт
синхронизации или неизвестное расположение папки плагина.

### What happened

Projects+: data.json changed outside this window, but its recovery copy could not be verified. The original is protected; changes remain unsaved until a copy is verified. Check storage access and keep a manual backup. On desktop, the other version is also in the developer console.

### Why

Neither the copy beside data.json nor the recovery note could be written and read back completely. The original remains protected from overwrite.

### What to do

The plugin protects the original; an ordinary edit does not authorize overwriting it. On desktop, open the developer console (Ctrl+Shift+I) and find the PPP-106 line to copy the other version, or manually back up data.json from the plugin folder. Check storage access. A subsequent edit or external settings event triggers reconciliation again; replacement requires a verified recovery copy. Do not reload with unsaved changes: they exist only in this session.

For the cause of the failure, check the console: possible causes include permissions, synchronisation conflicts or an unknown plugin directory. Failure to preserve a copy does not mean that ordinary vault writes are impossible.

## PPP-201

### Что случилось

Изменения заметки не сохранены; прежнее значение возвращено.

### Почему

Запись во фронтматтер заметки не прошла, поэтому показанное на экране значение откатили к тому, что
лежит на диске.

### Что делать

Повторите правку. Если не проходит и со второго раза — откройте заметку и проверьте её фронтматтер:
чаще всего мешает синтаксическая ошибка в YAML, оставленная другим плагином или ручной правкой.

### What happened

Could not save changes to {{path}}; the previous value was restored.

### Why

Writing the note's frontmatter failed, so the value on screen was rolled back to what is on disk.

### What to do

The value on screen was put back to what is on disk. Check that the note still exists and is writable, then try again.

## PPP-202

### Что случилось

Не сохранена группа записей; прежние значения возвращены.

### Почему

Групповая запись прервалась на середине, поэтому все записи группы откатили к тому, что лежит на
диске.

### Что делать

Повторите действие. Если ошибка повторяется, попробуйте изменить записи по одной — так станет видно,
какая именно заметка мешает.

### What happened

Could not save {{count}} record(s); the previous values were restored.

### Why

A batch write failed part way through, so every record in the batch was rolled back to what is on disk.

### What to do

Every record in the batch was rolled back. The console lists which ones; check them for permissions or missing files.

## PPP-203

### Что случилось

Заметки больше нет; изменение не сохранено.

### Почему

Заметку переименовали, переместили или удалили уже после того, как вид её загрузил, — записывать
оказалось некуда.

### Что делать

Обновите вид (переоткройте вкладку). Если заметка нужна — найдите её на новом месте или восстановите
из корзины хранилища.

### What happened

{{path}} no longer exists; the change was not saved.

### Why

The note was renamed, moved or deleted after the view loaded it, so there was no file left to write to.

### What to do

The note is gone from the vault. Refresh the view; if it was deleted by mistake, restore it from your file history.

## PPP-204

### Что случилось

Новое поле записано не во все заметки проекта.

### Почему

Поле добавляется в заметки проекта по одной, и часть этих записей не прошла.

### Что делать

Список незатронутых заметок выведен в консоль разработчика. Откройте их и добавьте поле вручную —
или устраните причину (недоступный файл, ошибка во фронтматтере) и добавьте поле заново.

### What happened

'{{field}}' was written to {{written}} notes; {{unwritten}} could not be updated. See the console for the list.

### Why

A new field is written into the project's notes one by one, and some of those writes did not succeed.

### What to do

The console lists the notes that could not be written. The rest were updated.

## PPP-205

### Что случилось

Изменение нескольких заметок записано не во все: часть заметок показывает прежние значения, остальные
сохранены.

### Почему

Изменение записывается в каждую заметку по отдельности. Часть заметок не нашлась (их переименовали,
переместили или удалили) или отказала в записи.

### Что делать

Нажмите «Повторить» в уведомлении — повтор затронет только те заметки, запись в которые не прошла.
Список заметок — в консоли разработчика; пропавшую заметку найдите на новом месте и обновите вид.

### What happened

{{unwritten}} of {{count}} notes were not saved and show their previous values; the rest were saved.

### Why

A change to several notes is written into each note on its own; some notes were missing or refused the write. The console lists them.

### What to do

Press "Retry" in the notice: it writes only the notes that failed. The console lists the notes; find a missing one at its new place and refresh the view.

## PPP-301

### Что случилось

Заметку не удалось переименовать.

### Почему

Obsidian отказал в переименовании — обычно новое имя уже занято или содержит символы, недопустимые в
имени файла.

### Что делать

Выберите другое имя. Символы `\ / : * ? " < > |` в именах файлов использовать нельзя.

### What happened

The note could not be renamed.

### Why

Obsidian refused the rename — usually the new name is already taken, or holds characters the file system does not allow.

### What to do

The note keeps its old name. The console line says why the rename was refused — a name collision and an illegal character need different fixes.

## PPP-302

### Что случилось

Изменения в редакторе заметки не сохранены.

### Почему

Редактор не смог записать правку обратно в файл, поэтому на экране вы видите больше, чем лежит на
диске.

### Что делать

Скопируйте изменённый текст из окна редактора, прежде чем закрыть его, — иначе правка пропадёт.
Затем повторите сохранение.

### What happened

Failed to save changes

### Why

The note editor could not write its changes back to the file, so what is on screen is ahead of what is on disk.

### What to do

Your edit is still in the editor. Check the note is writable and save again.

## PPP-303

### Что случилось

Заметку не удалось удалить.

### Почему

Удаление файла не прошло: он может быть открыт в другой программе, помечен только для чтения или уже
удалён.

### Что делать

Закройте заметку во всех вкладках и повторите. Если файла уже нет — обновите вид, запись исчезнет
сама.

### What happened

The note could not be deleted.

### Why

Deleting the file failed — it may be open elsewhere, read-only, or already gone.

### What to do

The note is still there. Check it is not open elsewhere or read-only.

## PPP-304

### Что случилось

Заметку не удалось продублировать.

### Почему

Одну из копий не удалось создать, поэтому набор новых заметок неполон.

### Что делать

Проверьте, какие даты получили копию, и повторите дублирование для оставшихся.

### What happened

The note could not be duplicated.

### Why

One of the copies could not be created, so the set of new notes is incomplete.

### What to do

Nothing was duplicated. Check there is room in the target folder and no name collision.

## PPP-305

### Что случилось

Отметку не удалось изменить.

### Почему

Запись поля отметки обратно в заметку не прошла, поэтому галочка на экране не соответствует файлу.

### Что делать

Обновите вид, чтобы увидеть настоящее состояние, и повторите. Если не помогает — проверьте
фронтматтер заметки.

### What happened

The checkbox could not be changed.

### Why

Writing the checkbox field back to the note failed, so the tick does not reflect the file.

### What to do

The checkbox is back to its previous state. Check the note is writable.

## PPP-306

### Что случилось

Не выбрано поле для отметок.

### Почему

В настройках вида не назначено логическое поле, поэтому галочке некуда записываться.

### Что делать

Откройте настройки вида и выберите поле типа «логическое» для отметок. Если такого поля в проекте
нет — сначала добавьте его в схеме.

### What happened

Choose a field for the checkboxes first.

### Why

The view has no boolean field assigned, so there is nothing for a tick to be written into.

### What to do

Pick a field for the checkboxes in the view settings first.

## PPP-307

### Что случилось

Дату события не удалось изменить.

### Почему

Запись новой даты обратно в заметку не прошла, поэтому событие осталось на прежнем месте.

### Что делать

Повторите перенос. Если ошибка повторяется, откройте заметку и проверьте формат значения в поле
даты.

### What happened

The event date could not be changed.

### Why

Writing the new date back to the note failed, so the event stays where it was.

### What to do

The event kept its date. Check the note is writable and the date field is the one the view expects.

## PPP-308

### Что случилось

Для создания событий нужно поле даты.

### Почему

В настройках вида не назначено поле даты, поэтому событию не по чему определить своё место.

### Что делать

Откройте настройки вида и выберите поле даты. Если такого поля в проекте нет — добавьте его в схеме.

### What happened

Date field is required to create events

### Why

The view has no date field assigned, so an event has nothing to be placed by.

### What to do

Choose a date field in the view settings; events cannot exist without one.

## PPP-309

### Что случилось

Эту дату нельзя присвоить событию.

### Почему

Дата не прошла проверку: она вне поддерживаемого диапазона либо конец события оказался бы раньше его
начала.

### Что делать

Перенесите событие на другую дату. Если нужно растянуть событие назад, сначала измените дату начала.

### What happened

That date cannot be used for this event.

### Why

The target date failed validation — it is outside the supported range, or it would put the end of the event before its start.

### What to do

Pick another date. The console line says what made this one unusable.

## PPP-310

### Что случилось

Эту запись нельзя перенести.

### Почему

В записи не хватает полей, которые нужны календарю, поэтому её новое положение не вычисляется.

### Что делать

Откройте заметку и заполните поля дат, заданные в настройках вида.

### What happened

This record cannot be moved.

### Why

The record is missing fields the calendar needs, so its new position cannot be worked out.

### What to do

This record is missing something the view needs — usually its date field. Open it and check.

## PPP-311

### Что случилось

Цвет не удалось изменить.

### Почему

Запись поля цвета обратно в заметку не прошла, поэтому событие сохранило прежний цвет.

### Что делать

Повторите выбор цвета. Если ошибка повторяется — проверьте фронтматтер заметки.

### What happened

The colour could not be changed.

### Why

Writing the colour field back to the note failed, so the event keeps its previous colour.

### What to do

The colour is unchanged. Check the note is writable.

## PPP-312

### Что случилось

В проекте не задано поле цвета.

### Почему

В настройках вида не назначено поле, которое хранит цвет события, поэтому записывать выбор некуда.

### Что делать

Откройте настройки вида и выберите поле для цвета событий. Если такого поля нет — добавьте его в
схеме проекта.

### What happened

No colour field is set for this project.

### Why

The view has no field assigned to hold an event colour, so there is nothing to write the choice into.

### What to do

Set a colour field in the project settings first.

## PPP-313

### Что случилось

Календарь не смог перейти на эту дату.

### Почему

Вычисление следующего периода не прошло, поэтому календарь остался на месте.

### Что делать

Выберите дату через переключатель периода. Если повторяется — сообщите об этом вместе с кодом:
подробности перехода выведены в консоль разработчика.

### What happened

The calendar could not move to that date.

### Why

Working out the next period failed, so the calendar stayed where it was.

### What to do

The calendar stayed where it was. Try the date again; if it repeats, the console line has the reason.

## PPP-314

### Что случилось

В проекте «только чтение» нельзя создавать события.

### Почему

Проект открыт в режиме только для чтения, поэтому из этого вида нельзя создать заметку.

### Что делать

Снимите режим только для чтения в настройках проекта — или создайте заметку в том проекте, который
доступен для записи.

### What happened

Cannot create events in read-only projects

### Why

The project is read-only, so no note can be created from this view.

### What to do

This project is read-only. Events can only be created in a project that can be written to.

## PPP-401

### Что случилось

Поле не удалось добавить.

### Почему

Поле не записалось в заметки проекта, поэтому схема осталась прежней.

### Что делать

Повторите добавление. Если не проходит — проверьте, нет ли в проекте заметок с испорченным
фронтматтером; подробности в консоли разработчика.

### What happened

Failed to add field. Please try again.

### Why

The field could not be written into the project's notes, so the schema is unchanged.

### What to do

The field was not added. Try again; the console line says what failed.

## PPP-402

### Что случилось

Окно схемы не удалось открыть заново.

### Почему

После правки поля диалог схемы не открылся повторно. Сама правка при этом применена.

### Что делать

Откройте схему заново из панели дашборда. Внесённое изменение уже на месте.

### What happened

Failed to reopen schema.

### Why

The schema dialog could not be reopened after the edit; the edit itself was applied.

### What to do

Open the schema again from the view menu.

## PPP-403

### Что случилось

Конфигурация дашборда перенесена, но точка отката не записана.

### Почему

Копию конфигурации, снятую до переноса, не удалось сохранить, поэтому откатываться не к чему.

### Что делать

Если после переноса дашборд выглядит не так, как раньше, восстановить прежнюю конфигурацию
автоматически не получится — соберите нужные блоки заново. Причина отказа в записи — в консоли
разработчика.

### What happened

The dashboard configuration was migrated, but its restore point could not be written. See the console.

### Why

The pre-migration copy of the configuration could not be saved, so there is nothing to roll back to.

### What to do

The migration itself succeeded — only its restore point is missing. Export the dashboard configuration if you want a copy before making changes.

## PPP-501

### Что случилось

Обратную ссылку связи не удалось записать.

### Почему

Обратная ссылка пишется в заметки на другой стороне связи, и часть этих записей не прошла.

### Что делать

Список заметок выведен в консоль разработчика. Откройте их и проверьте поле связи: связь в одну
сторону уже записана, обратная — нет.

### What happened

The back-link for '{{field}}' could not be written to {{count}} note(s). See the console.

### Why

The back-link is written into the notes on the other side of the relation, and some of those writes failed.

### What to do

The note itself was saved; only its back-link was not. The console lists the notes involved.

## PPP-601

### Что случилось

Папку демо-проекта не удалось создать.

### Почему

Папку, в которой живут демонстрационные заметки, создать не вышло, поэтому ни одной из них некуда
было лечь.

### Что делать

Проверьте, нет ли в корне хранилища файла с таким же именем и разрешена ли запись в хранилище.
Затем выполните команду «Создать демо-проект» ещё раз.

### What happened

Could not create the demo folder '{{folder}}'. The demo project was not created.

### Why

The folder the demo notes live in could not be created, so none of them had anywhere to land.

### What to do

No demo project was created. Check that the vault folder can be written to, then run "Create demo project" again.

## PPP-602

### Что случилось

Демо-проект создан не полностью.

### Почему

Часть демонстрационных заметок не записалась, поэтому проект зарегистрирован, но неполон.

### Что делать

Выполните команду «Создать демо-проект» ещё раз: она дописывает недостающие заметки и не создаёт
второй проект.

### What happened

The demo project was created, but {{count}} notes could not be written. See the console for the list.

### Why

Some of the demo notes could not be written, so the project is registered but incomplete.

### What to do

The demo exists but is missing the notes the console lists. Run "Create demo project" again — it fills in what is missing without duplicating anything.

## PPP-603

### Что случилось

Недостающие заметки демо-проекта не восстановлены.

### Почему

Демо-проект пересоздавался, чтобы вернуть отсутствующие заметки, и часть этих записей не прошла.

### Что делать

Список незаписанных заметок выведен в консоль разработчика. Проверьте права на запись в папку
демо-проекта и повторите команду.

### What happened

Demo project already exists. {{count}} missing notes could not be written — see the console.

### Why

The demo project was re-seeded to restore the notes it was missing, and some of those writes failed.

### What to do

The notes the console lists still could not be written. Check the folder's permissions.

## PPP-701

### Что случилось

Источник с таким именем в проекте уже есть.

### Почему

Два источника с одинаковым именем неразличимы в единственном списке, где они показываются, поэтому
имя отклонено.

### Что делать

Дайте выборке другое имя.

### What happened

This project already has a source called "{{name}}"

### Why

Two sources sharing a name are indistinguishable in the only picker that lists them, so the name is refused.

### What to do

Give the source a different name. Two sources with one name are indistinguishable in the picker.
