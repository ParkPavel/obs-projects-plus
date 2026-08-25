---
description: "Run a pre-PR audit on the current branch: verify invariants (no @ts-ignore, PX-budget ratchet, single filter engine, no new Menu, no hardcoded hex), check security patterns (ReDoS, JSON.parse safety), produce a structured audit report with verdict."
---

Audit the changes on the current feature branch before opening a PR.

Spawn the `audit-manager` agent with these steps:

1. Determine current branch and changed files.
2. Run the mandatory invariant checks:
   - `@ts-ignore` grep across `src/`
   - PX-budget count against the `PX_BUDGET` constant in `src/__tests__/R0_3_pxBudget.test.ts`
     (read the constant; a budget is never raised to make a change fit)
   - `new Menu(` occurrences outside `src/lib/contextMenu.ts`
   - Parallel filter engine implementations
   - Hardcoded hex colors in changed files
3. Run security checks (`new RegExp(userInput)`, `JSON.parse` without try/catch).
4. Cross-reference changes with documentation in `docs/` — flag user-facing behavior changes.
5. Check that the ticket's `BACKLOG.md` status and the `CONTEXT.md` baseline were updated in the
   same commit series as the change.
6. Note whether the Codex cross-model review has been run for this branch
   (`/codex:review --base main` — user-run; the audit does not replace it).
7. Produce report in the standard format with verdict: **READY FOR PR**, **NEEDS FIXES**, or **BLOCKED**.

Do not modify any files. Do not write fix code — describe problems for `senior-developer` to fix.
