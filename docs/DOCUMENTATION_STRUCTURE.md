# Documentation Structure

## Purpose

This file defines where each type of information must live to keep docs clean, non-duplicated, and code-linked.

## Layers

1. Product surface (for users and releases)

- README.md / README-EN.md: capabilities, install, quick start, high-level roadmap.
- RELEASES.md / RELEASES-EN.md: release notes digest.
- CHANGELOG.md: canonical change history.

2. User operation guides

- docs/user-guide.md
- docs/user-guide-EN.md

3. Architecture and design

- docs/architecture-*.md
- docs/database-view-*.md

4. Engineering process

- CONTRIBUTING.md
- docs/CODE_STANDARDS.md
- docs/CODE_STANDARDS-RU.md

5. Planning and execution (active)

- docs/IMPLEMENTATION_PLAN_CURRENT.md

6. Internal continuity (non-public process memory)

- .ai_internal/context_state.md

## Docs Inventory (2026-04-22)

Active:

- docs/IMPLEMENTATION_PLAN_CURRENT.md
- docs/DOCUMENTATION_STRUCTURE.md
- docs/DOCS_INDEX.md
- docs/ROADMAP_DATABASE_2026.md
- docs/user-guide.md
- docs/user-guide-EN.md
- docs/api.md
- docs/api-ru.md
- docs/CODE_STANDARDS.md
- docs/CODE_STANDARDS-RU.md

Reference (historical architecture/spec context):

- docs/architecture-database-view.md
- docs/database-view-v3.4.0-spec.md
- docs/database-view-ui-ux.md
- docs/database-view-pivot.md
- docs/refactoring-spec-v1.md
- docs/audit-database-view-specs.md
- docs/architecture-agenda.md
- docs/architecture-drag-drop.md
- docs/architecture-filters.md
- docs/v3.0.9-cache.md

Archive:

- docs/architecture-database-view.OLD.md
- docs/v3.3.1-modernization.md

Debug notes:

- docs/debug/tag-detection-analysis.md

## Anti-noise Rules

- Do not keep duplicated release notes in random root files.
- Keep historical drafts with explicit markers (for example .OLD.md) and reference them as archive-only.
- Keep metrics in docs only if they are verified against current test/build output.
- Link major plan items to concrete code paths in src/.
- Keep one active implementation plan only: docs/IMPLEMENTATION_PLAN_CURRENT.md.
- Keep one active roadmap only: docs/ROADMAP_DATABASE_2026.md.

## Ownership Matrix

- Product docs: maintainers and docs updates after each release.
- Architecture docs: feature owners.
- Implementation plan: current execution owner.
- Internal context: session maintainer.