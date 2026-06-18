# obs-projects-plus — CLAUDE.md

Project-wide instructions for Claude Code. This file is read automatically at session start. For full architecture details see `AGENTS.md`.

## What this project is

Obsidian plugin: project management with Database (12 widget types, 115+ formula functions), Calendar, Board, Gallery views. Notion-parity UX target.

## Stack

- **Svelte 3.59.2** — LOCKED. Do not upgrade. Do not suggest Svelte 4/5 migrations.
- **TypeScript** strict + `exactOptionalPropertyTypes: true`.
- **Jest 29** for unit tests.
- **esbuild** bundler — no webpack, no vite.
- **i18next** for i18n (en, ru, uk, zh-CN).

## Commands

```bash
npm run build         # tsc -noEmit -skipLibCheck + esbuild bundle (production)
npm test              # full jest suite (baseline: see CONTEXT.md)
npm run lint          # ESLint over ./src
npm run svelte-check  # Svelte template + type check
npm run test:watch    # jest watch mode
npx tsc --noEmit -skipLibCheck   # type check only (matches build flags)
```

Test baseline: **156 suites / 2237 tests PASS**, tsc 0 errors. (Updated 2026-06-18 #103; canonical number maintained in `docs/internal/CONTEXT.md` → «Гейты».) Any deviation must be acknowledged before merge.

## Verification protocol — the 4 gates (canonical)

```bash
npm run build         # 1. tsc (-skipLibCheck) + esbuild — 0 errors
npm test              # 2. jest — baseline holds (canonical number in CONTEXT.md)
npm run lint          # 3. ESLint — 0 errors
npm run svelte-check  # 4. svelte-check — 0 errors
```

`svelte-check` and `lint` are NOT optional. No "READY FOR PR" verdict is valid unless all four are green, evidenced by **pasted raw tail output**.

## Economical verification (tiered)

- **Tier 0 — inner loop:** `npx tsc --noEmit -skipLibCheck` on touched area + `npx jest <pattern>` for affected files.
- **Tier 1 — full gate (before any handoff / PR):** the complete 4-gate block. Mandatory before any "ready" claim.

## MCP memory — shared code context

The `memory` MCP server is the pipeline's shared brain:

- **context-manager** (session start): bootstrap/refresh a `codebase` graph — key modules, baseline numbers, types.
- **semantic-analyzer**: write findings into memory as entities/relations with `file:line` observations.
- **architects / senior-developer**: query memory first before reading files; add new observations.
- If the `memory` server is unavailable, fall back to direct read/search and say so.

## Anti-hallucination rules (all agents)

1. **Read before you assert.** Never claim a file, function, type, or path exists without having opened it or matched it via search. Cite `file:line`.
2. **Run before you report.** Never state a command's result you did not actually execute. Paste raw tail output.
3. **Verify paths.** Before referencing a path, confirm it resolves.
4. **No invented numbers.** Baseline, px-budget, function counts come from running the tool.
5. **Surface uncertainty.** "I could not verify X" beats a confident wrong answer.

## Creative judgment

The gates and invariants are hard constraints. Everything else is yours to reason about:

- If the approved plan is wrong, propose the alternative before implementing.
- Question tickets that conflict with the architecture.
- Prefer the smallest change that fully solves the problem, but complete correct beats minimal incomplete.

## Architecture overview

Four-layer "Matryoshka":

```
Shell    → src/main.ts, src/view.ts, src/customViewApi.ts
UI       → src/ui/{app, views, components, modals, settings}
Engine   → src/lib/{engine, database, relations, formula}, src/ui/views/Dashboard/engine/
Data     → src/lib/{dataframe, dataApi.ts, datasources, frontmatter}
```

Dependencies point inward. UI never imports from Shell directly (use ViewApi).

### Key files

| File | Purpose |
|---|---|
| `src/lib/engine/filterEvaluator.ts` | **Canonical** filter engine. No parallel implementations allowed. |
| `src/lib/formula/extendedEvaluator.ts` | 115+ formula functions. |
| `src/lib/dataframe/dataframe.ts` | `DataFieldType` enum. |
| `src/ui/views/Dashboard/types.ts` | `WidgetType` union. |
| `src/ui/views/Dashboard/engine/formulaMetadata.ts` | Function metadata + `findEnclosingCall()`. |
| `src/settings/v4/settings.ts` | `ProjectDefinition` canonical schema. |

## Critical invariants (never break)

1. **Dispatch by `DataFieldType`** — never by `field.name`.
2. **Dates use 4 params**: `startDate`, `startTime`, `endDate`, `endTime`.
3. **Board columns** derived from unique values of selected field. Never hardcoded.
4. **Derived field pipeline**: `applyFormulaFields` → `enrichFrameWithRelations` → display.
5. **Zero `@ts-ignore`** anywhere in `src/`.
6. **PX-budget ratchet ≤ 177** (`src/__tests__/R0_3_pxBudget.test.ts`). All new spacing/typography in `rem`.
7. **`filterEvaluator.ts`** is the single filter engine.
8. **No `new Menu(`** outside `src/lib/contextMenu.ts`.
9. **No hardcoded hex colors** in `src/`. Use design tokens or palette store.

## DataFieldType enum

```
String | Number | Boolean | Date | List | Select | Status
Formula | Relation | Rollup
AutoTime | UniqueId | Unknown
```

## WidgetType union

```
data-table | chart | stats | comparison | checklist | view-port
filter-tabs | summary-row | data-list | sub-base-canvas
yaml-visualizer | database-call
```

## Design tokens

- File: `styles.css`.
- Prefix: `--ppp-*` (general), `--ppp-db-*` (Dashboard V2 palette).
- All new values in `rem`.

## Testing

- Config: `jest.config.js`.
- Mocks: `src/__mocks__/`, `src/ui/views/Dashboard/widgets/__tests__/mocks/`.
- Adding a widget → update `widgetRegistry.test.ts` count AND `configPanelRegistry.test.ts` type list.
- Adding CSS px values → run `npx jest src/__tests__/R0_3_pxBudget.test.ts`.
- Manual testing in the OBStests vault is API-driven: `docs/internal/MANUAL_TESTING_PIPELINE.md`
  (deploy → `app:reload` → assert plugin commands registered → demo-project smoke → roundtrip).
  Deploy without REST verification does not count as deployed.

## Git workflow

- Never commit directly to `main`/`master` — feature branches only.
- Never `git push` from an agent — user controls remote.
- Never `--force` push, `git reset --hard`, or destructive rm.

## Schema evolution rule (UT2026-D P3)

Renaming/removing a config schema value = a triple in ONE commit: new value + migration +
grep all generators (demoProject, widgetTemplates, quick-actions) so they emit the current
schema. Generators must pass migrations as no-op (`configProvenance.test.ts`).

## Code style

- No comments unless WHY is non-obvious.
- No TODO/FIXME without a `#NNN` ticket reference.
- Short focused functions; no premature abstractions.
- Russian for user-facing UI strings; English for code.

## Custom agents (Claude Code)

This repo defines a 9-agent system in `.claude/agents/`. Invoke with the `Agent` tool using `subagent_type`:

- `orchestrator` — autonomous pipeline runner. **User-invocable** via `/run-pipeline`.
- `backend-architect` — design plans for ≥2-module changes (read-only).
- `frontend-architect` — Svelte/widget design plans (read-only).
- `semantic-analyzer` — read-only deep code analysis.
- `senior-developer` — implements approved plans.
- `senior-designer` — CSS tokens / UX specs (read-only).
- `tester` — Jest + tsc + deployment to OBStests vault.
- `audit-manager` — pre-PR invariant and security audit (read-only).
- `context-manager` — maintains session state and `docs/internal/CONTEXT.md`.

## Custom commands (Claude Code)

Slash commands in `.claude/commands/`:

- `/run-pipeline` — start autonomous pipeline (delegates to orchestrator)
- `/pre-pr-audit` — run pre-PR audit (delegates to audit-manager)
- `/spec-new-feature` — SDD-lite spec flow for new epics
- `/backlog-to-issues` — convert BACKLOG.md tickets to GitHub Issues

## Hooks

`.claude/settings.json` enforces deterministic invariants:

- Block `git commit` on main/master.
- Block `git push` to main/master.
- Block destructive git (`reset --hard`, `--force`, `clean`).
- Remind about baseline after `npm test`.
- Block `@ts-ignore` additions in `src/`.

## Project state files

- `docs/internal/CONTEXT.md` — canonical session/project state. Maintained by `context-manager`.
- `docs/internal/BACKLOG.md` — ticket backlog (`#NNN`, P0–P3, XS–XL). Source of truth.

## MCP servers

Configured in `.claude/settings.json` (`mcpServers`): memory, filesystem, fetch.
Obsidian MCP server is in `.claude/settings.local.json` (local-only, gitignored).

GitHub operations use `git` and `gh` CLI directly — no GitHub MCP server.
Verify `gh` auth before `/backlog-to-issues`: `gh auth status`.
