# Quality debt — full-project audit, 2026-08-25

> **Source:** full-project audit run by `audit-manager` after M-FILTER-CONSOLIDATION closed,
> plus an independent second-opinion pass by Codex (OpenAI) on the same branch.
> **Branch audited:** `feat/116-filter-order-adr` (22 commits for this milestone).
> **Tickets:** #125–#131 in `BACKLOG.md`.
> **Status of this plan:** provisional until the Codex pass is read back. A second model looking
> at the same code already justified itself once — the in-house audit found a data-loss defect in
> code this milestone had just shipped and gated green.

## What the audit actually changed

The branch passed all four gates, held the baseline, and still contained a defect that silently
destroyed a user setting. That is the useful fact from this round: **green gates are not evidence
of correctness for code that rewrites stored data.** The migration added in #118 wrote a
`DataTableConfig.groupBy` into whatever single view tab it found, without checking the tab type —
and only the table view reads that shape. A board or gallery tab swallowed the step.

Two lessons are now encoded in the code and the configs rather than in this document:

- A migration writes to a slot only when it can prove the slot is read back. Otherwise the step
  stays in the pipeline. `legacyMigration.ts` states this per branch.
- Numbers do not live in config files. The audit found a hook injecting a four-milestone-stale
  baseline into every session, and a second 198-line `AGENTS.md` mirror that an earlier sweep had
  never opened. Both now point at `CONTEXT.md` and the `PX_BUDGET` constant.

## Remediation plan

### Wave 1 — loses data

| Ticket | P | Cx | Lane |
|---|---|---|---|
| #125 — `promoteLocalToGlobal` destroys groups / `or` / disabled conditions | P1 | S | **M** (escalated) |

The only true P1. `DashboardCanvas.svelte` overwrites `view.filter` with a flat
`{ conjunction: "and", conditions }`. Three separate losses in one click on a FilterBridge chip:
nested `groups` erased, an `or` conjunction forced to `and` (the filter's *meaning* inverts, not
just its shape), and every disabled condition dropped because `globalFilters` arrives
pre-filtered by `enabled`.

Escalated from S to M by the routing rule: it changes stored-data shape. Needs a merge rather than
a replace, a regression per loss, and the promotion path documented in `FILTER_MODEL.md`, which
does not currently mention it.

### Wave 2 — invariants, and a test that protects a false statement

| Ticket | P | Cx | Note |
|---|---|---|---|
| #128 — order-invariant test freezes the ADR | P2 | S | **first in this wave** |
| #127 — `FieldControl` dispatches by `field.name` | P2 | XS | inline |
| #126 — ReDoS policy duplicated three times | P2 | XS | inline |

#128 goes first because it blocks the others' documentation. The test asserts substrings in a
markdown file, and one of them requires `FILTER_ORDER_ADR.md` to keep claiming it "does not
describe the current runtime wiring". After #118 that is false — but correcting the ADR breaks the
test. Until it is rewritten to assert the order *in code*, the documentation of the filter order
cannot be made true.

#127 is a direct violation of invariant 1: a Number field named "Estimated time" gets a time input
because the control matches substrings of the field name.

#126 is drift risk, not an active hole: tightening `regexSafety.ts` would not reach the filter
engine, which carries its own byte-copies of the guards. Whether to also close the alternation gap
(`^(a|a)+$` passes) is a judgement call — the pattern is the user's own, written into their own
vault, so the blast radius is their session.

### Wave 3 — cleanup

| Ticket | P | Cx |
|---|---|---|
| #129 — ~1940 LOC of files with no importers | P3 | S |
| #130 — i18n key sets diverge across locales | P3 | S |
| #131 — docs drift (`CLAUDE.md` WidgetType block, table search surface, CHANGELOG) | P3 | XS |

#129 carries one precaution: check dynamic imports and string references, not only static
`import` statements. A first pass nearly recorded `gestureHandler.ts` as live because the grep
matched a local variable named `_gestureHandlers` in `CalendarView`; the module's only apparent
importer turned out to be a line inside its own JSDoc example.

## Not remediation — decisions still open

**The #118 behavioral inversion is not in the changelog.** `FILTER_MODEL.md` documents it for
developers, but a person with the plugin installed will see a different filtering result after
update with no notice. That is a release-note decision, not a code fix.

**The migration writes to disk on `onOpen` with no backup and no undo** (`dashboardView.ts`).
It is idempotent and conservative, and every branch that cannot prove safety leaves the step in
place — but the first write is irreversible. Whether that warrants a one-time backup of
`data.json` before the first migrating open is an open question, and it is the kind of question a
second model is better placed to answer than the one that wrote it.

**Branch size.** 47 commits are unmerged. The milestone is closed, which is the natural point the
stack was being accumulated toward. Continuing to pile Wave 1–3 onto the same branch keeps the
review growing, and #125 touches `view.filter` — the same surface #123 touched. Splitting a
regression out of a 47-commit range is materially harder than out of a fresh one.
