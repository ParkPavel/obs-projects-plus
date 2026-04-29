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

## Verified Quality Baseline (2026-04-22)

- Test suites: 42 passed
- Tests: 839 passed
- Build: successful (production)
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

This repository uses layered documentation:

- Product docs: README.md, README-EN.md, RELEASES.md, RELEASES-EN.md, CHANGELOG.md
- User docs: docs/user-guide.md, docs/user-guide-EN.md
- Architecture and specs: docs/architecture-*.md, docs/database-view-*.md
- Process and standards: CONTRIBUTING.md, docs/CODE_STANDARDS.md
- Active planning docs:
	- docs/DOCUMENTATION_STRUCTURE.md
	- docs/IMPLEMENTATION_PLAN_CURRENT.md

## Current Stage vs Target

- Current stage: release 3.4.1 stabilized and published; Database backend and baseline UI are functional.
- Target stage: Notion-level discoverability and flow for Database workflows (overview-first IA, quick actions, relation/rollup-first KPI surfaces, full per-step pipeline UX).
- Primary gap: UX coherence and end-user discoverability lag behind available backend capability.

## Source of Truth Policy

- Runtime and feature truth: src/
- Release truth: manifest.json + versions.json + GitHub release assets
- Product-change truth: CHANGELOG.md
- Long-form implementation truth: docs/IMPLEMENTATION_PLAN_CURRENT.md
