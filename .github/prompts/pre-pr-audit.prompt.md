---
description: "Run a pre-PR audit on the current branch: verify invariants (no @ts-ignore, PX-budget ≤ 186, single filter engine, no new Menu, no hardcoded hex), check security patterns (ReDoS, JSON.parse safety), produce a structured audit report with verdict."
agent: "audit-manager"
---

Audit the changes on the current feature branch before opening a PR.

Steps:
1. Determine current branch and changed files.
2. Run the mandatory invariant checks:
   - `@ts-ignore` grep across `src/`
   - PX-budget count (must be ≤ 186)
   - `new Menu(` occurrences outside `src/lib/contextMenu.ts`
   - Parallel filter engine implementations
   - Hardcoded hex colors in changed files
3. Run security checks (`new RegExp(userInput)`, `JSON.parse` without try/catch).
4. Cross-reference changes with documentation in `docs/` — flag user-facing behavior changes.
5. Produce report in the standard format with verdict: **READY FOR PR**, **NEEDS FIXES**, or **BLOCKED**.

Do not modify any files. Do not write fix code — describe problems for `senior-developer` to fix.
