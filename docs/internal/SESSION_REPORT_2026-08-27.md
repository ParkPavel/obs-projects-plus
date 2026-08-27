# Session report — 2026-08-22 … 2026-08-27

> **Branch:** `feat/116-filter-order-adr` — 54 commits, pushed to `origin`, `main` untouched.
> **Baseline:** 173 suites / 2464 tests PASS, tsc 0, lint 0 errors / 124 warnings, svelte-check 0/0.
> **Scope:** 186 files, +7 687 / −12 513 lines, of which 3 155 lines are new tests.
> **Written for:** the next session. State lives in `CONTEXT.md`; this is what happened and why.

## What shipped

**M-FILTER-CONSOLIDATION, closed.** Six filter layers reduced to three documented axes with one
engine and one order — `#119 → #116 → #117 → #121 → #118 → #120 → #122`. The model is in
`FILTER_MODEL.md` (what a person must hold in their head), the invariant in `FILTER_ORDER_ADR.md`
(what the engine guarantees).

**Nineteen tickets closed** (#116–#126, #128–#131, #136–#139). **Six open**: #127, #132, #133,
#134, #135, #140.

**Two-model development established.** Claude and Codex now split the work by blind spot rather
than by cycle — `TWO_MODEL_PROTOCOL.md`. Gate 0 (design challenge before code) is the load-bearing
part; Gate 3 (pre-merge review) has not been run on this branch.

**Agent configuration removed from the public repo.** `.claude/`, `CLAUDE.md`, `AGENTS.md` are
gitignored and untracked; the Copilot mirror is archived to
`../.ai_internal/archive/copilot-2026-08-25/`. The push removed 38 files from the published tree.
History still holds them — that decision was deliberately left open.

## What this session actually taught

### Green gates are not evidence of correctness for code that rewrites stored data

#118 passed a Claude architect, a Claude developer, a Claude auditor, and four green gates, and
still shipped a migration that turned an aggregation into a presentation grouping and persisted it
on open. `executeGroupBy` collapses a frame to one record per group; the view-level `groupBy` only
sections records. Two different operations sharing a name — and nobody opened the executor to check,
because the design brief called it "ordinary grouping" and every downstream check inherited the
premise.

That is the shape of the failure worth remembering: **an unexamined premise survives every
downstream check that shares it.** Adding a reviewer does not help, because a reviewer arrives after
the work exists. Gate 0 exists for this.

### The equivalence-claim discipline came from that, and immediately earned itself

Every brief that moves, merges, replaces or migrates something must now state its equivalences as
falsifiable sentences — "X and Y produce the same result for \<inputs\>, because \<mechanism\>",
with `file:line`. A label like "a terminal group-by is ordinary grouping" cannot be falsified; that
is exactly how it got through.

Gate 0 then rejected two of my own briefs:

- **#132 revision 1** claimed the axes depend only on a frame's fields, not its origin. Refuted by
  our own code: `applyWidgetScope` moves axis A ahead of C *only when every field exists*, which is
  precisely why two sources are not interchangeable. The previous round's fix was the
  counter-evidence to the new claim, and I wrote the claim anyway.
- **Revision 2** was rejected on three of five claims, on release order, and for missing a P1 on
  the *write* path — because the brief was written entirely about reading.

Both rejections cost minutes. #118 cost a milestone.

### Six defects that only a second reader found

| | What it was |
|---|---|
| #136 | An unresolved external source rendered the **parent project's** records, with no signal |
| #139 | An external block **wrote** to the parent project — "Add first record" landed in the wrong one |
| #137 | The pipeline editor was configured against the parent's schema |
| #138 | `enrichWithBacklinks` silently destroyed a real field named `<relation>_backlinks` |
| #125 | Promoting a filter-tab erased `groups`, forced `or` → `and`, and dropped disabled conditions |
| #123 | Promoting emitted `"is"` for every field type, silently dropping every record for Number/Boolean/Date/List |

Every one of them is the same failure: **the interface asserted something the runtime did not
honour.** The Notion reference the project already had (`specs/NOTION_DM_RESEARCH.md`) states the
rule — the operation lives with the object, every rule is visible and removable in one click, an
empty state shows what hid the data. `LINKED_SOURCE_DESIGN.md` applies it.

### Configuration drifts unless a machine watches it

Four separate generations of stale test baselines were found across the agent configs in one day.
Three sweeps each declared the repo clean; each had grepped only for the generation it remembered.
`R0_7_configDrift` now fails on any hardcoded baseline or px budget, pattern-based rather than by
known-bad list — and it found a fourth generation immediately, plus a whole instruction file nobody
had opened.

Twenty-seven agent definitions existed across three systems. Now nine, in one.

### My own process failures, recorded because they will recur

- **I read the lint gate with `tail -2` for three commits.** That prints the "potentially fixable"
  line and cuts off the `✖ N problems (N errors…)` summary directly above it. Three commits reported
  "lint 0 errors" from a command that could not have shown one. A lint error I introduced in #126
  survived until #138.
- **I nearly implemented a fix for a bug that did not exist.** audit-manager filed #127 as an
  invariant violation; walking the template's block nesting showed the heuristics were already
  type-gated. An audit finding is a lead, not a fact.
- **A guard test of mine could not fail.** Its literal omitted the regex escaping, so three "no copy
  here" assertions passed against any file at all. The positive assertion caught it.
- **Two extraction passes returned zero and I nearly believed them** — the first regex matched only
  the object form of `t()`, the second used `\s` in `grep -E`, which ERE does not support. Both
  times the tool was wrong, not the codebase.
- **I over-cautioned on the push**, reading `.claude/*` in the diff as exposure when they were
  deletions. The user was right; I had misread the direction of the change.

The pattern across all five: a verification step that cannot fail is worse than no verification,
because it produces confidence. Every guard added this session was checked by breaking it —
`R_filterOrder` was verified by reverting the #118 inversion and watching exactly one assertion go
red.

## Open work

| Ticket | P | Why it is still open |
|---|---|---|
| **#132** | P1 | The last of the linked-source stack. Needs `transformExecution` marker, migration, generator sweep in one commit (schema-evolution rule), two scope branches, two reversible UI branches. Design in `LINKED_SOURCE_DESIGN.md` rev 2, Gate-0-corrected. |
| **#133** | P2 | Pipeline `group-by` and view-level `groupBy` share a name for different operations. Renaming one is what makes #118's mistake unavailable in future. |
| **#134** | P1 | Rebuild the demo project as an investor-grade tour. Currently exercises 3 widget types of 16 and fetches 14 cover images over the network. |
| **#135** | P2 | External review, from outside the two-model loop. |
| #127 | P3 | Cosmetic, downgraded — the original report was wrong. |
| #140 | P3 | uk/zh-CN lack 115 keys; deliberately left to fall back to English rather than machine-translated. |

## Not done, and owned by the user

- **Gate 3** — `/codex:review --base main --background` has never run on these 54 commits. It is
  the largest unreviewed surface in the project and the commands are user-invocable only by design.
- **Merge to `main`** — the branch is pushed but not merged.
- **Visual smoke in the OBStests vault** — the A→C→B inversion is a real behavior change. The tests
  pin the contract; a dashboard mixing a pipeline `filter` with a block `subFilter` wants eyes.
- **Public history** — untracking stopped further publication; the 65 previously published config
  files remain in git history.
