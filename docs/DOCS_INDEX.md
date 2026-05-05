# DOCS_INDEX

> **Версия**: V5.0-foundation (2026-05-05)
> **Замещает**: предыдущие версии DOCS_INDEX (две конкурирующие версии были склеены — переписано с нуля).

## Start here (V5)

1. [MASTER_MAP_V5.md](MASTER_MAP_V5.md) — навигация: цели V5, карта кода, топ долгов, фазы.
2. [ARCHITECTURE_V5.md](ARCHITECTURE_V5.md) — целевая архитектура: 4 слоя, контракты, инварианты.
3. [REFACTOR_BACKLOG_V5.md](REFACTOR_BACKLOG_V5.md) — приоритизированные задачи R5-001…R5-015 с зависимостями.

## Active reference

| Документ | Назначение |
|---|---|
| [CODE_STANDARDS.md](CODE_STANDARDS.md) / [CODE_STANDARDS-RU.md](CODE_STANDARDS-RU.md) | Нормы кода (TS strict, Svelte, тесты). |
| [api.md](api.md) / [api-ru.md](api-ru.md) | Публичный API плагина (custom views). |
| [user-guide.md](user-guide.md) / [user-guide-EN.md](user-guide-EN.md) | Гайд пользователя. |
| [DESIGN_CONCEPT_NOTION_AESTHETIC.md](DESIGN_CONCEPT_NOTION_AESTHETIC.md) | Визуальный референс. |
| [NOTION_PARITY.md](NOTION_PARITY.md) | Список Notion-parity фич (входной материал). |

## Internal coordination

| Файл | Роль |
|---|---|
| `.ai_internal/context_state.md` | Приватный лог решений сессии. |
| `.ai_internal/REVISION_3_USER_DIRECTIVES_2026-05-01.md` | Пользовательская директива по смене курса (вход в V5). |
| `.ai_internal/NOTION_DATABASE_INTEGRATION_MASTER.md`, `NOTION_OBJECTS_UI_TREE.md/.pdf` | Notion reference dumps. |
| `.ai_internal/R0_4_ENTRY_POINTS_INVENTORY.md` | Inventory точек входа (использован при V5 inventory). |
| `.ai_internal/stubs.md` | Реестр заглушек. |
| `memories/repo/session-state.md` | Состояние текущей сессии для агента. |
| `memories/repo/contract-registry.md` | Реестр публичных контрактов модулей. |
| `memories/repo/decision-log.md` | Лог архитектурных решений. |
| `memories/repo/obs-projects-plus-context.md` | Базовый контекст плагина. |
| `memories/repo/bug-tracker.md` | Трекер багов. |

## Archive

Все документы V1-V4 (включая `MASTER_MAP.md`, `ARCHITECTURE.md`, `ARCHITECTURE_V4.md`, `IMPLEMENTATION_PLAN_CURRENT.md`, `PHASE_1_MAPPING.md`, `PHASE_3_TICKETS.md`, ранее заархивированные `DOCUMENTATION_STRUCTURE.md`, `IMPLEMENTATION_BLUEPRINT.md`, `ROADMAP_DATABASE_2026.md`, `architecture-*.md`, `database-view-*.md`, `refactoring-spec-v1.md`, `audit-database-view-specs.md`, `v3.0.9-cache.md`, `v3.3.1-modernization.md`) — в [archive/](archive/).

Архивные документы read-only. Не используются как источник правды.
# Docs Index

> **Last updated**: 2026-05-02 — Refactoring Session v4.0 / Phase 0.
> **Single navigation point** for all documentation in this repository.

## Start here (active documents only)

1. [docs/MASTER_MAP.md](MASTER_MAP.md) — **navigation + module status + known issues map** (refresh after every ticket).
2. [docs/ARCHITECTURE.md](ARCHITECTURE.md) — current codebase map (will be superseded by `ARCHITECTURE_V4.md` after Phase 2).
3. [docs/IMPLEMENTATION_PLAN_CURRENT.md](IMPLEMENTATION_PLAN_CURRENT.md) — active implementation plan (Phase 3 will replace body with refactoring queue).
4. [docs/CODE_STANDARDS.md](CODE_STANDARDS.md) / [CODE_STANDARDS-RU.md](CODE_STANDARDS-RU.md) — engineering standards.
5. [docs/api.md](api.md) / [api-ru.md](api-ru.md) — public Custom View API contract.
6. [docs/user-guide.md](user-guide.md) / [user-guide-EN.md](user-guide-EN.md) — end-user guides.

## Refactoring Session v4.0 artefacts (2026-05-02 →)

| Document | Status | Purpose |
|---|---|---|
| [docs/MASTER_MAP.md](MASTER_MAP.md) | active | Module status, layer map, known-issues priority |
| `docs/ARCHITECTURE_V4.md` | pending (Phase 2) | Target architecture: Unified DataEngine, Dashboard View, Matryoshka Relations, YAML Frontmatter Layer, Unified Color System, Table Rebuild Spec |
| `.ai_internal/context_state.md` | active (continuity log) | Session-state journal |
| `memories/repo/session-state.md` | pending (Phase 4) | Cross-session handoff state |
| `memories/repo/decision-log.md` | pending (Phase 4) | Architectural decision record |
| `memories/repo/contract-registry.md` | pending (Phase 4) | Type/Interface change ledger |

## Process documents (root of repository)

- [../CONTRIBUTING.md](../CONTRIBUTING.md) — onboarding, PR rules, quality gate
- [../CHANGELOG.md](../CHANGELOG.md) — Keep a Changelog
- [../RELEASES.md](../RELEASES.md) / [../RELEASES-EN.md](../RELEASES-EN.md) — narrative release notes
- [../PROJECT-INFO.md](../PROJECT-INFO.md) — verified-facts card
- [../README.md](../README.md) / [../README-EN.md](../README-EN.md) — single entry point

## Internal coordination

- `.ai_internal/context_state.md` — continuity log
- `.ai_internal/REVISION_3_USER_DIRECTIVES_2026-05-01.md` — Revision 3 directive record
- `.ai_internal/stubs.md` — stub & TODO registry (legacy from Stage A; merge into Phase 3 queue)
- `.ai_internal/R0_4_ENTRY_POINTS_INVENTORY.md` — entry-point matrix (read-only inventory)
- `memories/session/handoff.md` — last session handoff
- `memories/repo/*` — agent-scoped repository memory (system-managed)

## Archive

All historical / superseded specifications live under `docs/archive/`. Archive policy: read-only. To re-use a fact, copy it forward to `MASTER_MAP.md` or `ARCHITECTURE_V4.md`.
# Docs Index

> **Last updated**: 2026-04-30 — full documentation reset to match the codebase.

## Goal

Single navigation point for all documentation in this repository.

## Start here

1. [docs/ARCHITECTURE.md](ARCHITECTURE.md) — **master codebase map** (authoritative, single source of truth on layout & vector).
2. [docs/IMPLEMENTATION_BLUEPRINT.md](IMPLEMENTATION_BLUEPRINT.md) — **current execution chart** (Stage A + Stage B, REVISION 2, approved 2026-04-30; pre-coding obligations in flight).
3. [docs/DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md) — where each kind of document lives and how it is owned.
4. [docs/architecture-engine-v2.md](architecture-engine-v2.md) — current Engine v2 design (Relations, Rollups, Custom Properties Viewer, Formula Editor Popup).
5. [docs/IMPLEMENTATION_PLAN_CURRENT.md](IMPLEMENTATION_PLAN_CURRENT.md) — active implementation plan.
6. [docs/ROADMAP_DATABASE_2026.md](ROADMAP_DATABASE_2026.md) — milestone calendar M0–M5.

## Authoritative documents (active)

| Document | Audience | Purpose |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Contributors | Master codebase map, layers, project vector |
| [IMPLEMENTATION_BLUEPRINT.md](IMPLEMENTATION_BLUEPRINT.md) | Maintainers | Stage A + Stage B execution chart with stub registry, doc-standardization plan, and pre-emptive bug map |
| [DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md) | Maintainers | Documentation taxonomy and lifecycle rules |
| [architecture-engine-v2.md](architecture-engine-v2.md) | Contributors | Engine v2 spec (cross-project Relations/Rollups, Custom Properties Viewer, Formula Editor Popup) |
| [IMPLEMENTATION_PLAN_CURRENT.md](IMPLEMENTATION_PLAN_CURRENT.md) | Maintainers | Active plan, findings F1–F12, milestones M0–M5, risk register |
| [ROADMAP_DATABASE_2026.md](ROADMAP_DATABASE_2026.md) | All | Calendar with milestones M0–M5 and version policy |

## User & API documents

| Document | Audience |
|---|---|
| [user-guide.md](user-guide.md) | RU end users |
| [user-guide-EN.md](user-guide-EN.md) | EN end users |
| [api.md](api.md) | EN — public-facing engine/API surface |
| [api-ru.md](api-ru.md) | RU — public-facing engine/API surface |
| [CODE_STANDARDS.md](CODE_STANDARDS.md) | EN — engineering standards |
| [CODE_STANDARDS-RU.md](CODE_STANDARDS-RU.md) | RU — engineering standards |

## Reference (still valid, not the active plan)

| Document | Subject |
|---|---|
| [architecture-database-view.md](architecture-database-view.md) | Database View widget architecture (v3.3.x baseline; Engine v2 supersedes cross-project portions) |
| [architecture-agenda.md](architecture-agenda.md) | Agenda 2.0 |
| [architecture-drag-drop.md](architecture-drag-drop.md) | Calendar Timeline + Board DnD |
| [architecture-filters.md](architecture-filters.md) | 42-operator filter engine |
| [database-view-ui-ux.md](database-view-ui-ux.md) | UI/UX patterns for Database View (v3.3.x reference, frozen) |
| [database-view-pivot.md](database-view-pivot.md) | TransformPipeline pivot/unpivot spec (v3.3.x reference, implemented) |

## Process documents (root of repository)

- [../CONTRIBUTING.md](../CONTRIBUTING.md) — onboarding, PR rules, quality gate
- [../CHANGELOG.md](../CHANGELOG.md) — Keep a Changelog (vocabulary note for ≥ 3.4.2 in header)
- [../RELEASES.md](../RELEASES.md) / [../RELEASES-EN.md](../RELEASES-EN.md) — narrative release notes
- [../PROJECT-INFO.md](../PROJECT-INFO.md) — quick verified-facts card
- [../README.md](../README.md) / [../README-EN.md](../README-EN.md) — single entry point (RU/EN)
- [../demo-vault/README.md](../demo-vault/README.md) — try-it-now sample vault

## Internal coordination (`.ai_internal/`, `memories/`)

- [../.ai_internal/context_state.md](../.ai_internal/context_state.md) — running session state log
- [../.ai_internal/stubs.md](../.ai_internal/stubs.md) — registry of every deferred-work site (`STB-*` IDs); referenced from [IMPLEMENTATION_BLUEPRINT.md §13](IMPLEMENTATION_BLUEPRINT.md#13-stub--todo-discipline)
- [../memories/session/handoff.md](../memories/session/handoff.md) — session boundary handoff for continuation agents
- [../memories/repo/](../memories/repo/) — repo-scoped memory (bug tracker, project context, inventories)

## Debug notes

- [debug/tag-detection-analysis.md](debug/tag-detection-analysis.md)

## Archive

Historical documents kept for traceability — see [archive/README.md](archive/README.md). They are **not authoritative** for current work.

## Update rules

- Keep one active implementation plan only (`IMPLEMENTATION_PLAN_CURRENT.md`).
- Keep one active roadmap only (`ROADMAP_DATABASE_2026.md`).
- `ARCHITECTURE.md` is updated when top-level `src/` layout changes or the project vector changes.
- `architecture-engine-v2.md` is the authority on engine design — update it before implementing.
- Reference docs may go stale on minor details; if a fact changes, update the reference doc or move it to archive and write a replacement.
- Update this index whenever a document is added, archived, or renamed.
