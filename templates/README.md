# Шаблоны заметок / Note templates

[Руководство пользователя](../docs/user-guide.md) · [English guide](../docs/user-guide-EN.md)

В этой папке находятся примеры заметок для Templater. Их можно адаптировать под собственные задачи; названия полей и варианты статусов — соглашения этих примеров, а не обязательная схема Projects Plus.

These are example notes for Templater. Adapt them to your workflow: field names and status choices are conventions used by these examples, not a mandatory Projects Plus schema. Interactive prompts inside the templates are in Russian.

## Использование / Usage

1. Включите плагин Templater в хранилище и укажите в его настройках папку шаблонов.
2. Скопируйте в неё нужные файлы из этой папки.
3. Создайте заметку командой Templater **Create new note from template** и ответьте на вопросы.
4. Поместите результат в папку проекта либо добавьте нужный тег.
5. Проверьте получившиеся свойства заметки и сопоставьте поля с настройками представления.

Enable Templater, configure its template folder, and copy the desired files there. Run its **Create new note from template** command, answer the prompts, then place the resulting note in the project's source folder or add its source tag. Inspect the generated properties and map their fields in view settings.

Синтаксис `<% ... %>` выполняет Templater. Встроенные шаблоны Projects Plus используют `{{title}}`, `{{date}}` и `{{time}}` и не выполняют код Templater. Горячую клавишу для создания заметок можно назначить самостоятельно в Obsidian.

Templater processes `<% ... %>`. Built-in Projects Plus templates use `{{title}}`, `{{date}}`, and `{{time}}` and do not execute Templater code. Assign a shortcut in Obsidian if desired.

## Выбор шаблона / Choose a template

| Файл / File | Назначение / Purpose |
| --- | --- |
| [Projects Plus Template](Projects%20Plus%20Template.md) | Общий пример свойств / General property example |
| [Task Template](Task%20Template.md) | Задача с чеклистом / Task with a checklist |
| [Calendar Event Template](Calendar%20Event%20Template.md) | Событие с датой и временем / Dated, timed event |
| [Meeting Template](Meeting%20Template.md) | Повестка и результаты встречи / Meeting agenda and outcomes |
| [Daily Note Template](Daily%20Note%20Template.md) | Дневниковая запись / Daily journal |
| [Quick Note Template](Quick%20Note%20Template.md) | Короткая заметка / Quick capture |
| [Deadline Template](Deadline%20Template.md) | Запись о сроке / Deadline note |
| [Habit Tracker Template](Habit%20Tracker%20Template.md) | Запись о привычке / Habit record |
| [Project Template](Project%20Template.md) | Описание проекта / Project outline |
| [Recurring Event Template](Recurring%20Event%20Template.md) | Описание повторения / Recurrence metadata |
| [Sprint Template](Sprint%20Template.md) | План спринта / Sprint plan |
| [Weekly Review Template](Weekly%20Review%20Template.md) | Обзор недели / Weekly review |

Шаблон повторяющегося события записывает поля `recurrence` и `recurrence_day`. Сам шаблон не создаёт будущие экземпляры события. Шаблон проекта создаёт заметку, а не автоматически настроенный проект плагина.

The recurring-event template writes `recurrence` and `recurrence_day`; the template itself does not create future event instances. The project template creates a note, not an automatically configured plugin project.

## Поля и представления / Fields and views

| Поле / Field | Формат / Format | Использование / Use |
| --- | --- | --- |
| `title` | Текст / Text | Заголовок записи / Record title |
| `startDate`, `endDate` | `YYYY-MM-DD` | Начало и окончание события / Event start and end |
| `date` | `YYYY-MM-DD` | В примерах — дата создания / Creation date in these examples |
| `startTime`, `endTime` | `HH:mm` | Время события / Event times |
| `status` | `inbox`, `todo`, `doing`, `done` | Примеры этапов доски / Example board stages |
| `completed` | `true`, `false` | Флажок / Checkbox |
| `priority` | `high`, `medium`, `low` | Приоритет / Priority |
| `color` | Например / e.g. `"#2196F3"` | Цвет события / Event color |
| `tags` | Список / List | Отбор по тегам / Tag selection |

В календаре явно выберите `startDate` как поле начала. Поле `date` может использоваться календарём как запасной источник даты; его название не гарантирует, что оно останется только датой создания.

Explicitly choose `startDate` as the calendar's start field. The calendar may use `date` as a fallback; its name does not guarantee it will be treated only as a creation date.

После заполнения шаблона проверьте YAML, особенно если ответ содержит двоеточие, кавычки или перенос строки. При необходимости исправьте кавычки в созданной заметке. Цвета и время храните как строки. Удаляйте ненужные поля из собственных копий шаблонов, чтобы форма оставалась короткой.

Inspect generated YAML, especially when an answer contains a colon, quotes, or a newline. Correct quoting in the resulting note when needed. Store colors and times as strings. Remove unused fields from your own template copies to keep the form short.
