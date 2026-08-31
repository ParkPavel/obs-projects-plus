# Current project context

> **Updated:** 2026-08-31 (pre-release audit follow-ups #176, #177, #174 closed, merged and pushed;
> session reports: `SESSION_REPORT_2026-08-27.md`, `SESSION_REPORT_2026-08-28.md`)
> **Historical log:** `archive/CONTEXT_2026-06-26.md`
> **Active product contract:** `PRODUCT_RESET_2026-07-18.md`

## Current directive

Build a local Markdown-first system rather than a Notion clone. New product work follows the
Relation-first vertical slice in `BACKLOG.md` and must map to a scene in the Product Reset.
The old W2–W5 sequence is historical; it does not select the next product ticket.

## Working tree and release state

- **The push gate was removed on 2026-08-30 at the user's decision.** `check-push-branch.ps1` is
  deregistered from `.claude/settings.json` and no longer fires, so pushing `main` is an ordinary
  agent operation now. `check-commit-branch` (invariant 12 — no direct commits to `main`),
  `check-destructive-git` and `check-ts-ignore` all stay. The disabled script is still on disk;
  re-registering it restores the old gate.

- **Pre-release audit follow-ups closed 2026-08-31 — #176, #177, #174** (`PRE_RELEASE_AUDIT_2026-08-31.md`
  §5 items 4 and 6). #176: invariant 7 is HISTORICAL — `src/archive` was deleted in #119 and is not
  coming back; R0.4 now declares its regime and fails if an archive root reappears, instead of
  passing by matching nothing. #177: `check-commit-branch` judges the branch the command would
  land on rather than a substring and a stale HEAD snapshot; two bypasses it had (stepping onto
  `main` mid-command, and `git -C . commit`) are closed, and R0.9 pins the behaviour. #174: the
  remaining four engine modules are documented. **Still open from that audit: #171** (bundles in
  the tree — user assigned it to a Codex audit) and the §2.2/§2.4 documentation drift, which no
  ticket covers yet.
- **Two facts that follow-up work uncovered and did NOT fix.** `lib/engine/contracts.ts` describes
  a "Unified DataEngine" that was never built — outside the file only `RecordId` and `ProjectId`
  are imported anywhere. And `TransformStep` is the name of TWO exported types (the dead IR in
  `contracts.ts`, keyed on `kind`; the live stored one in `dashboard-engine/transformTypes.ts`,
  keyed on `type`). Both are now documented in the files; neither is resolved.
- **`main` carries everything below and is pushed.** `64863ed` (M-FILTER-CONSOLIDATION + the
  linked-source stack) is its ancestor, the meta-audit stack and the #164 work sit on top, and
  `origin/main` matches. Both `feat/116` and the relation-first work `feat/112` are IN `main`;
  every "pending merge" statement in older documents is historical (#146).
- **Never run on any of it:** Gate 3 (`/codex:review --base main`) and the visual smoke of the
  A→C→B inversion in the OBStests vault. Merged is not the same as accepted, and pushed is not
  the same as reviewed.
- **The meta-audit stack** was built on `feat/meta-audit-141-164` (branched from `64863ed`,
  2026-08-30, five commits `3423aad → 02d7427`) and is now merged into `main`. It touches
  **82 paths**
  against `64863ed` — 43 modified, 32 added, 7 deleted; 47 under `src/`, 32 under `docs/`.
  The "64 changed paths" of the 2026-08-28 report counted `codex-reports/` as one entry and
  predates the last two days of the stack; 82 is the measured number. It closes the whole
  Codex meta-audit queue: #141 rollup resolution, #142 gallery read-only, #143 derived inverse
  (decision, user-approved), #144 write outcomes, #145 migration restore point, #146 documentation
  sync, #149 relation label, #150 wizard, #151 (partial), #152 sort ADR, #153 stats canonical key,
  #154 ticket template, #155 suggestion honesty, #156 first-run honesty, #157 deviations register,
  #160 sub-base removal, #161 caller outcomes, #162 stale enrichment on target change,
  #163 batch write compensation.
  **#164 is NOT in the stack** — see the correction below.
  The split is by ticket group: write boundary → relation surface → migration/demo/sub-base →
  interface honesty → documents and audit trail.
- **Every commit in the stack was verified individually**, not only the tip: `tsc -noEmit` 0 errors
  and the full Jest run green at each of `3423aad`, `e78c88e`, `0d24c03`, `2597c9f`, `02d7427`
  (176/2482 → 177/2493 → 174/2450 → 174/2451 → 174/2451; the count falls at the third because
  #160 deletes the sub-base suites). `lint` and `svelte-check` ran on the tip only.
  **This cost a rewrite of the branch.** The first split put `DatabaseCallBlock.svelte` in the
  relation commit and `GalleryView.svelte` + `linkedSourceWrites.test.ts` in the honesty commit;
  the #142 guard test reads BOTH sources in one assertion, so two intermediate commits were red
  while the tip was green. The branch was unpushed, so it was rebuilt with #142 travelling whole.
  The pre-rewrite backup branch was deleted after the push. **The lesson is the general one:** a green tip says nothing
  about the commits under it, and a test that reads two sources pins them to one commit.
  **#148 is closed by documentation, not code** — the boundary is stated in `FILTER_MODEL.md`
  (§"Analytical joins are not relations"), which rides in the documents commit; no source file
  carries a `#148` marker, and that is expected.
  **Merged and pushed 2026-08-30** — `main` is at `1cbcf89` and `origin/main` matches it; the
  stack, the merge `3f9251b`, the upstream `Bump beta version`, and the #164 correction went up in
  one push of 12 commits. `/codex:review --base main` has still NOT run on any of it.
  The branch and the pre-rewrite backup were deleted after the push; their content is in `main`.
- **CORRECTION 2026-08-30 — #164 was claimed as done and is not.** Commit `0d24c03` names #164 in
  its subject and states that the demo generator "now emits the current shape, so a first run is
  not a migration"; the merge commit `3f9251b` repeats it. Both are false. The stack's only change
  to `demoProject.ts` is #156 (failed note writes are reported instead of swallowed) — check with
  `git diff 64863ed..HEAD -- src/ui/app/onboarding/demoProject.ts`.
  `demoProject.ts` still emits a leading `type: "filter"` step in `widget.transform` at the chart
  and at every database-call (`typeFilter`), which is exactly the shape `countLeadingMigratableFilters`
  hoists into `config.subFilter`. Confirmed live on 2026-08-30: in the OBStests vault every demo
  widget now carries a `subFilter` and no `transform`, i.e. the product migrated the demo's own
  config, and `BACKLOG.md` has always had #164 at `Status: 📋 BACKLOG`.
  **How the error was made:** the "Both verified fixed in the running app" sentence in this file was
  taken at face value and copied into a commit message without checking either the ticket status or
  the diff. The commits are already merged into `main` and are not being rewritten — the record is
  corrected here and in the ticket instead, which is why this bullet exists.
  **#164 was then fixed and verified live on 2026-08-30** (commit `57e2618`): the generator emits
  `config.subFilter` and no `transform` at all, `configProvenance.test.ts` gained four tests
  (including the `migrateDashboardTransforms` no-op it never had), and a demo regenerated in the
  OBStests vault opened without producing a migration or a restore-point file. The ticket is closed
  on a live run, not on a green suite.
- **A shipped regression, found by review on 2026-08-30 and fixed the same day.** Root
  `styles.css` — the only stylesheet Obsidian loads — was down to 7,645 bytes from 34,964: the
  hand-written half (685 lines of layout) was gone and only the generated token block remained.
  Mechanism: the file went missing from the working tree on 2026-08-28, in the same event that
  removed `manifest.json`; `mergeCSS()` reads a missing file as `""`, so the next production build
  recreated it as `"

" + marker + tokens` and reported success. It was committed in `2597c9f`
  (staged without reading the diff, and the commit message described it as *carrying* styles),
  merged, and pushed — `ci.yml` uploads `styles.css` with every push-to-main prerelease, so it
  shipped. Cost on screen: `Grid.svelte` has no `<style>` block at all, `BoardColumn.svelte` styles
  only its `-footer` variants, `PopoverList.svelte` only `:hover` — those render unstyled.
  **Why no gate saw it:** all four gates and every ratchet look at `src/`; nothing looks at the
  repo root, and the loss is invisible in a build log. Fixed by restoring the hand-written half
  byte-for-byte from `64863ed`, adding **R0.8** (`src/__tests__/R0_8_stylesheetIntegrity.test.ts` —
  verified to fail on the shipped-broken file), making `mergeCSS` refuse to write a tokens-only
  stylesheet instead of doing it silently, and giving the production build's `catch` a message —
  it was `catch(() => process.exit(1))`, so a failing build printed nothing at all.
- **Pre-release audit, 2026-08-31** (`PRE_RELEASE_AUDIT_2026-08-31.md`), ordered before declaring
  the version a pre-alpha. Verdict: the code is fine — four gates green, invariants hold, the live
  API run passes — and the documentation is not. **Three release blockers:** CHANGELOG stops at
  `[3.4.1] - 2026-04-21` while the version is `3.5.1-alpha` (#172); README and RELEASES advertise
  «Матрёшка (sub-bases)» and mark `M-SUBBASES ✅ Готово` for a model deleted in #160 (#173); and one
  build carries three different version numbers — tag `0.0.0-58`, artifact manifest `3.5.1-beta.58`,
  repository `3.5.1-alpha`, with `3.5.0` missing from `versions.json` entirely (#175).
  On the question actually asked — are the descriptions sufficient for a maintainer — the measured
  answer is no: 53% of the 263 non-test `.ts` modules carry no header comment and 628 of 1037
  exports (61%) are undocumented, and the worst-documented files are exactly the ones `CLAUDE.md`
  lists as "Key files" (#174). Filed #171–#177; `main.js`/`releases/` (15 MB of built bundles in
  the tree, against the repo's own `.gitignore` policy) goes to a Codex audit by the user's
  decision, not to a direct fix.
- **The pre-release audit queue is closed (2026-08-31).** #172, #173, #174, #175, #176, #177 done;
  the version shipped as `3.6.0-alpha` with the tag pushed, and `release.yml` now marks any
  prerelease tag as one — without that fix an alpha would have become GitHub's "Latest release".
  #171 (`main.js` / `releases/`) is held for a Codex audit by the user's decision.
  Audit §2.2 and §2.4 are fixed and were not covered by any ticket: the `CLAUDE.md` token list
  named `styles.css` (a build output, not a source) and missed the live TypeScript source
  `designTokens.ts` — there are **four** token sources, not two, and that reopened #165's scope
  from S to M with `analysis_required: true`. `BACKLOG.md`'s header now states the rule instead of
  warning about the drift, and `M-SUBBASES` is marked withdrawn rather than complete.
  Filed from the orchestrator's findings: #178 (`contracts.ts` calls itself normative and has no
  consumers beyond two id types), #179 (`TransformStep` is the name of two exported types, keyed on
  `type` and on `kind` — the same trap §4a of the manual pipeline warns about twice), #180 (a third
  aggregation vocabulary: `computeAggFn` reimplements SUM/AVG instead of calling the kernel).
  **The matryoshka picture is more precise than either document said:** `@container` queries ARE
  live in 6 components and `container-type` in 2, so the container already decides breakpoints;
  what is missing is container-relative length units, of which there are zero. Half implemented,
  not absent.
  **Two corrections to the audit itself:** its 61% undocumented-exports figure was inflated by a
  defect in the measuring script (verified: 47%), and "zero container units" is literally true but
  misleading if read as "no container queries".
  **Local-only, not in the repository:** the `#177` hook fix and these `CLAUDE.md` edits — `.claude/`
  and `CLAUDE.md` are gitignored. R0.9 ships and `describe.skip`s where the hook is absent.
- **Cross-model review ran twice.** On the #141–#145 stack (`codex-reports/CX-REVIEW-stack-141-145.md`,
  six of eight claims false — fixes are in this tree) and on the #159 brief
  (`codex-reports/CX-GATE0-159.md`, Gate 0 not passed — brief rewritten as revision 2).
- **Canonical baseline — `main`: 176 suites / 2473 tests PASS, tsc 0, svelte-check 0/0,
  lint 0 errors (122 pre-existing tsdoc warnings).** The stack took it from 173/2464 at `64863ed`
  to 174/2451 (+36 regression tests, −49 with the sub-base model #160 deleted); #164 added four
  provenance tests, and R0.8 (stylesheet integrity) added a suite of five. On 2026-08-31 #176
  re-armed R0.4 (+5 cases in the existing suite) and #177 added R0.9, the commit-hook ratchet
  (+1 suite, +8). Do not roll back.
- **`manifest.json` must exist in the repo root.** It went missing in the working tree on 2026-08-28
  and `eslint` failed before analysing a single file — the config reads the manifest. Restored;
  the build does not remove it. If lint dies with `ENOENT … manifest.json`, this is why.
- **Full cross-model re-verification ran 2026-08-28** (`codex-reports/CV-1…CV-3`): 18 ticket claims
  checked against the code, project invariants, and the eight Vision scenes re-scored against the
  first audit. It produced #162 and #163 and corrected seven ticket statements. Scene 2 moved
  PARTIAL → MET; nothing else changed status, and interface honesty was deliberately not counted
  as progress.
- **Manual API run against the OBStests vault, 2026-08-28.** The plugin was built from this tree,
  deployed, and driven through the Obsidian Local REST API: 10 commands registered (11 minus the
  `add-sub-base` removed in #160), demo smoke A1–A7, write/read/delete roundtrip, and the new
  migration + restore-point checks M1–M5. It found two defects — the "one backup per view" rule in
  #145 lost the pre-state of a second migration event, and the demo generator ships legacy
  pipelines that migrate on first open (#164). #145 was fixed and re-verified live; **#164 was
  not** — the "both verified fixed" wording here was wrong and is corrected below.
  What REST cannot see is listed in `UNTESTABLE_FEATURES_2026-08-28.md`.
- **Notion reference analysis, 2026-08-29** (`REFERENCE_NOTION_UI_2026.md` + cold adaptivity audit
  `codex-reports/CX-MATRYOSHKA-audit.md`). Two findings drive the new milestone: the matryoshka
  principle is measurably absent (3378 `rem` vs 31 `em`, **zero** container units, 5 executable
  `container-type`, one of them queried by nobody), and the file that declares it —
  `lib/tokens/design-tokens.css` — is dead code that is never imported. Reference conclusion that
  touches an open decision: in Notion a **view is never a source**; the source is always a data
  source, and a container level (`database`) holds several of them. We have no container level, and
  its absence is what pushes us toward a fourth entity in #159 → recorded as #170.
- **Open, and each says why in its ticket:** #151 (per-link unmatched marker needs the target frame
  inside the cell), #158 (partially closed — API-observable part passed 2026-08-28, visual part
  outstanding), #159 (brief revision 2 rejected at Gate 0; revision 3 owes an answer to #170),
  #164 (demo ships legacy pipelines), #140 (uk/zh-CN translations — needs a translator, deliberately
  not machine-translated).

## Next product milestone

**Two milestones are open, and they do not compete:**

- **`M-MATRYOSHKA`** (#165–#170) — adaptivity, attention and focus, from the Notion reference.
  Order: #165 (put the principle back into the build) → #166 (kinship: container decides size) →
  #167 (invariant: no `rem` inside a container); in parallel #168 (peek instead of leaving) →
  #169 (focus priority). #170 re-opens the scene-5 decision with the reference on the table.
  **#165 goes first on purpose:** until the token file is in the build, work "by the principle"
  edits a document rather than a pixel.
- **`M-SAVED-SELECTION`** — #160 done, #159 brief rejected twice at Gate 0. Revision 3 must compare
  three options (Notion's compromise / selection as an entity / project as a container of sources)
  and say why the chosen one is chosen. No implementation tickets until it passes.

`M-RELATION-FIRST` shipped its code and is IN `main` (`64863ed`); the "pending merge" notes below
are historical. What is NOT closed is its user acceptance — #158, deferred until the visual-test
tickets exist, with the code-derived render (`codex-reports/CX-R1…R4.md`) standing in until then.
The next executable queue is #141-#158 in `BACKLOG.md`.

1. **#110 P0 — ✅ DONE.** Approved design brief `RELATION_FIRST_DESIGN_BRIEF_110.md`.
2. **#111 P0 — ✅ DONE (merged in `64863ed`).** `relationContract.ts`: WikiLink resolution
   (resolved/unmatched/ambiguous), inverse, legacy `linkedSelection` validation + migration.
3. **#112 P0 — ✅ DONE (2026-08-22, merged).** Full wizard + all 4 entry points + i18n
   + displayField picker + controller unit tests. 165 suites / 2305 PASS. Audit: READY FOR PR.
4. **#113 P0 — ✅ DONE (2026-08-22, merged).** Related records surface + count badge +
   setupRelation event chain + dashboardSuggest relation-block + initialConfig factory. 166/2312 PASS.
5. **#114 P1 — ✅ DONE (2026-08-22, merged).** validateLegacyLinkedSelection wired; composeEffectiveFilter unified; relation-only picker; 3-state filter label; SelectionBadge extended. 166/2319 PASS.
6. **#115 P0 — ⚠ code merged, acceptance NOT done (#158).** R1 integration tests (10 cases) + MANUAL_TESTING_PIPELINE.md section 8. 167/2329 PASS. Manual screenshots + keyboard path = user gate.

## Active sources of truth

| Question | Source |
|---|---|
| Product intent and delivery order | `PRODUCT_RESET_2026-07-18.md` |
| Knowingly unmet Vision promises | `VISION_DEVIATIONS.md` |
| Original user experience | `DASHBOARD_V2_VISION.md` |
| Current executable ticket queue | `BACKLOG.md` |
| Technical architecture and invariants | `DASHBOARD_V2_SPEC.md`, `ARCHITECTURE_V5.md` |
| UI grammar reference | `specs/NOTION_GRADE_PIPELINE.md`, `UI_DESIGN_ARCHITECTURE.md` |
| Reference app analysis (Notion, Aug 2026) | `REFERENCE_NOTION_UI_2026.md` |
| What manual/API testing proved and did not | `MANUAL_TESTING_PIPELINE.md`, `UNTESTABLE_FEATURES_2026-08-28.md` |
| Current manual validation | `DASHBOARD_GUIDE_AND_TESTING.md`, `TEST_REPORT_2026-06-26.md` |

## Documentation rules

- Use the archive for evidence only; do not select work from archived roadmaps.
- Four technical gates are necessary but do not prove user-flow readiness.
- A Relation feature is incomplete without creation, editing, inverse relation, related records,
  rollup, unmatched state, keyboard path and reactive Markdown update coverage.
- Do not begin implementation for #110 or its dependents before the required analysis gate is
  explicitly closed.
- "Merged" is not "accepted". #115 and the filter stack are in `main` with their user acceptance
  still open (#158); do not cite the merge as evidence of a user-flow result.
