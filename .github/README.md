# obs-projects-plus — agent customization

This folder contains the GitHub Copilot (and open-standard) agent configuration for the repository. All files here are read by VS Code Copilot, Copilot CLI, and other tools that follow the `.github/` customization convention.

## Layout

```
.github/
├── agents/                          ← Custom agents (.agent.md)
│   ├── orchestrator.agent.md        ← user-invocable pipeline runner
│   ├── backend-architect.agent.md   ← subagent: ≥2-module architecture plans
│   ├── frontend-architect.agent.md  ← subagent: Svelte/widget design plans
│   ├── semantic-analyzer.agent.md   ← subagent: read-only deep analysis
│   ├── senior-developer.agent.md    ← subagent: implements approved plans
│   ├── senior-designer.agent.md     ← subagent: CSS tokens / UX specs
│   ├── tester.agent.md              ← subagent: Jest, tsc, deployment
│   ├── audit-manager.agent.md       ← subagent: pre-PR invariant audit
│   └── context-manager.agent.md     ← subagent: CONTEXT.md maintenance
├── instructions/                    ← Auto-attached per applyTo glob
│   ├── src.instructions.md          ← applyTo: src/**/*.{ts,svelte}
│   └── tests.instructions.md        ← applyTo: src/**/*.{test,spec}.ts
├── prompts/                         ← Slash-command shortcuts
│   ├── run-pipeline.prompt.md       ← /run-pipeline
│   ├── pre-pr-audit.prompt.md       ← /pre-pr-audit
│   ├── spec-new-feature.prompt.md   ← /spec-new-feature (SDD-lite for new epics)
│   └── backlog-to-issues.prompt.md  ← /backlog-to-issues (BACKLOG.md → GH Issues)
├── hooks/
│   └── invariants.json              ← Deterministic blocks: @ts-ignore, main commits, destructive git
├── workflows/                       ← GitHub Actions CI (not agent config)
├── ISSUE_TEMPLATE/
└── release.yml
```

Project-wide context lives in `../AGENTS.md` (open-standard, kept short, links to `docs/internal/`).

## Agent picker

Only `orchestrator` is user-invocable. The other 8 are subagents — invoked by `orchestrator` (or each other) via the `agent` tool, never selected manually from the picker. This keeps the picker clean and prevents accidental misuse of specialized roles.

## How invocation works

- **User says** "start work" / "take the next ticket" / runs `/run-pipeline` → Copilot delegates to `orchestrator`.
- **Orchestrator** chains subagents according to the pipeline defined in `orchestrator.agent.md`.
- **Subagents** never call each other in arbitrary order — they hand off only via the protocols declared in each agent's "Handoff protocols" section.
- **User gates**: only `git merge feat/<name>` to `main` and `git push origin main` are user-only. Everything else is autonomous.

## MCP servers

Registered in `../.vscode/mcp.json`: github, obsidian, memory, filesystem, fetch.

Required environment variables (set in Windows User Environment Variables):
- `GITHUB_PERSONAL_ACCESS_TOKEN` — fine-grained PAT, minimal scope.
- `OBSIDIAN_API_KEY` — from Obsidian Local REST API plugin settings.

Never hardcode secrets in `mcp.json`. The schema uses `${env:VAR}` interpolation.

## Hooks

`hooks/invariants.json` enforces deterministic policy at lifecycle events:

| Event | Matcher | Action |
|---|---|---|
| PreToolUse | `execute` with `git commit` on main/master | **Block** — must use feature branch |
| PreToolUse | `execute` with `git push` to main/master | **Block** — push reserved for user |
| PreToolUse | `execute` with destructive git (`reset --hard`, `--force`, `clean -fd`) | **Block** — user-only |
| PostToolUse | `execute` with `npm test` | Remind: 139 suites / 2099 tests baseline |
| PostToolUse | `edit` adding `@ts-ignore` in `src/` | **Block + revert** — invariant violated |

Hooks are scripts — they execute deterministically before/after tool use and cannot be argued with by the agent.

## Updating agents

When changing an agent file:
1. Validate YAML frontmatter (`description` required, `tools` minimal, `user-invocable: false` for subagents except orchestrator).
2. Verify file suffix is exactly `.agent.md` (Copilot requirement).
3. After committing, reload VS Code window (`Developer: Reload Window`) for changes to apply.

## Setup checklist for a new dev machine

1. Clone the repo.
2. Run `npm install`.
3. Set Windows env vars `GITHUB_PERSONAL_ACCESS_TOKEN` and `OBSIDIAN_API_KEY`.
4. Open VS Code on the workspace folder (`OBSv1.0\` recommended for multi-project).
5. Reload Window (`Ctrl+Shift+P` → `Developer: Reload Window`).
6. Verify agents are loaded: open chat → agent picker should show only `orchestrator` from this repo.
7. Test invocation: type `/run-pipeline` — should resolve to the orchestrator agent.
