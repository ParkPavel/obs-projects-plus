---
description: "Use when the user wants to convert open tickets from BACKLOG.md (or a spec's task list) into GitHub Issues in the ParkPavel/obs-projects-plus repo. Reads ticket IDs, deduplicates against existing issues, creates issues with labels and milestone."
---

Convert internal tickets into GitHub Issues.

## Inputs

Ask the user (via ask_user) if not provided:

1. **Source** — `BACKLOG.md` (default) OR path to a spec's task list (e.g. `docs/internal/specs/<feature>/PLAN.md`)
2. **Filter** — which tickets to convert (e.g. "all open", "only #123-#150", "only tickets tagged P0")
3. **Milestone** — GitHub milestone name to assign (optional, leave blank to skip)
4. **Dry run** — preview without creating? (default: yes — show plan first)

## Steps

### 1. Read source

- If `BACKLOG.md`: parse for `#NNN` ticket headers, status `open` / not `done`.
- If spec PLAN.md: extract task list (numbered steps or bullets with acceptance criteria).

### 2. Deduplicate

Use `github-search_issues` with `repo:ParkPavel/obs-projects-plus` and the ticket title or `#NNN` reference in the body. Skip tickets whose GitHub issue already exists. Report skipped count.

### 3. Build issue payloads

For each remaining ticket, build:

```
title: "#NNN — <ticket title>"
body: |
  <original ticket body or task description>

  ---
  Source: BACKLOG.md (or PLAN.md path)
  Affected layer: <Shell|UI|Engine|Data> (if discoverable)

  ## Acceptance criteria
  <bullet list>

  ## Invariants to preserve
  - Test baseline: 139 suites / 2099 tests
  - tsc: 0 errors
  - PX-budget ≤ 186
  - <any feature-specific from CONSTRAINTS.md if linked>
labels: ["from-backlog", "<P0|P1|P2 if known>", "<area:dashboard|engine|formula|... if known>"]
milestone: <user-provided or none>
```

### 4. Show dry-run preview

Output a markdown table: `# | Title | Labels | Milestone | Action (create/skip)`. Stop and ask user for go-ahead.

### 5. Create issues

If approved, call `github-issue_write` (method: create) one at a time. After each, show `✓ #N created → <url>`. On error, report and continue (don't halt the batch).

### 6. Update source

After successful batch, update `BACKLOG.md`:
- Append `[GH #N]` reference next to each migrated ticket
- Do NOT mark them done — they're still open work, just tracked in GH now

## Constraints

- Do NOT create issues for tickets marked `done` or `wontfix`
- Do NOT create duplicates (rely on step 2 dedup)
- Do NOT assign anyone (user does this manually)
- Do NOT push BACKLOG.md changes — let the user commit
- Respect GitHub rate limits: pause 1s between creations if batch >20

## Halt Conditions

- `GITHUB_PERSONAL_ACCESS_TOKEN` env var missing → instruct user to set it
- Dedup search returns ambiguous matches → ask user per-ticket
- Source file not found or no tickets matched filter
