# obs-projects-plus — AGENTS.md

Project-wide instructions for AI coding agents working in this repository. Open standard, read by GitHub Copilot, Codex CLI, Aider, and other agentic tools. Keep concise; link to detailed docs.

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
npm run build       # tsc check + esbuild bundle (production)
npm test            # full jest suite
npm run test:watch  # jest watch mode
npx tsc --noEmit    # type check only
```

Test baseline: **139 suites / 2099 tests PASS**, tsc 0 errors. (Updated 2026-06-05.) Any deviation must be acknowledged before merge.

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
| `src/lib/dataframe/dataframe.ts` | `DataFieldType` enum (dispatch by type, never by name). |
| `src/ui/views/Dashboard/types.ts` | `WidgetType` union. Update tests when extending. |
| `src/ui/views/Dashboard/engine/formulaMetadata.ts` | Function metadata + `findEnclosingCall()`. |
| `src/settings/v4/settings.ts` | `ProjectDefinition` canonical schema. |

Full architecture details in `docs/internal/NOTION_PARITY.md` and `docs/internal/DASHBOARD_V2_MASTER_PROMPT.md`.

## Critical invariants (never break)

1. **Dispatch by `DataFieldType`** — never by `field.name`.
2. **Dates use 4 params**: `startDate`, `startTime`, `endDate`, `endTime`.
3. **Board columns** derived from unique values of selected field. Never hardcoded.
4. **Derived field pipeline**: `applyFormulaFields` → `enrichFrameWithRelations` → display.
5. **Zero `@ts-ignore`** anywhere in `src/`. If types resist, fix the types.
6. **PX-budget ratchet ≤ 186** (`src/__tests__/R0_3_pxBudget.test.ts`). All new spacing/typography in `rem`. May DECREASE only after real conversion. NEVER increase without explicit approval.
7. **`filterEvaluator.ts`** is the single filter engine. Do not create parallel implementations.
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

- File: `styles.css` (hand-maintained; esbuild merges via `esbuild.config.mjs::mergeCSS()`).
- Prefix: `--ppp-*` (general), `--ppp-db-*` (Dashboard V2 palette: pastel HSL, status/priority/chip colors).
- All new values in `rem`. Respect Obsidian CSS vars (`--background-primary`, `--text-normal`, ...).

## Testing

- Config: `jest.config.js`.
- Mocks: `src/__mocks__/`, `src/ui/views/Dashboard/widgets/__tests__/mocks/`.
- Adding a widget → update `widgetRegistry.test.ts` count AND `configPanelRegistry.test.ts` type list.
- Adding a `DataFieldType` value → check exhaustive switch branches.
- Adding CSS px values → run `npx jest src/__tests__/R0_3_pxBudget.test.ts` (must stay ≤ 186).

## Git workflow

- Never commit directly to `main`/`master` — feature branches only (`feat/<desc>` or `fix/<desc>`).
- Never `git push` from an agent — user controls remote.
- Never `--force` push, `git reset --hard`, or destructive rm — move to archive instead.
- Merge gate (before user-performed merge):
  - `npx tsc --noEmit` → 0 errors
  - `npm test` → baseline holds
  - audit-manager subagent verdict `READY FOR PR`

## Code style

- No comments unless WHY is non-obvious.
- No TODO/FIXME without a `#NNN` ticket reference.
- Short focused functions; no premature abstractions.
- Test behavior, not implementation details.
- Russian for user-facing UI strings; English for code, identifiers, comments.

## Custom agents available

This repo defines a 9-agent Copilot system in `.github/agents/`. Only `orchestrator` is user-invocable; others are subagents:

- `orchestrator` — autonomous pipeline runner (briefing → analysis → architect → developer → tester → audit-manager).
- `backend-architect`, `frontend-architect` — design plans for ≥2-module changes.
- `semantic-analyzer` — read-only deep code analysis.
- `senior-developer` — implements approved plans.
- `senior-designer` — UX/CSS tokens.
- `tester` — Jest + tsc + deployment to `OBStests` vault.
- `audit-manager` — pre-PR invariant and security audit.
- `context-manager` — maintains session state and CONTEXT.md.

Invoke pipeline with `/run-pipeline` or by saying "start work" / "take the next ticket".

## Additional configuration files

- `.github/instructions/` — file-scoped instructions auto-loaded by `applyTo` glob.
- `.github/prompts/` — slash-command shortcuts (`/run-pipeline`, `/pre-pr-audit`).
- `.github/hooks/invariants.json` — deterministic gates blocking `@ts-ignore` and direct main commits.
- `.vscode/mcp.json` — MCP server registrations (github, fetch, obsidian, memory, filesystem). Requires env vars `GITHUB_PERSONAL_ACCESS_TOKEN` and `OBSIDIAN_API_KEY`.
