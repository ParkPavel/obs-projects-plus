# CX-AUDIT-166-step1 — Codex `auditor`, 2026-09-02

Run: `node .codex/run-role.mjs --role auditor --base f425812 --ticket 166 --effort high`
Range: `f425812...7c3d985` on `feat/166-step1-container-roots` (10 files, 444/62).

## Findings

- **BLOCKER** — `DashboardCanvas.svelte:163` renders `TemplateConfirmDialog` inside the newly
  containerised `.ppp-database-root` (`:191`). Its overlay is `position: fixed; inset: 0` at
  `TemplateConfirmDialog.svelte:51`.

  Observed: `container-type: inline-size` applies layout containment; layout containment
  establishes a fixed-position containing block (CSS Containment Level 3).
  Failure scenario: on a dashboard taller than its visible scroll area, opening a template can
  centre the confirmation dialog in the full dashboard content rather than the viewport, placing
  it below the fold and moving the scrim with content. This violates Step 1's "nothing moves"
  contract. The ADR independently records this exact condition as a merge blocker.
  Falsified by: a live tall-dashboard check showing the dialog stays viewport-centred and the
  scrim covers the visible viewport while scrolling.

## Mechanical audit

No added `@ts-ignore`, `new Menu(...)`, `JSON.parse`, dynamic `RegExp`, hardcoded hex, U+FFFD, or
configuration-file change in the range. The changed canvas stays within its LOC ceiling.

## Verdict: BLOCKED

## Disposition

- The BLOCKER is **agreed and pre-existing in the record**: the same finding was made by the
  implementing pass from the ADR's own RISKS 4 grep, before the audit ran, and is written into
  `ADR_MATRYOSHKA_SIZING_2026-09-02.md` (RISKS 4) and `BACKLOG.md` #166. Two independent passes,
  one mechanism, same line. Not fixed here: the remedy is a choice (portal to `<body>` as
  `FloatingPopup` does, hoist the dialog out of `.ppp-database-root`, or replace
  `align-items: center` with a top offset), and Step 1 was scoped to report it.
  One correction to the finding's framing: the overlay's containing block was already **not** the
  viewport — `ViewContent.svelte:16` has declared `container-type` since before #166 — so the
  regression is `ViewContent`'s padding box (the visible scroll port) giving way to
  `.ppp-database-root`'s content box, not "viewport → container". The consequence the auditor
  describes is unchanged.
- **"Tests UNKNOWN" is an artefact, not a finding.** The role's read-only sandbox denies a path
  lookup outside the workspace, so Node fails before Jest starts. The gates were run in the main
  session and are quoted there: build 0, jest 182 suites / 2526 tests, lint 0 errors (112
  pre-existing tsdoc warnings), svelte-check 0/0.
