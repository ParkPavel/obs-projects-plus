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
npm run build         # tsc -noEmit -skipLibCheck + esbuild bundle (production)
npm test              # full jest suite (139 suites / 2099 tests)
npm run lint          # ESLint over ./src
npm run svelte-check  # Svelte template + type check
npm run test:watch    # jest watch mode
npx tsc --noEmit -skipLibCheck   # type check only (matches build flags)
```

Test baseline: **139 suites / 2099 tests PASS**, tsc 0 errors. (Updated 2026-06-05.) Any deviation must be acknowledged before merge.

## Verification protocol — the 4 gates (canonical)

CI (`.github/workflows/ci.yml`) gates merge into `main` on **four** checks. An agent that runs fewer than four and reports "ready" is producing a false signal — this was the root cause of past "build looked green but runtime broke" failures. The full gate is exactly:

```bash
npm run build         # 1. tsc (-skipLibCheck) + esbuild — 0 errors
npm test              # 2. jest — baseline holds (≥ 139 suites / 2099 tests)
npm run lint          # 3. ESLint — 0 errors
npm run svelte-check  # 4. svelte-check — 0 errors  ← catches template/reactive bugs tsc cannot
```

`svelte-check` and `lint` are NOT optional. `tsc` alone never validates `.svelte` templates. No "READY FOR PR" verdict is valid unless all four are green, evidenced by **pasted raw tail output**, not a paraphrase.

## Economical verification (tiered — fast loop, full gate)

Running all four gates after every micro-edit is wasteful (full suite ≈ 20s). Use tiers:

- **Tier 0 — inner loop (cheap, run often):** `npx tsc --noEmit -skipLibCheck` on the touched area + `npx jest <pattern>` for only the affected test files (or `npx jest -o` for changed-since-commit). Use while iterating.
- **Tier 1 — full gate (run once before any handoff / PR):** the complete 4-gate block above. Mandatory before `tester → audit-manager` handoff and before any "ready" claim.

Spend cycles where they catch bugs: type-check the file you changed every edit; run the whole suite only at the gate.

## MCP memory — shared code context (avoid re-analysis, avoid missed detail)

The `memory` MCP server (knowledge graph: entities, relations, observations) is the pipeline's shared brain. Use it so context survives agent handoffs and nothing gets re-derived from scratch:

- **context-manager** (session start): bootstrap/refresh a `codebase` graph — key modules, canonical files, the DataFieldType/WidgetType unions, current baseline numbers — as memory entities.
- **semantic-analyzer**: write findings (file→symbol→dependency edges, anti-pattern hits) into memory as entities/relations with `file:line` observations. Downstream agents read these instead of re-grepping — this is the main economy win.
- **architects / senior-developer**: **query memory first** for the ticket's modules before reading files; only open files memory does not already cover. Add new observations you discover.
- Memory is a cache, not truth: if an observation contradicts the live file, trust the file and correct the memory entry.

If the `memory` server is unavailable, agents fall back to direct read/search and say so — never block on it.

## Anti-hallucination rules (all agents)

1. **Read before you assert.** Never claim a file, function, type, or path exists without having opened it or matched it via search. Cite `file:line`.
2. **Run before you report.** Never state a command's result (test count, "0 errors", "passes") you did not actually execute. Paste the raw tail, not a summary you expect.
3. **Verify paths.** Before referencing a path, confirm it resolves. Registry files live under `src/ui/views/Dashboard/widgets/`, tests under `src/ui/views/Dashboard/__tests__/`.
4. **No invented numbers.** Baseline, px-budget, function counts come from running the tool, not memory.
5. **Surface uncertainty.** "I could not verify X" beats a confident wrong answer. Escalate instead of guessing.

## Creative judgment (don't be a rule-following zombie)

The gates and invariants are hard constraints. Everything else is yours to reason about:

- If the approved plan is wrong, or a simpler/cleaner solution exists, **say so and propose the alternative** before implementing — don't silently follow a flawed plan.
- Question tickets that conflict with the architecture; suggest better decompositions.
- Prefer the smallest change that fully solves the problem, but a *complete correct* solution beats a *minimal incomplete* one.
- Invariants and the 4 gates are non-negotiable; approach, structure, and design within them are open to better ideas.

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
- Registry files: `src/ui/views/Dashboard/widgets/widgetRegistry.ts` + `configPanelRegistry.ts`; their tests: `src/ui/views/Dashboard/__tests__/widgetRegistry.test.ts` + `configPanelRegistry.test.ts`.
- Adding a widget → update `widgetRegistry.test.ts` count AND `configPanelRegistry.test.ts` type list.
- Adding a `DataFieldType` value → check exhaustive switch branches.
- Adding CSS px values → run `npx jest src/__tests__/R0_3_pxBudget.test.ts` (must stay ≤ 186).

## Git workflow

- Never commit directly to `main`/`master` — feature branches only (`feat/<desc>` or `fix/<desc>`).
- Never `git push` from an agent — user controls remote.
- Never `--force` push, `git reset --hard`, or destructive rm — move to archive instead.
- Merge gate (before user-performed merge) — all 4 gates green + verdict:
  - `npm run build` → 0 errors
  - `npm test` → baseline holds
  - `npm run lint` → 0 errors
  - `npm run svelte-check` → 0 errors
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
- `context-manager` — maintains session state and `docs/internal/CONTEXT.md`.

Invoke pipeline with `/run-pipeline` or by saying "start work" / "take the next ticket".

## Project state files

- `docs/internal/CONTEXT.md` — canonical session/project state (version-controlled, team-shared). Maintained by `context-manager`. Path is relative to repo root — no machine-specific absolute paths.
- `docs/internal/BACKLOG.md` — ticket backlog (`#NNN`, P0–P3, XS–XL). Source of truth for what to work on next.

## Additional configuration files

- `.github/instructions/` — file-scoped instructions auto-loaded by `applyTo` glob.
- `.github/prompts/` — slash-command shortcuts (`/run-pipeline`, `/pre-pr-audit`, `/spec-new-feature`, `/backlog-to-issues`).
- `.github/hooks/invariants.json` — deterministic gates blocking `@ts-ignore` and direct main commits.
- `.vscode/mcp.json` — MCP server registrations (github, fetch, obsidian, memory, filesystem). Requires env vars `GITHUB_PERSONAL_ACCESS_TOKEN` and `OBSIDIAN_API_KEY`.
