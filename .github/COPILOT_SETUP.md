# obs-projects-plus вЂ” agent customization

This folder contains the GitHub Copilot (and open-standard) agent configuration for the repository. All files here are read by VS Code Copilot, Copilot CLI, and other tools that follow the `.github/` customization convention.

## Layout

```
.github/
в”њв”Ђв”Ђ agents/                          в†ђ Custom agents (.agent.md)
в”‚   в”њв”Ђв”Ђ orchestrator.agent.md        в†ђ user-invocable pipeline runner
в”‚   в”њв”Ђв”Ђ backend-architect.agent.md   в†ђ subagent: в‰Ґ2-module architecture plans
в”‚   в”њв”Ђв”Ђ frontend-architect.agent.md  в†ђ subagent: Svelte/widget design plans
в”‚   в”њв”Ђв”Ђ semantic-analyzer.agent.md   в†ђ subagent: read-only deep analysis
в”‚   в”њв”Ђв”Ђ senior-developer.agent.md    в†ђ subagent: implements approved plans
в”‚   в”њв”Ђв”Ђ senior-designer.agent.md     в†ђ subagent: CSS tokens / UX specs
в”‚   в”њв”Ђв”Ђ tester.agent.md              в†ђ subagent: Jest, tsc, deployment
в”‚   в”њв”Ђв”Ђ audit-manager.agent.md       в†ђ subagent: pre-PR invariant audit
в”‚   в””в”Ђв”Ђ context-manager.agent.md     в†ђ subagent: CONTEXT.md maintenance
в”њв”Ђв”Ђ instructions/                    в†ђ Auto-attached per applyTo glob
в”‚   в”њв”Ђв”Ђ src.instructions.md          в†ђ applyTo: src/**/*.{ts,svelte}
в”‚   в””в”Ђв”Ђ tests.instructions.md        в†ђ applyTo: src/**/*.{test,spec}.ts
в”њв”Ђв”Ђ prompts/                         в†ђ Slash-command shortcuts
в”‚   в”њв”Ђв”Ђ run-pipeline.prompt.md       в†ђ /run-pipeline
в”‚   в”њв”Ђв”Ђ pre-pr-audit.prompt.md       в†ђ /pre-pr-audit
в”‚   в”њв”Ђв”Ђ spec-new-feature.prompt.md   в†ђ /spec-new-feature (SDD-lite for new epics)
в”‚   в””в”Ђв”Ђ backlog-to-issues.prompt.md  в†ђ /backlog-to-issues (BACKLOG.md в†’ GH Issues)
в”њв”Ђв”Ђ hooks/
в”‚   в””в”Ђв”Ђ invariants.json              в†ђ Deterministic blocks: @ts-ignore, main commits, destructive git
в”њв”Ђв”Ђ workflows/                       в†ђ GitHub Actions CI (not agent config)
в”њв”Ђв”Ђ ISSUE_TEMPLATE/
в””в”Ђв”Ђ release.yml
```

Project-wide context lives in `../AGENTS.md` (open-standard, kept short, links to `docs/internal/`).

## Agent picker

Only `orchestrator` is user-invocable. The other 8 are subagents вЂ” invoked by `orchestrator` (or each other) via the `agent` tool, never selected manually from the picker. This keeps the picker clean and prevents accidental misuse of specialized roles.

## How invocation works

- **User says** "start work" / "take the next ticket" / runs `/run-pipeline` в†’ Copilot delegates to `orchestrator`.
- **Orchestrator** chains subagents according to the pipeline defined in `orchestrator.agent.md`.
- **Subagents** never call each other in arbitrary order вЂ” they hand off only via the protocols declared in each agent's "Handoff protocols" section.
- **User gates**: only `git merge feat/<name>` to `main` and `git push origin main` are user-only. Everything else is autonomous.

## MCP servers

Registered in `../.vscode/mcp.json`: github, obsidian, memory, filesystem, fetch.

Required environment variables (set in Windows User Environment Variables):
- `GITHUB_PERSONAL_ACCESS_TOKEN` вЂ” fine-grained PAT, minimal scope.
- `OBSIDIAN_API_KEY` вЂ” from Obsidian Local REST API plugin settings.

Never hardcode secrets in `mcp.json`. The schema uses `${env:VAR}` interpolation.

## Hooks

`hooks/invariants.json` enforces deterministic policy at lifecycle events:

| Event | Matcher | Action |
|---|---|---|
| PreToolUse | `execute` with `git commit` on main/master | **Block** вЂ” must use feature branch |
| PreToolUse | `execute` with `git push` to main/master | **Block** вЂ” push reserved for user |
| PreToolUse | `execute` with destructive git (`reset --hard`, `--force`, `clean -fd`) | **Block** вЂ” user-only |
| PostToolUse | `execute` with `npm test` | Remind: 134 suites / 2020 tests baseline |
| PostToolUse | `edit` adding `@ts-ignore` in `src/` | **Block + revert** вЂ” invariant violated |

Hooks are scripts вЂ” they execute deterministically before/after tool use and cannot be argued with by the agent.

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
5. Reload Window (`Ctrl+Shift+P` в†’ `Developer: Reload Window`).
6. Verify agents are loaded: open chat в†’ agent picker should show only `orchestrator` from this repo.
7. Test invocation: type `/run-pipeline` вЂ” should resolve to the orchestrator agent.
