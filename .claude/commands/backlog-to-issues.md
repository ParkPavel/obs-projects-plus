---
description: "Use when the user wants to convert open tickets from BACKLOG.md (or a spec's task list) into GitHub Issues in the ParkPavel/obs-projects-plus repo. Reads ticket IDs, deduplicates against existing issues, creates issues with labels and milestone."
---

Convert internal tickets into GitHub Issues using the `gh` CLI.

## Prerequisites

`gh` CLI must be authenticated: run `gh auth status` to verify. If not logged in: `gh auth login`.

## Inputs

Ask the user if not provided:

1. **Source** — `BACKLOG.md` (default) OR path to a spec's task list (e.g. `docs/internal/specs/<feature>/PLAN.md`)
2. **Filter** — which tickets to convert (e.g. "all open", "only #123-#150", "only tickets tagged P0")
3. **Milestone** — GitHub milestone name to assign (optional)
4. **Dry run** — preview without creating? (default: yes — show plan first)

## Steps

### 1. Read source

- If `BACKLOG.md`: parse for `#NNN` ticket headers, status `open` / not `done`.
- If spec PLAN.md: extract task list.

### 2. Deduplicate

```bash
gh issue list --repo ParkPavel/obs-projects-plus --search "<ticket title or #NNN>" --json number,title
```

Skip tickets whose GitHub issue already exists. Report skipped count.

### 3. Build issue payloads

For each remaining ticket construct:

```
title: "#NNN — <ticket title>"
body:
  <original ticket body or task description>

  ---
  Source: BACKLOG.md (or PLAN.md path)
  Affected layer: <Shell|UI|Engine|Data>

  ## Acceptance criteria
  <bullet list>

  ## Invariants to preserve
  - Test baseline: 139 suites / 2099 tests
  - tsc: 0 errors
  - PX-budget ≤ 186
labels: from-backlog, <P0|P1|P2 if known>, <area if known>
milestone: <user-provided or none>
```

### 4. Show dry-run preview

Output a markdown table: `# | Title | Labels | Milestone | Action (create/skip)`. Stop and ask user for go-ahead.

### 5. Create issues

If approved, create one at a time:

```bash
gh issue create \
  --repo ParkPavel/obs-projects-plus \
  --title "#NNN — <title>" \
  --body "<body>" \
  --label "from-backlog" \
  --label "<P0|P1|P2>" \
  [--milestone "<name>"]
```

After each: show `✓ created → <url>`. On error: report and continue (don't halt the batch).
Pause 1s between creations if batch >20: `Start-Sleep -Seconds 1`.

### 6. Update source

After successful batch, update `BACKLOG.md`:
- Append `[GH #N]` reference next to each migrated ticket.
- Do NOT mark them done — still open work.
- Do NOT commit — let the user commit.

## Constraints

- Do NOT create issues for tickets marked `done` or `wontfix`.
- Do NOT create duplicates.
- Do NOT assign anyone.

## Halt Conditions

- `gh auth status` fails → instruct user to run `gh auth login`.
- Dedup search returns ambiguous matches → ask user per-ticket.
- Source file not found or no tickets matched filter.
