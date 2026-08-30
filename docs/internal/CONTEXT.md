# Current project context

> **Updated:** 2026-08-29 (meta-audit stack #141–#164 + live API run + Notion reference analysis;
> session reports: `SESSION_REPORT_2026-08-27.md`, `SESSION_REPORT_2026-08-28.md`)
> **Historical log:** `archive/CONTEXT_2026-06-26.md`
> **Active product contract:** `PRODUCT_RESET_2026-07-18.md`

## Current directive

Build a local Markdown-first system rather than a Notion clone. New product work follows the
Relation-first vertical slice in `BACKLOG.md` and must map to a scene in the Product Reset.
The old W2–W5 sequence is historical; it does not select the next product ticket.

## Working tree and release state

- **`main` is at `64863ed`** — the merge of `feat/116-filter-order-adr` (M-FILTER-CONSOLIDATION)
  and the linked-source stack. Both `feat/116` and the relation-first work `feat/112` are IN `main`;
  every "pending merge" statement in older documents is historical (#146).
- **Never run on that merge:** Gate 3 (`/codex:review --base main`) and the visual smoke of the
  A→C→B inversion in the OBStests vault. Merged is not the same as accepted.
- **The meta-audit stack is committed on `feat/meta-audit-141-164`** (branched from `64863ed`,
  2026-08-30, five commits `3423aad → 02d7427`, working tree clean). It touches **82 paths**
  against `64863ed` — 43 modified, 32 added, 7 deleted; 47 under `src/`, 32 under `docs/`.
  The "64 changed paths" of the 2026-08-28 report counted `codex-reports/` as one entry and
  predates the last two days of the stack; 82 is the measured number. It closes the whole
  Codex meta-audit queue: #141 rollup resolution, #142 gallery read-only, #143 derived inverse
  (decision, user-approved), #144 write outcomes, #145 migration restore point, #146 documentation
  sync, #149 relation label, #150 wizard, #151 (partial), #152 sort ADR, #153 stats canonical key,
  #154 ticket template, #155 suggestion honesty, #156 first-run honesty, #157 deviations register,
  #160 sub-base removal, #161 caller outcomes, #162 stale enrichment on target change,
  #163 batch write compensation, #164 demo generator.
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
  The pre-rewrite history is kept at `backup/meta-audit-141-164-presplit` (`33eef1e`) and can be
  deleted once the branch is merged. **The lesson is the general one:** a green tip says nothing
  about the commits under it, and a test that reads two sources pins them to one commit.
  **#148 is closed by documentation, not code** — the boundary is stated in `FILTER_MODEL.md`
  (§"Analytical joins are not relations"), which rides in the documents commit; no source file
  carries a `#148` marker, and that is expected.
  **Not merged, not pushed** — both are user-reserved gates, and `/codex:review --base main` has
  not run on this branch.
- **Cross-model review ran twice.** On the #141–#145 stack (`codex-reports/CX-REVIEW-stack-141-145.md`,
  six of eight claims false — fixes are in this tree) and on the #159 brief
  (`codex-reports/CX-GATE0-159.md`, Gate 0 not passed — brief rewritten as revision 2).
- **Canonical baseline — `main` + the uncommitted stack: 174 suites / 2451 tests PASS, tsc 0,
  svelte-check 0/0, lint 0 errors (124 pre-existing tsdoc warnings).** From 173/2464 at `64863ed`:
  +36 regression tests across the tickets above, −49 with the sub-base model #160 deleted.
  Do not roll back.
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
  pipelines that migrate on first open (#164). Both verified fixed in the running app.
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
