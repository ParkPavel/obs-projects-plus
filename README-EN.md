# OBS Projects Plus

<div align="center">

![Version](https://img.shields.io/badge/version-3.0.8-blue.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-v1.5.7+-purple.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)
[![Downloads](https://img.shields.io/github/downloads/ParkPavel/obs-projects-plus/total.svg)](https://github.com/ParkPavel/obs-projects-plus/releases)
[![Telegram](https://img.shields.io/badge/Telegram-Channel-blue.svg?logo=telegram)](https://t.me/parkpavel_chigon)

**Project management in Obsidian: tables, boards, calendar with timeline, gallery**

[Русский](README.md) | English

</div>

---

## Why this plugin?

Obsidian stores everything in plain Markdown files. That works great for text — but when you have dozens or hundreds of notes, it's hard to see what's where and in what state.

**Projects Plus** turns a folder of notes into a managed project: you see all tasks on a kanban board, all events on a calendar, all cards in a gallery — all without export, without cloud, right in your vault.

### Who it's for

- **Content managers** — track publication status in a table and board
- **Researchers** — organize sources, notes, and deadlines with filtering
- **Planners** — see tasks on a timeline calendar with multi-day events
- **Anyone with a knowledge base** — when you need a visual overview, not a file list

### How it works

1. You point to a **folder**, a **tag**, or a **Dataview query** — this is your "project"
2. The plugin collects all matching notes and reads their `frontmatter` (YAML header)
3. You pick a **view** — table, board, calendar, or gallery
4. You edit fields right in the interface — the plugin writes changes back to the file

Your data **stays in your files**. The plugin does not create its own database.

---

## 📸 Gallery

<p align="center">
  <img src="images/2026-01-27_12-23-33.png" width="15%" title="Table" />
  <img src="images/2026-01-27_12-23-55.png" width="15%" title="Board" />
  <img src="images/2026-01-27_12-24-17.png" width="24%" title="Calendar" />
  <img src="images/2026-01-27_12-24-35.png" width="15%" title="Timeline" />
  <img src="images/2026-01-27_12-26-03.png" width="15%" title="Gallery" />
</p>
<p align="center">
  <img src="images/2026-01-27_12-26-43.png" width="15%" title="Agenda" />
  <img src="images/2026-01-27_12-27-29.png" width="24%" title="Filters" />
  <img src="images/2026-01-27_12-29-16.png" width="15%" title="Mobile" />
  <img src="images/2026-01-27_12-30-02.png" width="24%" title="Settings" />
</p>

<details>
<summary align="center"><b>👆 Click to view full size</b></summary>
<p align="center">
  <a href="images/2026-01-27_12-23-33.png"><img src="images/2026-01-27_12-23-33.png" width="80%" /></a>
  <a href="images/2026-01-27_12-23-55.png"><img src="images/2026-01-27_12-23-55.png" width="80%" /></a>
  <a href="images/2026-01-27_12-24-17.png"><img src="images/2026-01-27_12-24-17.png" width="80%" /></a>
  <a href="images/2026-01-27_12-24-35.png"><img src="images/2026-01-27_12-24-35.png" width="80%" /></a>
  <a href="images/2026-01-27_12-26-03.png"><img src="images/2026-01-27_12-26-03.png" width="80%" /></a>
  <a href="images/2026-01-27_12-26-43.png"><img src="images/2026-01-27_12-26-43.png" width="80%" /></a>
  <a href="images/2026-01-27_12-27-29.png"><img src="images/2026-01-27_12-27-29.png" width="80%" /></a>
  <a href="images/2026-01-27_12-29-16.png"><img src="images/2026-01-27_12-29-16.png" width="80%" /></a>
  <a href="images/2026-01-27_12-30-02.png"><img src="images/2026-01-27_12-30-02.png" width="80%" /></a>
</p>
</details>

---

## ✨ Features

| View | What it does |
|------|-------------|
| **Table** | Editing with sorting, filtering, cell navigation |
| **Board** | Kanban — drag cards, column persist, Ctrl+Scroll zoom (25–200%), collapsible columns |
| **Calendar** | Timeline 07:00–22:00, multi-day bars, 5 zoom levels (Year → Day) |
| **Gallery** | Cards with covers and frontmatter fields |

**Calendar** — a full planner: `startDate`, `endDate`, `startTime`, `endTime`, `date` (note creation date), `color` field for color coding, infinite scroll, mobile gestures (swipe, pinch-to-zoom, double tap to create note).

**Agenda 2.0** — calendar sidebar with a list builder: 42 filter operators, nested AND/OR groups, date formulas (`today`, `sow`, `eom`, `today+1w`), two modes — visual and Advanced (Google Sheets-style formulas).

**Board** — column persist: columns stay visible even with no matching records, visual indicators, Ctrl+Scroll zoom (25–200%), adaptive layout, note creation inherits active filters.

**Three data sources**: folder, tag, Dataview query. Note templates, autosave, localization (RU, EN, UA, ZH-CN).

> For shortcuts, gestures, templates, and settings details — see the **[User Guide](docs/user-guide-EN.md)**.

---

## 📥 Installation

### BRAT (Recommended)
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. In BRAT settings, add: `ParkPavel/obs-projects-plus`
3. Enable the plugin

### Manual Installation
1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/ParkPavel/obs-projects-plus/releases)
2. Place in `.obsidian/plugins/obs-projects-plus/`
3. Restart Obsidian → Enable the plugin

---

## 🚀 Quick Start

1. On first launch the plugin creates a **demo project** (35+ notes, 6 views)
2. `Ctrl/Cmd+P` → *"Projects Plus: Show projects plus"*
3. Switch between views: Table → Board → Calendar → Gallery
4. Create your own project: `Ctrl/Cmd+P` → *"Projects Plus: Create Project"*

```yaml
# Example frontmatter for a project note
---
title: My Task
status: todo
priority: high
startDate: 2026-02-15
date: 2026-02-15
endDate: 2026-02-20
startTime: "09:00"
endTime: "18:00"
color: "#4CAF50"
tags: [project, important]
---
```

---

## 🗺️ Roadmap

| Priority | Feature | Version | Status |
|:--------:|---------|---------|--------|
| ✅ | **Agenda 2.0 & Filter System** | v3.0.5 | Released |
| ✅ | **Obsidian Guidelines Compliance** | v3.0.6 | Released |
| ✅ | **Optimization + Tags + Date Fields** | v3.0.7 | Released |
| ✅ | **Board UX: persist, zoom, collapse** | v3.0.8 | Released |
| 🥇 | **Drag & Drop + Mobile** | v3.2.0 | Planned |
| 🥈 | **Database View** | v3.3.0 | Planned |
| 🥉 | **Calendar Sync** (iCal, Google, CalDAV) | v3.4.0 | Planned |

---

<details>
<summary><h2>🛠️ For Developers</h2></summary>

### Known Issues

| # | Issue | Priority | Notes |
|---|-------|:--------:|-------|
| 1 | Command logic duplication (`main.ts` + `CommandManager`) | P2 | Desync risk when adding new commands |
| 2 | Fire-and-forget `void` in `ViewApi` writes | P2 | I/O errors during writes are silently swallowed |

### Custom View API (Experimental)

The plugin supports registering **custom views** from third-party plugins. This is inherited from the original Obsidian Projects by Marcus Olsson.

**How it works**: on load, Projects Plus iterates all enabled plugins looking for an `onRegisterProjectView` method. If found, it calls the method and registers the returned view alongside the built-in ones (Table, Board, Calendar, Gallery).

```typescript
// In your plugin (plugin.ts):
import { Plugin } from "obsidian";
import type { ProjectView, ProjectViewProps, DataQueryResult } from "obsidian-projects-types";

class MyCustomView extends ProjectView {
  getViewType(): string { return "my-view"; }
  getDisplayName(): string { return "My View"; }
  getIcon(): string { return "layout-grid"; }

  onOpen({ contentEl }: ProjectViewProps) {
    contentEl.createEl("h2", { text: "My Custom View" });
  }

  onData({ data }: DataQueryResult) {
    // data.fields — schema, data.records — notes
  }

  onClose() { /* cleanup */ }
}

export default class MyPlugin extends Plugin {
  onRegisterProjectView = () => new MyCustomView();
}
```

Install types: `npm install --save-dev obsidian-projects-types`

> ⚠️ **This API is experimental** and may change without notice. Details: [obsidian-projects-types/README](obsidian-projects-types/README.md)

### 📣 Contributor Vote: Svelte 3 → 5

Svelte is a **compiler**, not a runtime. The final `main.js` contains no Svelte code. Compiler CVEs don't affect the plugin. Obsidian doesn't check Svelte version.

**For**: runes DX, ecosystem, contributors. **Against**: ~50+ files, breaking API, zero user impact.

> [Vote](https://github.com/ParkPavel/obs-projects-plus/discussions) or open an Issue.

### Development

```bash
git clone https://github.com/ParkPavel/obs-projects-plus.git
cd obs-projects-plus
npm ci
npm run dev       # esbuild watch mode
npm run build     # tsc + esbuild production
npm run test      # Jest (344 tests, 19 suites)
npm run lint      # ESLint + eslint-plugin-obsidianmd (23 rules)
npm run format    # Prettier
```

Details: [CONTRIBUTING.md](CONTRIBUTING.md) • [CODE_STANDARDS.md](docs/CODE_STANDARDS.md)

</details>

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Руководство (RU)](docs/user-guide.md) | Shortcuts, gestures, templates, settings |
| [User Guide (EN)](docs/user-guide-EN.md) | Full instructions in English |
| [Custom View API](obsidian-projects-types/README.md) | Register your own views from other plugins |
| [Release History](RELEASES-EN.md) | All releases |
| [CHANGELOG](CHANGELOG.md) | Keep a Changelog format |
| [Filter Architecture](docs/architecture-filters.md) | Engine specification |
| [Drag & Drop](docs/architecture-drag-drop.md) | Contributor specification |
| [Database View](docs/architecture-database-view.md) | Conceptual document |

---

## 💬 Feedback

- **Telegram**: [@parkpavel_chigon](https://t.me/parkpavel_chigon)
- **GitHub Issues**: [Report a problem](https://github.com/ParkPavel/obs-projects-plus/issues)
- **GitHub Discussions**: [Discussions](https://github.com/ParkPavel/obs-projects-plus/discussions)

---

## 🙏 Credits

Fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) by [Marcus Olsson](https://github.com/marcusolsson).  
Current maintainer: **Park Pavel**

## 📄 License

[Apache License 2.0](LICENSE) © 2024–2026 Park Pavel

---

<div align="center">

**Made with ❤️ for the Obsidian community**

[⭐ Star](https://github.com/ParkPavel/obs-projects-plus) • [🐛 Issues](https://github.com/ParkPavel/obs-projects-plus/issues) • [💬 Telegram](https://t.me/parkpavel_chigon)

</div>
