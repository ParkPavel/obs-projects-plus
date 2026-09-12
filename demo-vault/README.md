# Projects Plus demo vault

[Русское руководство](../docs/user-guide.md) · [English guide](../docs/user-guide-EN.md)

This folder is a sample vault with fictional project, team, and client notes. It is separate from the demo created by the plugin's **Create demo project** command. Use a copy of this folder to explore without changing the repository's examples.

Это отдельное демонстрационное хранилище с вымышленными проектами, участниками команды и клиентами. Оно отличается от демо, создаваемого командой плагина. Для экспериментов скопируйте папку целиком, включая скрытую `.obsidian`.

## Open the demo

1. Copy this entire directory, including `.obsidian`, to a location for your demo vault.
2. Download `main.js`, `manifest.json`, and `styles.css` from the same [plugin release](https://github.com/ParkPavel/obs-projects-plus/releases).
3. Put those three files in the copy's `.obsidian/plugins/obs-projects-plus/` directory. Keep the supplied `data.json`.
4. Open the copied folder as a vault in Obsidian and enable **OBS Projects Plus** in Community plugins settings.
5. Run **Show projects plus** from the command palette and select **Demo Project**.

The saved configuration includes **Demo Project** and **Team Members**. You do not need to create duplicate projects. Older saved view settings are migrated when loaded by the current plugin. If you copied only the notes and omitted `.obsidian`, create a folder project for `Projects` manually; the prepared views will not be present.

Скопируйте в папку плагина три файла одного релиза, сохраните готовый `data.json`, откройте копию как хранилище и включите плагин. Затем выберите **Demo Project**. Создавать его повторно не нужно. Если скрытая папка `.obsidian` не была скопирована, настройте проект по папке `Projects` самостоятельно.

## Data you can explore

| Folder | Contents | Use |
| --- | --- | --- |
| [Projects](Projects/) | Task, meeting, and project notes | Main data source |
| [Team](Team/) | Team member notes | Targets for `assignee` and `reviewer` links |
| [Clients](Clients/) | Client notes | An additional source to try |

The supplied configuration contains status filter tabs, summary cards, a data table, and relation targets. Notes include dates, statuses, priorities, numeric metrics, and wiki-links. Dates are fixed example data: a calendar opened on today's date may initially show no events. Navigate to a date found in one of the notes.

Даты в примерах фиксированные. Если календарь пуст на сегодняшней дате, откройте заметку и перейдите к дате из её `startDate`.

## A short walkthrough

### 1. Inspect a record

Open a note in `Projects`, then find it in **Demo Project**. Compare its YAML properties with the displayed row. Change a writable property such as `status`, reopen the Markdown file, and check the stored value.

### 2. Try a board and calendar

Add a Board view grouped by `status`. Move a card between columns and inspect the note's status afterward.

Add a Calendar view and map start/end dates to `startDate` and `endDate`, times to `startTime` and `endTime`, and color to `color`. Navigate to one of the sample event dates. Explicit field mappings make it easier to see why a note appears on a particular day.

### 3. Follow a relation

Inspect an `assignee` or `reviewer` link and open the corresponding note in `Team`. The supplied relation settings point to **Team Members**. If a link is unresolved, check its spelling and whether that project is available.

### 4. Add an overview block

On Dashboard, add a chart or summary block and select the data source. Start with a count by `status` or a sum of `budget`; compare the result with a few source records. Filters affect the records included in the result.

### 5. Combine sources

In **Demo Project** settings, add `Clients` as another folder source. Client notes have different properties from task notes, so some columns will be empty. Remove the additional source to return to the original selection; the client files remain in the vault.

## Keep the experiment reproducible

Record the plugin version you installed. To restart, make another copy of this demo directory and install the same release. Replacing only notes does not reset saved filters, views, or layout in `data.json`.

Для полного сброса эксперимента создайте свежую копию этой папки и установите тот же релиз. Замена одних заметок не сбрасывает фильтры и расположение блоков в `data.json`.

[Report a problem](https://github.com/ParkPavel/obs-projects-plus/issues) · [License](../LICENSE)
