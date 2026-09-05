# Current project context

> **Updated:** 2026-09-02 (#165, #181 and #179 merged into `main`; #178 and #180 have architect plans
> (`PLAN_178_…`, `PLAN_180_…`) and WAIT ON USER DECISIONS recorded in `BACKLOG.md` — do not implement
> before the answers are written there. Earlier the same day: the cqi mechanism measured in headless
> Chrome, the adversarial review's two findings fixed, the ratchets survive a worktree.
> Earlier: pre-release audit follow-ups #176, #177, #174 closed, merged and pushed;
> session reports: `SESSION_REPORT_2026-08-27.md`, `SESSION_REPORT_2026-08-28.md`)
> **Historical log:** `archive/CONTEXT_2026-06-26.md`
> **Active product contract:** `PRODUCT_RESET_2026-07-18.md`

## Current directive

Build a local Markdown-first system rather than a Notion clone. New product work follows the
Relation-first vertical slice in `BACKLOG.md` and must map to a scene in the Product Reset.
The old W2–W5 sequence is historical; it does not select the next product ticket.

## Working tree and release state

- **#190 is IMPLEMENTED on `feat/190-peek-anchoring` (base `b31e4c6`), NOT merged and NOT committed
  by the implementer.** The record peek panel stops being anchored to the window:
  `.projects-container` becomes a two-row grid, a new `.ppp-app-overlay` layer shares row 2 with
  `.projects-main`, and `SlideInPanel`'s two nodes portal themselves into it
  (`src/ui/app/overlayPortal.ts`, target resolved from the node so two leaves cannot cross). No
  length expressing the header's height is written in CSS or TypeScript — the top edge is a grid
  row's, and the acceptance suite proves it by rendering twice at two header heights.
  Four gates green in the agent worktree: `tsc` 0, jest **208 suites / 3356 tests** (207/3343 plus
  A190's 13), lint 0 errors / 110 warnings, svelte-check 0/0. `RAW_Z_BUDGET` **71 → 69,
  re-measured** by the plan's procedure (set to 0, read `Received: 69`), not by subtracting the two
  raw values removed. `REM_IN_CONTAINER_BUDGET` 804 and `PX_BUDGET` 143 unmoved — no `@container`
  was written, which is the only way this ticket could have moved the first. Not run in the vault:
  the split-pane case and the Obsidian-chrome case are exactly what the probe cannot see.
  As on #166 step 2, `npm test` in a worktree needs
  `--testMatch "**/src/**/*.(test|spec).(ts|js)"`.
- **#178 is MERGED into `main` (2026-09-02, merge `448847d`).** The three type-only contract modules (`lib/engine/contracts.ts`,
  `lib/relations/contracts.ts`, `lib/colors/contracts.ts` — 515 lines, zero live consumers) are
  deleted; their text is preserved verbatim in
  `docs/internal/archive/ENGINE_CONTRACTS_V4_DESIGN.md`, and the usage map that the user made a
  precondition is at `docs/internal/codex-reports/CX-MAP-178.md`. No test file was added or
  removed, so the jest baseline holds exactly rather than moving: four gates green on the branch,
  182 suites / 2526 tests, `tsc` 0, svelte-check 0/0, lint 0 errors. The one number that DID move is
  the tsdoc warning count — 109 on the branch against the 112 recorded below, because each deleted
  file carried an `@since 4.0` tag that tsdoc does not know. The canonical figure below is the measured merge.
- **#166 Step 2 is MERGED into `main` (2026-09-02).** `feat/166-step2-chart-width` off `main`
  = `6c6a82f`: the chart's viewBox is pinned to the measured container width (`bind:contentRect`,
  not the ADR's `bind:clientWidth` — see the deviation recorded in the ADR and `BACKLOG.md`), so an
  11-unit label renders at 11 CSS px at every widget width instead of 5.5 at 240px and 22 at 960px
  (measured in `docs/internal/probes/166-chart-viewbox-scale.html`). It also fixed a latent
  `PieChart` defect the change would have exposed: `CX/CY/R` were `const`, computed once at mount.
  Four gates green in the agent worktree, jest **183/2539**; `npm test` there needs `--testMatch "**/src/**/*.(test|spec).(ts|js)"`
  because the config's absolute pattern cannot match a path through the `.claude` dot-segment.
  Reviewed by the Codex auditor and adversarial reviewer before merge — four true findings
  (stretched pie, fixed label counts in Scatter/Progress, a probe without the real root rules), all
  fixed on the branch (`ffcf991`, `CX-AUDIT-166-step2.md`, `CX-ADV-166-step2.md`). Canonical jest
  re-run in the main checkout: 183/2544. Not run in the vault — the one open acceptance item.
- **#166 Step 1 is MERGED into `main` (2026-09-02).** `feat/166-step1-container-roots` off `main`
  = `f425812`: `08ede44` (the container rungs + the `:root`/roots split of the level-2 scale),
  `dbe51c0` (R0.13 `CONTAINER_ROOTS`, +5 tests, both plants proven), `a31423f` (bundles). Four
  gates green, jest 182/2526. `docs/internal/probes/166-no-container-fallback.html` measures the
  point of the step: a consumer with no container ancestor reads 16px where the #165 probe read
  20px, and both in-container cells are unchanged. The one thing that moved —
  `TemplateConfirmDialog`'s unportaled `position: fixed` overlay, whose containing block Step 1
  would have changed to `.ppp-database-root` — was hoisted to `ViewContent` level before merge, so
  its geometry is the pre-Step-1 one (RISKS 4 of `ADR_MATRYOSHKA_SIZING_2026-09-02.md`). Steps 2 and 3 wait on the three
  user decisions at the end of that ADR.
- **#165 is MERGED into `main` (2026-09-02, merge `9377a3d`).** `feat/165-token-consolidation`, tip
  `28aa27d`: the ADR (`ADR_TOKENS_MATRYOSHKA_2026-09-01.md`), four implementation commits, and one
  ratchet-strengthening commit from the Codex audit. The four gates were green on the branch
  (180 suites / 2508 tests before #181 joined; the canonical figure below is the measured merge). The token system is one file: `designTokens.ts`, `dashboardTokens.css` and the
  dead `design-tokens.css` are gone, and the live run confirms `getDesignTokenCSS` is absent from
  the shipped bundle.
  **Why it was held, and what settled it (2026-09-02):** step 4 deliberately changes rendering (a
  chart's label size and padding now follow its widget's width), and whether the mechanism works at
  all was unmeasured — jsdom has no container queries and the browser extension never connected.
  The probe then ran in **headless Chrome** instead: `docs/internal/probes/165-cqi-in-custom-property.html`
  carries the shipped declarations and the same container/consumer structure, and computed
  font-size came out 16px in a 200px container against 18.4px in an 800px one, identical to the
  formula written inline. So `cqi` inside an inherited custom property resolves at the use site;
  `9e870e4` has no revert condition left. Obsidian here is Electron 34.3 / Chromium 132, which has
  container units, but that is a version argument — no computed style was read inside Obsidian.
  The probe also showed the failure mode fails *large*: a level-2 consumer with no query container
  above it lands on the clamp ceiling. Details and the remaining judgement about appearance in
  `UNTESTABLE_FEATURES_2026-09-01.md` §"Resolved 2026-09-02".
  **The adversarial review then returned BLOCK on two true findings** (`codex-reports/CX-ADV-165.md`):
  the SVG charts' labels are presentation attributes in viewBox units and never receive the
  wrapper's font-size — the pilot reaches `NumberChart` and the banners, so the claim was corrected
  and the labels handed to #166 — and R0.13 could not see a scale rebuilt through `setProperty`,
  now closed by rule with a planted-file proof. Both fixed on the branch before merge.
  **Two findings came out of the work rather than the ticket.** `--ppp-radius-*` was declared twice
  at values shifted one step (`:root` vs the canvas injection), so `--ppp-radius-md` meant two
  different sizes and no file appeared to conflict — held behind a scoped shim, the scale itself
  left to a follow-up. And R0.13 as first written inventoried only `.css` files, so the exact
  mechanism it exists to prevent — a scale assembled in a TypeScript string — would have passed it;
  Codex caught that, and it is now closed by rule rather than by instance.
- **#181 is fixed and MERGED (2026-09-02).** `fix/181-ratchet-worktree-exclusion`, off `main`
  at `d2d7de4`, tip `fbcd0c9`. R0.7, R0.10 and R0.11 each walked `.claude/` with a private copy of
  the same recursive traversal and no exclusions, so `isolation: worktree` — which puts a full
  repository checkout at `.claude/worktrees/<agent-id>/` — reddened all three on files belonging to
  the copy. Inside the worktree the same suites *skip*, there being no `.claude/` of their own: the
  main tree saw false failures and the agent false silence. One walk now serves all three
  (`src/__tests__/support/configScan.ts`), and its exclusion is pinned in both directions by
  `configScanBoundary.test.ts` against a temp fixture.
  **Two wrong versions preceded the right one, and the Codex audit caught both — the four gates
  were green for all three.** First, matching `worktrees` by name at any depth would have hidden an
  ordinary `.claude/agents/worktrees/` from all three ratchets at once; the scope is now the place
  the checkout actually goes, a direct child of the scanned layer, while `node_modules` and `.git`
  stay excluded at any depth because they are machinery that legitimately nests. Second, skipping
  every directory junction — meant to stop the walk following an agent's `node_modules` link — also
  blinded the ratchets to a linked config directory, which the old per-suite walks did read. Links
  are followed again, and termination comes from entering each directory once by real path.
  Both corrections are pinned by fixtures, so neither can come back quietly.
  **The deliberate merge conflict fired and was resolved** in favour of the completed-work text,
  on an integration branch; `main` moved by fast-forward.

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
- **Two facts that follow-up work uncovered — both are now resolved (#179 and #178).** The name collision is
  **resolved (#179, 2026-09-02):** the dead IR in `contracts.ts` is `TransformStepIR`, matching its
  `FilterIR` / `RollupIR` / `AggregateIR` siblings, and the live stored `TransformStep` in
  `dashboard-engine/transformTypes.ts` is untouched — it is a persistence format, so its name is not
  a local choice. `src/__tests__/R0_14_duplicateExportedTypeNames.test.ts` holds the line: zero
  duplicate exported type names across `engine/` + `dashboard-engine/`, and for the rest of
  `src/lib` it DECLARES the one collision that remains (`ValidationError`, in
  `helpers/formulaParser.ts` and `types/validation.ts`) so a third one fails the suite. That
  collision is filed as a note under #179 and was deliberately not swept into a P1/S rename.
  **The second fact is settled too (#178, 2026-09-02, implemented on a branch — see the top of this
  section).** The question #179 deliberately did not prejudge — whether `lib/engine/contracts.ts`
  should exist at all — was put to the user, who chose deletion on the condition that usage be
  checked by calls in code and not only by exports. It was: the Codex `code-mapper` map
  (`codex-reports/CX-MAP-178.md`) found no dynamic import, `require`, `jest.mock`, re-export,
  `typeof`/`keyof` or declaration-merging reference to any of the three modules, and no value
  declaration in any of them, so `tsc` passing after the deletion is the proof that nothing consumed
  them. The design itself is not lost — it moved out of `src/` into
  `archive/ENGINE_CONTRACTS_V4_DESIGN.md`, with the reasons it was never built stated next to it.
  Jest rose by one suite / five tests on the #179 branch and #178 moves it by nothing at all;
  **the canonical baseline below moves only on merge to `main`.**
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
- **Codex review is no longer a user gate (2026-09-01).** The user removed the checkpoint: a review
  is a verification step, not a decision, and it spends no Anthropic tokens. The plugin's
  `/codex:*` commands are still `disable-model-invocation: true` and stay user-only; the engine is
  invoked directly instead — `node .../codex-companion.mjs review [--base <ref>] [--scope branch]`,
  backgrounded. `CLAUDE.md` carries the recipe and the base-selection rule.
  **Pick the base or waste the run:** with no `--base` the reviewer compares the working tree, and
  on a clean tree that returns "No changes exist relative to the specified merge-base commit" —
  *nothing was compared*, not *no findings*. That burned the first run of the day.
- **First self-run review: `CX-REVIEW-3.6.0-alpha.md`, one P1, and it is FALSE.** Codex claimed the
  new R0.9 suite aborts after its first blocking case because the hook's `exit 2` kills the shared
  PowerShell runner. It does not: `&` runs a script in its own scope and returns, setting
  `$LASTEXITCODE` — only dot-sourcing would take the parent down. Disproven by a probe
  (three `exit 2` calls, runner survived and emitted JSON) and by the suite itself on Windows with
  the hook present, where five cases run after the one named. Nothing was changed. Prior stack
  review was six-of-eight false; this one is one-of-one.
- **Working-stack audit, 2026-09-01** — the paired Claude+Codex configuration, not the product.
  Prompted by the user noticing two things: no delegation was happening, and brakes had appeared
  that were never designed in. Both were real, and four defects were found underneath:
  **(1)** all nine `.codex/agents/*.toml` were cp1251 mojibake — proven at the byte level
  (`D0 B2 E2 80 B0 D2 90` = three characters where `E2 89 A5` = `>=` belonged), repaired, line
  counts and TOML structure unchanged; **(2)** the push gate the user lifted on 2026-08-30 stayed
  registered on the Codex side, so half the pair was still gated; **(3)** the #177 hook fix reached
  `.claude/hooks/` only — the Codex copy kept the old 18-line version that both blocked innocent
  commands and let "checkout main, then commit" through; **(4)** `R0_7_configDrift` named `.codex`
  in its own header and never scanned it.
  **On the brakes:** there are no Stop hooks anywhere and the review gate is off. What reads as
  friction is `PreToolUse` hooks plus the harness auto-mode classifier plus asking for approval —
  three different things, only the first of which is project configuration.
  **On delegation:** the harness instructs an agent not to spawn subagents unless asked, while
  `CLAUDE.md` routing says to delegate by ticket size. The harness wins by default, which is why
  the roster sat unused. Named here because it is a standing conflict, not a one-off.
- **R0.10 (`R0_10_workingStackIntegrity.test.ts`) closes the hole that let all of that rot.**
  Checks both layers for cp1251 damage and U+FFFD, roster parity under a declared regime, JSON
  validity, hook implementation parity, and hook registration parity. Verified to fail on each of
  the four real defects, one failing assertion apiece — restored from backup, run, restored again.
  Its first version used a regex literal containing the corrupted characters, which made the test's
  own encoding part of the assertion and produced two phantom offenders; it is code points now,
  ASCII-only in source. **A detector for encoding damage must not itself be encodable wrong.**
  `R0.7` now scans `.codex` as its header always claimed.
- **The role stack was rebuilt on 2026-09-01** — `WORKING_STACK_DESIGN_2026-09-01.md` carries the
  reasoning and the sources; the role files themselves are local (`.claude/agents/`,
  `.codex/agents/`, both gitignored).
  **Nine jobs, nine files, none mirrored.** The old roster described the same nine jobs in eighteen
  files across both layers, which is precisely how a fix landed on one side and not the other three
  separate times. Claude keeps authorship and decisions (`lead`, `architect`, `designer`,
  `implementer`, `tester`); Codex keeps execution and adversarial verification (`code-mapper`,
  `flow-auditor`, `adversarial-reviewer`, `auditor`). The split follows measured strengths — blind
  comparisons rate Claude's code cleaner, while Codex is faster, cheaper per token and better at
  autonomous review — not preference.
  **`orchestrator` and `context-manager` are gone.** The second existed to carry state between hops
  of the first. Research on 1600+ multi-agent traces names context degradation across handoffs as
  the most common root cause of failure, ahead of model error, and this project has already paid it:
  #164 was closed because the sentence "verified in the running app" survived a handoff while the
  evidence did not. A resident `lead` removes the hops rather than staffing them, and the cycle is
  now capped at three handoffs per ticket.
  Three handoff rules, one per measured failure mechanism: a packet rather than a summary; decisions
  written to a file before work moves on; a fixed output shape per role, with free prose allowed only
  under `UNKNOWN`.
  R0.10's roster check moved from `MIRRORED` to `DISJOINT` in the same change, and was verified to
  fail when a mirrored name is re-introduced.
- **Co-configuration round with Codex, 2026-09-01.** Codex reviewed the roster written *for* it and
  the automations. Confirmed: the project IS marked trusted in `~/.codex/config.toml`, so
  `.codex/hooks.json` is eligible to load — that had been recorded as unverified. Its four roles,
  sandboxes and effort levels it accepts as executable.
  **It found two real split violations I had introduced or carried:** `architect` was told to write
  its plan into a ticket while its tool allowlist has no write tool — an instruction it could not
  execute; the plan is now returned in shape and `lead` persists it. And `implementer` and `tester`
  both claimed authorship of Jest tests; the boundary is now drawn — tests that ship with a change
  belong to its author, `tester` owns execution and regression tests for reproduced defects.
  **One of its claims was false and was checked rather than applied:** it reported the `ts-ignore`
  hook as `PostToolUse` in both layers; it is `PreToolUse` in both. Also flagged and NOT acted on:
  hook registrations use relative paths, which could fail from a subdirectory — changing working
  hook registration late in a session with no way to verify the change would be the wrong trade, so
  it is recorded instead.
  `task --resume` is unsafe as the sole resume mechanism: it selects the newest resumable task by
  session and repository rather than by ticket or base, re-sends a default continuation prompt, and
  never checks the original base against current `HEAD`.
- **Delegation became automatic (2026-09-01).** The standing conflict — harness says do not spawn
  subagents unless asked, `CLAUDE.md` routes by size — was resolved by the user in favour of the
  routing. `.claude/hooks/session-routing.ps1` fires at `SessionStart`, reads the live roster off
  disk (rather than restating it, which is what rotted the old stack) and puts the routing contract
  and the standing authorisation into context once per session. Mirrored into `.codex/hooks/`.
- **R0.11 (`R0_11_prePublishSafety.test.ts`)** draws the publish line before it is needed: no
  credential in any publishable config file, `settings.local.json` quarantined and provably
  gitignored, all three layers refused by git. It reports **kind and location, never the value** —
  a failure message goes to logs, and printing the secret would publish the thing it protects.
  Verified to fail on a planted credential without leaking it.
- **`check-destructive-git` had the #177 defect too, and was never in that ticket's scope.** It ran
  one `-match` over the whole command text, so it blocked any command that merely *mentioned* a
  destructive operation — it fired on a diagnostic holding the patterns in a test-data array, which
  is how it was found. Rewritten with the same masking-and-segments approach as the commit hook;
  8/8 cases pass, blocking real invocations (including `git -C . reset --hard`) and allowing
  mentions in strings and greps.
- **R0.12 (`R0_12_hookPrecision.test.ts`) pins the hooks nothing was holding.** After
  `check-destructive-git` turned out to carry the same defect #177 had fixed elsewhere, a coverage
  check showed why it could: `check-commit-branch` had two ratchets, and **every other hook had
  none**. A hand-checked fix is how the first one passed too.
  It compile-checks every `.ps1` in the hook directory — the failure that matters most, because a
  PowerShell parse error exits 1, which reads as ALLOW: a hook that fails to compile does not fail
  closed, it stops guarding silently (an em dash did exactly that during the #177 work). Plus nine
  precision cases for the destructive guard.
  Verified against the pre-fix naive matcher, where it fails on **both** halves of the defect: the
  old version let a real `git -C . reset --hard` through AND blocked commands that merely mentioned
  the operation.
- **The Codex handoff became a mechanism (2026-09-01):** `.codex/run-role.mjs`. It reads the role's
  own `developer_instructions` out of `.codex/agents/<role>.toml` and heads the prompt with them, so
  role selection is enforced rather than hoped for — until now every call was a generic
  `task --fresh` that selected nothing. It **refuses** an unknown role, a missing or bogus `--base`,
  an empty `base...HEAD` range, and a missing `--expect`; each refusal was verified. `task --resume`
  is banned outright: it picks the newest resumable task by session and repository rather than by
  ticket or base, re-sends a default prompt, and never checks the base against `HEAD`.
  Verified live — a run launched through it arrived at Codex with the Code Mapper instructions at
  the head of the prompt.
- **Codex's relative-hook-path concern is REFUTED, empirically rather than by argument.** It warned
  that `.claude/hooks/...` registrations could fail when a command runs from a subdirectory. Probed
  by attempting a commit on `main` from the repo root and again from `src/`: blocked both times, so
  the harness resolves the hook path against the project root, not the tool's cwd. No change made —
  the earlier deferral is now a finding. (Verified for the Claude harness only; the Codex host's
  behaviour here is still unverified.)
- **Two operational traps found while wiring this up.** Cancelling a Codex job under Git Bash fails:
  MSYS rewrites `/PID` into a path (`C:/Program Files/Git/PID`) and `taskkill` refuses — stop a
  stray run from PowerShell. And a "dry" invocation of `run-role.mjs` is not dry: it launches a real
  run, because the companion lookup falls back to the plugin cache when `CODEX_COMPANION` points
  nowhere. One run was started and cancelled that way.
- **Cross-model review ran twice.** On the #141–#145 stack (`codex-reports/CX-REVIEW-stack-141-145.md`,
  six of eight claims false — fixes are in this tree) and on the #159 brief
  (`codex-reports/CX-GATE0-159.md`, Gate 0 not passed — brief rewritten as revision 2).
- **#166 step 3 implemented on `feat/166-step3-minimums`** (`1ac1f96`, `f81a7d5`), awaiting merge:
  `gridTemplate` gained one trailing `1fr` filler and the fixed column tracks provably do not move
  (`272 176 176` at both 800px and 300px in `probes/166-minimums.html`); `TableHeader` stopped
  appending an action track of its own, so all three grid consumers resolve the identical string
  for the first time, with the `[+]` still 0px after the last column; the unqueried `db-table`
  container is gone and R0.13's tree-reading witness moved to `.ppp-widget-config`. The filter
  popover keeps its literal `22rem` — the desktop popup is portaled, where `min(22rem, 100cqi)`
  measures the same 352px. **All three steps are implemented and none is accepted: every sizing
  claim is headless Chrome, not Obsidian.** The mobile half of that popover is a real pre-existing
  overflow, now filed as **#182**. Reviews: `codex-reports/CX-AUDIT-166-step3.md`,
  `CX-ADV-166-step3.md`.
- **#167 — R0.16 counts the root-anchoring the principle is supposed to remove.** R0.3 guards the
  letter of matryoshka (few raw px) and is blind to its meaning: `rem` is anchored to the document
  root, so a component sized in it renders the same in a narrow widget and across the full canvas.
  R0.16 is a ratchet in R0.3's shape over the components that live inside a declared container —
  everything under `ui/views/Dashboard/`, plus any component writing its own `@container` — minus a
  declared list of window-anchored surfaces (`TemplateConfirmDialog`, `FloatingPopup`). Comments do
  not count; `var()` fallbacks do.
  **Two Codex audits each found a route the reader of the day did not model** — first `style={…}`
  and `style:` directives (two live components were shipping sizes through them), then the
  shorthands `{style}` / `style:width` and literals hoisted into the script, which carry no value at
  the element at all. Each fix had been narrower than the hole, so the counter stopped enumerating
  routes: it now reads the **whole component text**, exactly as R0.3 has always counted `px`.
  Relocation is defeated by construction rather than by keeping up with Svelte's syntax.
  Re-measured across that change: 807 → 807 — a closed hole that moved no number, logged anyway,
  because a re-measurement returning the same value is evidence and an unlogged one looks like
  nothing happened.
  The starting number is the **measurement** on `09fef14`, and a plant test asserts one added
  declaration breaks it — pinning the ceiling to the tree instead of letting it drift, the defect
  R0.3 has (23 above its own tree, with a dead token file inside the gap until #165). An exemption
  must exhibit its mechanism — `use:portal` outside comments, or `position: fixed` in a real rule —
  after the second audit found the check accepting the bare string `FloatingPopup`, which appears in
  that component's own header. `svelteStyles` / `stripCssComments` / `collectStyled` moved to
  `src/__tests__/support/cssScan.ts`; R0.13 is otherwise unchanged.
  **It is a unit count, not a render:** it says how much root-anchoring is left and where, never
  that removing it looks right. Containment is inferred from a directory and a declared
  `@container`, not from runtime ancestry — statically unprovable, which is why #166 put the
  guarantee in the cascade. **Merged into `main` 2026-09-03** (merge `895aab2`); reviews in `codex-reports/CX-AUDIT-167.md`.
- **#180a (T1 of `SPEC_MATH_SPREADSHEET_2026-09-02`) — the project has one numeric-coercion rule.**
  `src/lib/engine/numeric.ts` (`toNumber` / `toNumbers` / `isNumeric`) replaced five disagreeing
  implementations: `"12abc"` was 12 in the kernel and NaN in the footer, `"0x10"` was 0 in one and
  16 in two others, `""` summed as 0 in the pipeline and was dropped in the footer, and all of them
  pushed a literal `NaN` into `SUM`. Ingest now stores `null` rather than `NaN` for a Number field
  whose value is not a number, which is the fix that reaches every other surface. Pinned by
  `NUMERIC_COERCION_CASES` (imported by consumers, never restated) and ratcheted by **R0.15**.
  **The two reviews then moved the boundary, on a mechanism rather than a preference.** T1 was
  supposed to leave the empty-input policy to T2, but T1 is what *creates* empty lists: a Number
  field holding `abc` used to become `NaN` and survive into the reduction, so an average of nothing
  printed the visible nonsense `NaN`. With the value dropped the list is genuinely empty, and the
  kernel's `0` would print a number that reads like an answer — the adversarial review traced that
  to the table footer, where `computeAggregations` lacked the guard its neighbour
  `computeAggregateValue` already had. So `avg`/`min`/`max`/`range` return `null` and the footer's
  "—" from the kernel now; `sum` keeps `0`, the additive identity being a real total of nothing.
  Six assertions that pinned the old policy were flipped with the reason written beside them.
  The audit found the second defect in R0.15's declared blind spot — markup — one day after the
  blind spot was written down as tolerable: `CreateField.svelte` displayed a Number field's default
  through `parseInt`, so `1.5` showed as `1` while `1.5` was written. **R0.15 now scans markup**,
  with `/* coercion-exempt: … */` as the spelling a template expression can carry, `<style>` blocks
  excluded as CSS, and four widget-setting handlers marked. Reports:
  `codex-reports/CX-AUDIT-180a.md`, `CX-ADV-180a.md`. Percent operators still return strings — that
  half of T2 (`#180b`) is untouched.
- **Canonical baseline — `main`: 217 suites / 3416 tests PASS, tsc 0, svelte-check 0/0,
  lint 0 errors (110 pre-existing tsdoc warnings).** Measured 2026-09-06 on `main` after #197,
  This line carries no arithmetic on purpose: it is re-measured on `main` at each merge, and the
  three times it was patched by reasoning instead of measurement it went wrong — twice in one day,
  crediting one ticket with another's suites.
  **The previous line (207/3343) did not reproduce and is corrected rather than carried forward.**
  Re-measured at `a5c1366`, the commit it claimed to describe: 211 suites / 3371 tests. The
  number it replaced was therefore wrong when written, not overtaken since — which is why this
  bullet is re-measured on `main` at merge instead of arithmetic being added to it.
  **A190 did not start under the full parallel run at `a5c1366` and passed on its own (16/16),
  and passed again in the full run on `main`.** It drives headless Chrome, so the failure is a
  resource one under load rather than anything about that commit. Recorded because an acceptance
  suite that can fail for a reason unrelated to its subject is worth watching, not because it
  found anything.
  **At #194 the baseline FELL, and that stays stated rather than hidden** (precedent #160/#183): `widgetTemplates.test.ts`
  tested a subject that no longer exists, and three replace-confirmation tests went with the mechanism.
  Seven tests were added in their place. One lint warning also went, with the `eslint-disable` comment
  in the deleted apply-template handler
  merged, and this line is a measurement of `main` — branch figures belong in the branch's own
  bullet, not here, which is what let this paragraph accumulate three stale ones.
  The day's arithmetic, so a future reader can check rather than trust: 179/2491 at the start of
  2026-09-02 → #165 and #181 (+2 suites) → #179 (+1 suite, R0.14) → #166 steps 1-3 (+1 suite,
  `chartWidth`, and +15 tests across R0.13 and `tableCanon`) → #178 (no test moved: three
  type-only files, which is why the count holding exactly was the evidence) → #167 (+1 suite,
  R0.16) → #180a (+2 suites — the coercion contract and R0.15 — and ~440 tests, because the
  contract table runs case by case against every implementation that used to disagree).
  The warning count fell 112 → 109 when #178 deleted three `@since` tags tsdoc does not know.
  **The baseline FELL once on 2026-09-03 and the exception is recorded here rather than implied:**
  #183 deleted the legacy Table tree and with it `helpers.test.ts`, the tree's own suite —
  −1 suite, −4 tests. The rule is that coverage may not be dropped, not that a number may never
  move: a test whose subject no longer exists is not coverage. Same shape as #160, where the
  sub-base suites went with the model, 177 → 174. The day then read 186/3007 → 186/3013 (#180b)
  → 185/3009 (#183) → 185/3012 (#180c) → 186/3020 (#168a, R0.17) → 187/3027 (#166 acceptance)
  → 188/3036 (#169) → 189/3044 (#168b) → 190/3153 (#180 T3, the parity table runs case by case)
  → 191/3158 (#182) → 192/3172 (#180 T4) → 193/3181 (#180 T5) → 194/3190 (#169 layers)
  → 195/3195 (#171).
  **Roughly a third of the day's tests are acceptance rather than unit:** `A166`, `A168`, `A169`,
  `A180d` and `A182` run the claim itself — three of them in headless Chrome, because jsdom has no
  container queries, lays out no SVG and does not move focus on Tab. `support/renderProbe.ts`
  builds those pages FROM the source files, which is what the adversarial review of #166 step 2
  faulted the earlier one-off probes for not doing.
  Older history: the meta-audit stack took `main` from 173/2464 at `64863ed` to 174/2451 (+36
  regression tests, −49 with the sub-base model #160 deleted); #164 added four provenance tests,
  R0.8 added five, #176 re-armed R0.4 (+5 cases) and #177 added R0.9 (+1 suite, +8). Do not roll
  back.
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
