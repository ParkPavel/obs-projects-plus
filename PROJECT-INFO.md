# Project Information

## Overview

Projects Plus is an actively maintained fork of the original Obsidian Projects plugin.

- Current version: 3.4.2
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
- i18n: i18next (EN / RU / UK / ZH-CN)

## Quality Baseline (2026-05-05)

- Test suites: 98 passed
- Tests: ~1597 passed
- Build: successful (production)
- Type-check: `tsc -noEmit -skipLibCheck` — 0 errors
- px-budget ratchet: 191

## Code Map (high-level)

- Entry and lifecycle: `src/main.ts`, `src/view.ts`, `src/managers/`
- Data layer: `src/lib/datasources/`, `src/lib/dataframe/`, `src/lib/frontmatter/`
- Engine: `src/lib/engine/`, `src/lib/formula/`, `src/lib/relations/`
- Views: `src/ui/views/`
  - Dashboard: `src/ui/views/Dashboard/` (canvas + widgets + engine)
  - Board: `src/ui/views/Board/`
  - Calendar: `src/ui/views/Calendar/`
  - Gallery: `src/ui/views/Gallery/`
  - Table (legacy, scheduled for removal): `src/ui/views/Table/`
  - YAML Visualizer: `src/ui/views/YamlVisualizer/`

## Documentation Structure

Full navigation: [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md).

- Community: README.md, CHANGELOG.md, docs/api.md
- Engineering: CONTRIBUTING.md, docs/CODE_STANDARDS.md, docs/ARCHITECTURE_V5.md
- Internal planning: docs/internal/ (MASTER_MAP_V5, REFACTOR_BACKLOG_V5)
- Archive: docs/archive/ (read-only)

## Source of Truth Policy

- Runtime truth: src/
- Release truth: manifest.json + CHANGELOG.md
- Architecture truth: docs/ARCHITECTURE_V5.md
- Refactor queue: docs/internal/REFACTOR_BACKLOG_V5.md
