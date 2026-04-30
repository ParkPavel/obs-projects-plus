# Documentation Structure

## Purpose

This file defines where each kind of information must live so the documentation stays clean, non-duplicated, and code-linked.

## Layers

| # | Layer | Audience | Files |
|---|---|---|---|
| 1 | Product surface | End users, release readers | `README.md`, `README-EN.md`, `RELEASES.md`, `RELEASES-EN.md`, `CHANGELOG.md`, `PROJECT-INFO.md` |
| 2 | User operation guides | End users | `docs/user-guide.md`, `docs/user-guide-EN.md` |
| 3 | Architecture (authoritative) | Contributors | `docs/ARCHITECTURE.md`, `docs/architecture-engine-v2.md` |
| 4 | Architecture (reference) | Contributors | `docs/architecture-*.md`, `docs/database-view-*.md` |
| 5 | Engineering process | Contributors | `CONTRIBUTING.md`, `docs/CODE_STANDARDS.md`, `docs/CODE_STANDARDS-RU.md` |
| 6 | Planning (active) | Maintainers | `docs/IMPLEMENTATION_PLAN_CURRENT.md`, `docs/ROADMAP_DATABASE_2026.md` |
| 7 | Public API contract | External plugin authors | `obsidian-projects-types/`, `docs/api.md`, `docs/api-ru.md` |
| 8 | Internal continuity | Agents & maintainers | `.ai_internal/context_state.md`, `memories/repo/` |
| 9 | Archive | Anyone tracing decisions | `docs/archive/` (read-only by convention) |

## Ownership rules

- **Layer 1** is updated on every release. Truth source: `manifest.json` + `package.json` + GitHub release assets.
- **Layer 2** is updated when user-visible behaviour changes. Mirror keys EN ↔ RU.
- **Layer 3** is the master architectural truth. `ARCHITECTURE.md` is updated when top-level `src/` layout or the project vector changes. `architecture-engine-v2.md` is updated before implementation, not after.
- **Layer 4** documents stay in place as long as they are accurate; otherwise they are either revised or moved to `docs/archive/` with a banner.
- **Layer 5** is the contract with new contributors. Quality-gate metrics (suite/test counts) here must match real `npm test` output.
- **Layer 6** holds **at most one active plan** and **at most one active roadmap**. Older plans are archived.
- **Layer 7** must not be broken without a major-version bump.
- **Layer 8** is process memory. Not for end users.
- **Layer 9** is read-only. If a fact from an archived doc is still needed, copy it forward into a layer 1–4 document.

## Active document inventory (2026-04-30)

| Path | Layer | Status |
|---|---|---|
| `README.md` / `README-EN.md` | 1 | Active |
| `RELEASES.md` / `RELEASES-EN.md` | 1 | Active |
| `CHANGELOG.md` | 1 | Active |
| `PROJECT-INFO.md` | 1 | Active |
| `docs/user-guide.md` / `user-guide-EN.md` | 2 | Active |
| `docs/ARCHITECTURE.md` | 3 | Active (master) |
| `docs/architecture-engine-v2.md` | 3 | Active |
| `docs/architecture-database-view.md` | 4 | Reference (Engine v2 supersedes cross-project portion) |
| `docs/architecture-agenda.md` | 4 | Reference |
| `docs/architecture-drag-drop.md` | 4 | Reference |
| `docs/architecture-filters.md` | 4 | Reference |
| `docs/database-view-ui-ux.md` | 4 | Reference (frozen v3.3.x UI/UX spec) |
| `docs/database-view-pivot.md` | 4 | Reference (frozen v3.3.x; pipeline implemented) |
| `CONTRIBUTING.md` | 5 | Active |
| `docs/CODE_STANDARDS.md` / `CODE_STANDARDS-RU.md` | 5 | Active |
| `docs/IMPLEMENTATION_PLAN_CURRENT.md` | 6 | Active |
| `docs/IMPLEMENTATION_BLUEPRINT.md` | 6 | Active (current execution chart) |
| `docs/ROADMAP_DATABASE_2026.md` | 6 | Active |
| `docs/api.md` / `api-ru.md` | 7 | Active |
| `obsidian-projects-types/README.md` | 7 | Active |
| `.ai_internal/context_state.md` | 8 | Active |
| `memories/repo/*.md` | 8 | Active |
| `docs/archive/` | 9 | Archive |

## Lifecycle: when to archive a document

A document is archived when **all** of the following are true:

1. Its plan, spec, or analysis has been delivered, cancelled, or fully superseded.
2. No active document references it as the source of truth.
3. It still has historical value (decisions, rationale) worth preserving.

Archive procedure: move to `docs/archive/`, add an `> ARCHIVED YYYY-MM-DD` banner at the top, and update [DOCS_INDEX.md](DOCS_INDEX.md).

## Forbidden patterns

- Two documents claiming to be authoritative on the same subsystem.
- A README, CONTRIBUTING, or PROJECT-INFO with metrics (suite count, test count, ESLint version) that do not match `package.json` and real test output.
- An archived document referenced as authoritative from any active document.
- Duplicated tables between `README.md` and `docs/ARCHITECTURE.md`. The README contains the user-facing summary; `ARCHITECTURE.md` contains the engineering map.
