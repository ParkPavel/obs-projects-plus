# OBS Projects Plus

<div align="center">

![Version](https://img.shields.io/badge/version-3.5.1--alpha-orange.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-v1.5.7+-purple.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)
[![Downloads](https://img.shields.io/github/downloads/ParkPavel/obs-projects-plus/total.svg)](https://github.com/ParkPavel/obs-projects-plus/releases)
[![Telegram](https://img.shields.io/badge/Telegram-Channel-blue.svg?logo=telegram)](https://t.me/parkpavel_chigon)

**Project management in Obsidian: tables, boards, calendar with timeline, gallery, Dashboard**

[Русский](README.md) | English

</div>

---

> **Status: Alpha (3.5.1-alpha)**
>
> The plugin is under active development. Core views (Table, Board, Calendar, Gallery) are stable. Dashboard is in its final development stage.
>
> **Known issue (P0):** Dashboard does not auto-refresh when vault files change. If you edit a note, switch to another view and back, or close and reopen the project tab. A fix is in progress (milestone M-CANVAS-REACTIVE).

---

## Why this plugin?

Obsidian stores everything in plain Markdown files. That works great for text — but when you have dozens or hundreds of notes, it's hard to see what's where and in what state.

**Projects Plus** turns a folder of notes into a managed project: you see all tasks on a kanban board, all events on a calendar, all cards in a gallery — all without export, without cloud, right in your vault.

Your data **stays in your files**. The plugin does not create its own database.

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

---

## Gallery

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
<summary align="center"><b>Click to view full size</b></summary>
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

## Features

| View | What it does | Status |
|------|-------------|:------:|
| **Table** | Editing with sorting, filtering, cell navigation | Stable |
| **Board** | Kanban — drag cards, column persist, Ctrl+Scroll zoom (25–200%) | Stable |
| **Calendar** | Timeline 07:00–22:00, multi-day bars, 5 zoom levels (Year → Day), mobile gestures | Stable |
| **Gallery** | Cards with covers and frontmatter fields | Stable |
| **Dashboard** | Multi-widget canvas: 8 widget types, 10 chart types, transform pipeline, sub-bases | Alpha — see below |

**Calendar** — a full planner: `startDate`, `endDate`, `startTime`, `endTime`, `date`, `color` for color coding, infinite scroll, mobile gestures (swipe, pinch-to-zoom, double tap to create a note).

**Agenda 2.0** — calendar sidebar with a list builder: 42 filter operators, nested AND/OR groups, date formulas (`today`, `sow`, `eom`, `today+1w`), two modes — visual and Advanced.

**Board** — column persist: columns stay visible even with no matching records, Ctrl+Scroll zoom (25–200%), note creation inherits active filters.

**Dashboard** — a multi-widget canvas layered on top of project data. Each of the 8 widgets is independent with its own transform pipeline (unnest → unpivot → compute → filter → group-by → aggregate → pivot + cross-project join). Sub-bases are named tabs applying independent filters to the same dataset. **ViewPort** embeds Table, Board, Calendar, or Gallery inside the canvas. Two layout modes: vertical stack and adaptive 12-column grid.

> For shortcuts, gestures, templates, and settings details — see the **[User Guide](docs/user-guide-EN.md)**.

**Three data sources**: folder, tag, Dataview query. Note templates, autosave, localization (RU, EN, UA, ZH-CN).

---

## Known Issues

| # | Issue | Priority | Workaround |
|---|-------|:--------:|------------|
| [#016](docs/internal/BACKLOG.md) | Dashboard does not auto-refresh when vault files change | **P0** | Switch to another view and back, or close and reopen the project tab |
| #004 | Row count in table footer may diverge from actual records when filters are active | P1 | Reset filters to see the accurate count |

---

## Installation

### BRAT (Recommended for alpha versions)
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. In BRAT settings, add: `ParkPavel/obs-projects-plus`
3. Enable the plugin

### Manual Installation
1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/ParkPavel/obs-projects-plus/releases)
2. Place in `.obsidian/plugins/obs-projects-plus/`
3. Restart Obsidian → Enable the plugin

---

## Quick Start

1. On first launch the plugin creates a **demo project** (35+ notes, all views)
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

## Roadmap

| Milestone | What's included | Status |
|-----------|----------------|:------:|
| **M-ENGINE-CLEANUP** | Unified formula engine, filter stack, ReDoS guard, context menu | Done |
| **M-COLOR-SETTINGS** | Color palette unification, settings v4 migration | Done |
| **M-CANVAS-REACTIVE** | Closing the Dashboard reactive loop (#016 P0), splitting DashboardCanvas.svelte | Current |
| **M-TABLE-REWRITE** | Remove legacy DataGrid, modern Notion-spec table | Planned |
| **M-SUBBASES** | Sub-base canvas widget, full UI wiring in DashboardCanvas | Planned |
| **M-YAML-FORMULA-UI** | Visual formula constructor, YAML visualizer as Dashboard widget | Planned |
| **M-DATAVIEW-BRIDGE** | Dataview as adaptive query backend with Notion semantics | Planning |

Full ticket backlog: [docs/internal/BACKLOG.md](docs/internal/BACKLOG.md).

---

<details>
<summary><h2>For Developers</h2></summary>

### Development

```bash
git clone https://github.com/ParkPavel/obs-projects-plus.git
cd obs-projects-plus
npm ci
npm run dev       # esbuild watch mode
npm run build     # tsc check + esbuild production bundle
npm test          # Jest (116 suites / 1800 tests)
npx tsc --noEmit  # type check only
npm run lint      # ESLint 9 + eslint-plugin-obsidianmd
npm run format    # Prettier
```

**Stack**: TypeScript strict, Svelte 3.59.2 (locked), Jest 29, esbuild.

### Custom View API (Experimental)

The plugin supports registering custom views from third-party plugins.

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

> **This API is experimental** and may change without notice. Details: [obsidian-projects-types/README](obsidian-projects-types/README.md)

### Architecture

4-layer architecture, invariants, and module contracts: [docs/ARCHITECTURE_V5.md](docs/ARCHITECTURE_V5.md).  
Code standards: [docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md).  
Public API: [docs/api.md](docs/api.md).

</details>

---

## Documentation

| Document | Description |
|----------|-------------|
| [User Guide (RU)](docs/user-guide.md) | Shortcuts, gestures, templates, settings (Russian) |
| [User Guide (EN)](docs/user-guide-EN.md) | Full instructions in English |
| [Project Info](PROJECT-INFO.md) | What this project is, goals, license history |
| [Demo Vault](demo-vault/README.md) | Ready-made vault to try the plugin |
| [CONTRIBUTING](CONTRIBUTING.md) | How to contribute, branching, PR process |
| [Architecture V5](docs/ARCHITECTURE_V5.md) | Start here for contributors — 4-layer architecture, invariants |
| [Backlog / Roadmap](docs/internal/BACKLOG.md) | Tickets #NNN by milestones, statuses |
| [Custom View API](obsidian-projects-types/README.md) | Register your own views from other plugins |
| [CHANGELOG](CHANGELOG.md) | Change history |
| [Releases](RELEASES-EN.md) | All releases with descriptions |
| [Docs Index](docs/DOCS_INDEX.md) | Full documentation navigation |

---

## Feedback

- **Telegram**: [@parkpavel_chigon](https://t.me/parkpavel_chigon)
- **GitHub Issues**: [Report a problem](https://github.com/ParkPavel/obs-projects-plus/issues)
- **GitHub Discussions**: [Discussions](https://github.com/ParkPavel/obs-projects-plus/discussions)

---

## Credits

Fork of the original [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) by [Marcus Olsson](https://github.com/marcusolsson).  
Current maintainer: **Park Pavel**

## License

[Apache License 2.0](LICENSE-INFO.md) © 2024–2026 Park Pavel

---

<div align="center">

**Made for the Obsidian community**

[Star](https://github.com/ParkPavel/obs-projects-plus) • [Issues](https://github.com/ParkPavel/obs-projects-plus/issues) • [Telegram](https://t.me/parkpavel_chigon)

</div>
