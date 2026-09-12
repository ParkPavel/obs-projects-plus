# OBS Projects Plus

[Русский](README.md) · [User guide](docs/user-guide-EN.md) · [Documentation](docs/README.md)

Projects Plus helps you work with Obsidian notes as a project: compare records in a table, arrange them on a board, plan events in a calendar, and build an overview on a Dashboard.

Each record remains a Markdown file. Fields such as status, date, and assignee live in note properties — the YAML block at the beginning of the file. Editing an ordinary writable field in the plugin updates the note.

## What you can do

| Task | Tool |
| --- | --- |
| Compare records and edit their properties | A table inside a Dashboard block |
| Organize tasks by status | Board with draggable cards |
| Browse meetings and deadlines | Calendar with year-to-day views |
| Browse materials by cover image | Gallery |
| Combine records, charts, and metrics | Dashboard with configurable blocks |
| Select the notes to include | Folder, tag, built-in filtered query, or Dataview |

![Example Projects Plus calendar](images/2026-01-27_12-24-17.png)

This illustration shows one interface configuration; your installed version may look different.

## Install

The plugin is in alpha development. The source version is recorded in [manifest.json](manifest.json); packaged builds are available in [GitHub Releases](https://github.com/ParkPavel/obs-projects-plus/releases). The manifest also specifies the minimum Obsidian version.

1. Choose a release and download **all three files** from it: `main.js`, `manifest.json`, and `styles.css`.
2. Create `.obsidian/plugins/obs-projects-plus/` inside your vault and place the files there.
3. Restart Obsidian and enable **OBS Projects Plus** in Community plugins settings.

When updating, replace these three files with files from the same build. Keep `data.json`: it contains your project and view settings.

## Your first project

1. Create a `Projects` folder in your vault and a note named `First task.md` inside it:

   ```yaml
   ---
   title: First step
   status: todo
   startDate: 2026-09-15
   ---
   ```

2. Open the Obsidian command palette and find **Create new project plus**.
3. Name the project, choose **Folder** as its source, and select `Projects`.
4. Open it with **Show projects plus**. Use the add-view control to add a view; for a table, use a data block on a Dashboard.
5. Change the record's `status`, then open its Markdown file: the updated value should be stored in its properties.

To explore prepared data, use **Create demo project** or the separate [demo vault](demo-vault/README.md).

## Continue

- [User guide](docs/user-guide-EN.md): sources, views, filters, templates, and troubleshooting.
- [Note templates](templates/README.md): examples for tasks, meetings, and reviews.
- [Changelog](CHANGELOG.md) and [issue tracker](https://github.com/ParkPavel/obs-projects-plus/issues).
- [Contributing](CONTRIBUTING.md) and [custom view API](docs/api.md).

Development is managed through [Claudex](https://github.com/ParkPavel/claudex). AI configuration and instructions are maintained in that separate project.

Projects Plus is based on Marcus Olsson's [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects). The current maintainer is Park Pavel. Licensed under [Apache 2.0](LICENSE); see [NOTICE](NOTICE) for attribution.
