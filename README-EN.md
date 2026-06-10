# OBS Projects Plus

<div align="center">

![Version](https://img.shields.io/badge/version-3.5.1--alpha-orange.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-v1.5.7+-purple.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)
[![Downloads](https://img.shields.io/github/downloads/ParkPavel/obs-projects-plus/total.svg)](https://github.com/ParkPavel/obs-projects-plus/releases)
[![Telegram](https://img.shields.io/badge/Telegram-Channel-blue.svg?logo=telegram)](https://t.me/parkpavel_chigon)

**Your Markdown files as a database: tables, kanban, calendar, gallery, interactive Dashboard**

[Русский](README.md) | English

</div>

---

> **Status: Alpha (3.5.1-alpha) — active development**
>
> Core views (Table, Board, Calendar, Gallery) are stable.
> Dashboard V2 is in active development: phases 0–4.5 complete, UI modernization in progress.

---

## Why this plugin?

Obsidian stores everything in plain Markdown files. **Projects Plus** reads the frontmatter of your notes as structured data — **your folder is already a database**, no import or migration required.

Edit a field in the table — it writes back to the frontmatter. Edit the frontmatter by hand — the Dashboard updates immediately. **One entity, two interfaces.**

### Who it's for

- **Clinical practitioners** (massage therapists, psychologists, coaches) — client database + sessions + progress tracking
- **Researchers** — sources, notes, deadlines with filtering and cross-analytics
- **Project managers** — tasks, meetings, statuses without leaving Obsidian
- **Anyone with a knowledge base** — when you need a visual overview, not a file list

### How it works

1. You point to a **folder**, **tag**, or **Dataview query** — this is your "project"
2. The plugin reads the `frontmatter` (YAML header) of all matching notes
3. You pick a **view** — table, board, calendar, gallery, or Dashboard
4. Edit fields right in the interface — the plugin writes changes back to the file

**Your data stays in your files.** No proprietary database.

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
|---|---|:---:|
| **Table** | Editing with sorting, filtering, cell navigation | Stable |
| **Board** | Kanban — drag cards, column persist, Ctrl+Scroll zoom (25–200%) | Stable |
| **Calendar** | Timeline 07:00–22:00, multi-day bars, 5 zoom levels (Year → Day), mobile gestures | Stable |
| **Gallery** | Cards with covers and frontmatter fields | Stable |
| **Dashboard** | Interactive multi-block canvas with reactive links between blocks | Alpha |

**Calendar** — a full planner: `startDate`, `endDate`, `startTime`, `endTime`, `date`, `color` for color coding, infinite scroll, mobile gestures (swipe, pinch-to-zoom, double tap to create a note).

**Agenda 2.0** — calendar sidebar with a list builder: 42 filter operators, nested AND/OR groups, date formulas (`today`, `sow`, `eom`, `today+1w`), visual and Advanced modes.

**Board** — column persist: columns stay visible even without matching records; note creation inherits active filters.

**Dashboard V2** — interactive multi-block canvas:

- **Canvas Selection Bus** — click a record in one block to reactively filter data in linked blocks
- **Multi-select filtering** — `is-any-of` operator, multiple records as a filter
- **Data block (`database-call`)** — autonomous atom: Table / Board / Calendar / Gallery in one block with its own source
- **Linked blocks** — select a client in block A → blocks B, C, D automatically show only their data
- **Unified FilterPanel** — identical filter UI at all levels (project / view / widget)
- **115+ formula functions** with a visual constructor
- **Matryoshka** (sub-bases) — database inside a database via wikilink relations
- **Dataview bridge** — Dataview query as a data source for any block

> For shortcuts, gestures, templates, and settings — see the **[User Guide](docs/user-guide-EN.md)**.

**Three data sources**: folder, tag, Dataview query. Note templates, autosave, localization (RU, EN, UA, ZH-CN).

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

1. On first launch the plugin creates a **demo project** (B2B agency: clients, tasks, meetings, 5 views)
2. `Ctrl/Cmd+P` → *"Projects Plus: Show projects plus"*
3. Switch between views: Table → Board → Calendar → Gallery → Dashboard
4. Create your own project: `Ctrl/Cmd+P` → *"Projects Plus: Create Project"*

```yaml
# Example frontmatter for a project note
---
title: John Smith
status: active
diagnosis: "L4-L5"
firstVisit: 2026-01-15
sessions: 0
client: "[[Client]]"
---
```

---

## Roadmap

| Milestone | What's included | Status |
|---|---|:---:|
| M-ENGINE-CLEANUP | Unified formula engine, filter stack, ReDoS guard | Done |
| M-COLOR-SETTINGS | Color palette unification, settings v4 migration | Done |
| M-CANVAS-REACTIVE | Dashboard reactive loop, DataProvider Registry | Done |
| M-TABLE-REWRITE | Dashboard DataTable with virtualization and group headers | Done |
| M-SUBBASES | Sub-base canvas (Matryoshka), bidirectional relations | Done |
| M-FREE-CANVAS | FreeCanvas shell, WindowShell drag/resize, layout migration | Done |
| M-POPUP-STANDARDISATION | FloatingPopup engine, unified popups, inline badges | Done |
| M-INTERACTIVE-DASHBOARD | Canvas Selection Bus, cross-widget filtering, multi-select | Done |
| M-DATAVIEW-BRIDGE | Dataview as adaptive query backend with Notion semantics | Done |
| M-UX | Emoji→Lucide sweep, demo project V2, reactive fix | Done |
| **Dashboard V2 (Phase 0–4.5)** | CI baseline, Engine→lib, Unified Filter, Canvas decompose, DatabaseCallWidget, Selection Bus | Current branch |
| **M-UI-MODERNIZATION** | Tokens, WidgetShell, DatabaseCall Table View, V1 widget archive | In progress |
| M-VISION-PARITY | SmartSuggest, templates, field transparency, canvas zero-state | Planned |

Full ticket backlog: [docs/internal/BACKLOG.md](docs/internal/BACKLOG.md).

---

## Known Issues

| # | Issue | Priority | Workaround |
|---|---|:---:|---|
| #004 | Row count in table footer may diverge from actual records when filters are active | P1 | Reset filters to see the accurate count |

---

<details>
<summary><h2>For Developers</h2></summary>

### Development

```bash
git clone https://github.com/ParkPavel/obs-projects-plus.git
cd obs-projects-plus
npm ci
npm run dev           # esbuild watch mode
npm run build         # tsc check + esbuild production bundle
npm test              # Jest (134 suites / 2020 tests)
npm run lint          # ESLint 9 + eslint-plugin-obsidianmd
npm run svelte-check  # Svelte template + type check
```

**Stack**: TypeScript strict + `exactOptionalPropertyTypes`, Svelte 3.59.2 (locked), Jest 29, esbuild.

**4-gate CI**: `build` → `test` → `lint` → `svelte-check` — all must be 0 errors.

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

> **This API is experimental** and may change without notice.

### Architecture

4-layer Matryoshka (Shell → UI → Engine → Data). Details: [docs/ARCHITECTURE_V5.md](docs/ARCHITECTURE_V5.md).

</details>

---

## Documentation

| Document | Description |
|---|---|
| [User Guide (RU)](docs/user-guide.md) | Shortcuts, gestures, templates, settings (Russian) |
| [User Guide (EN)](docs/user-guide-EN.md) | Full instructions in English |
| [CONTRIBUTING](CONTRIBUTING.md) | How to contribute, branching, PR process |
| [Backlog / Roadmap](docs/internal/BACKLOG.md) | Tickets #NNN by milestones, statuses |
| [Custom View API](obsidian-projects-types/README.md) | Register your own views from other plugins |
| [CHANGELOG](CHANGELOG.md) | Change history |

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
