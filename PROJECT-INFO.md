# Project Information

## Overview

Projects Plus is an actively maintained fork of the original Obsidian Projects plugin.

- Current public release: 3.4.1
- Platform baseline: Obsidian 1.5.7+
- Runtime package contract: main.js + manifest.json + styles.css

## Maintainers

- Current maintainer: Park Pavel (https://github.com/ParkPavel)
- Original author: Marcus Olsson (https://github.com/marcusolsson)

## Verified Stack (from package.json)

- Language: TypeScript (strict)
- UI: Svelte 3.59.2
- Build: esbuild + tsc
- Tests: Jest 29
- Lint/format: ESLint + Prettier
- i18n: i18next

## Verified Quality Baseline (2026-04-30)

- Test suites: 54 passed
- Tests: ~923 passed
- Build: successful (production)
- Type-check: `tsc -noEmit -skipLibCheck` — 0 errors
- Runtime artifacts in root: main.js, manifest.json, styles.css

## Code Map (high-level)

- Entry and lifecycle: src/main.ts, src/view.ts
- Data layer: src/lib/datasources, src/lib/dataframe
- Shared engines/helpers: src/lib/helpers, src/lib/stores
- Views: src/ui/views
	- Board: src/ui/views/Board
	- Calendar: src/ui/views/Calendar
	- Gallery: src/ui/views/Gallery
	- Database: src/ui/views/Database

## Database View Reality Snapshot

- Widget registry (8 types): src/ui/views/Database/widgets/widgetRegistry.ts
- Pipeline editor core: src/ui/views/Database/widgets/PipelineEditor.svelte
- Transform execution: src/ui/views/Database/engine/transformExecutor.ts
- Multi-source merge: src/lib/datasources/mergeFrames.ts

## Documentation Structure

This repository uses layered documentation. The full map is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Layers in short:

- Product: README.md, README-EN.md, RELEASES.md, RELEASES-EN.md, CHANGELOG.md
- User: docs/user-guide.md, docs/user-guide-EN.md
- Architecture (authoritative): docs/ARCHITECTURE.md, docs/architecture-engine-v2.md
- Architecture (reference): docs/architecture-database-view.md, docs/architecture-agenda.md, docs/architecture-drag-drop.md, docs/architecture-filters.md, docs/database-view-ui-ux.md, docs/database-view-pivot.md
- Process: CONTRIBUTING.md, docs/CODE_STANDARDS.md
- Active planning:
	- docs/IMPLEMENTATION_PLAN_CURRENT.md
	- docs/ROADMAP_DATABASE_2026.md
- Archive: docs/archive/ (read-only historical context)

## Current Stage vs Target

- Current stage: 3.4.1 published. Database View backend is functional, baseline UI is shipped, Phases 1–6 of the v3.4.x architectural reset are complete (Phase 7 release was cancelled).
- Active work: Engine v2 milestones M0–M4 inside the **3.4.X WIP** range — cross-project Relations & Rollups, Custom Properties Viewer, unified Formula Editor Popup. None of these versions are public.
- Target stage: M5 — first public Engine v2 release (3.5.0+) with full Notion-class typed data modelling on top of plain Markdown + YAML.
- Primary gap: cross-project linkage and discoverable property editing UI.

## Source of Truth Policy

- Runtime and feature truth: src/
- Release truth: manifest.json + versions.json + GitHub release assets
- Product-change truth: CHANGELOG.md
- Long-form implementation truth: docs/IMPLEMENTATION_PLAN_CURRENT.md
