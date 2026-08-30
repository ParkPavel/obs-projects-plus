# Vision deviations register

> **Created:** 2026-08-27 (#157) · **Updated:** 2026-08-28
> **Why:** `DASHBOARD_V2_VISION.md` is the source of truth for what the product promises.
> Several promises are knowingly not met. Until this file existed, each of those lived in a
> different place with a different status — `PRODUCT_RESET` §4 called one a "decision gap",
> `BACKLOG` called the same thing deferred, and a third was only visible as a comment in a Svelte
> file. That is how a project ends up believing it is closer to its own vision than it is.
>
> **Rule:** a deviation belongs here the moment it is knowingly accepted. One line of status,
> one reason, one place to change it. `PRODUCT_RESET_2026-07-18.md` §4 links here rather than
> restating.

| # | Vision promise | Reality | Status |
|---|---|---|---|
| D-1 | Scene 8 — the dashboard is itself a Markdown file, readable and portable | Configuration is JSON inside the shared plugin `data.json` (`main.ts` → `saveData`) | **Deferred to V3.** Decided in `BACKLOG.md` §Option B. Not a gap to be closed by the next ticket; a format decision with a migration cost. |
| D-2 | Scene 6 — complex formulas are assembled "with gestures and words", never typed | `FormulaConstructor.svelte:10-18` states it plainly: code mode is the only mode | **Cancelled promise, not debt.** A visual builder was considered and rejected during M-YAML-FORMULA-UI. If it returns, it returns as a new milestone, not as a bug fix. |
| D-3 | Scene 3 — "one entity in two interfaces": editing a record writes to its Markdown | A block reading an external source is read-only (#139, extended by #142) | **Accepted, narrow.** The parent dashboard's `api` writes to the parent project, so an external block's edits would land in the wrong file. Read-only until a source-specific write API exists (`LINKED_SOURCE_DESIGN.md`). |
| D-4 | Scene 6 — the system proposes aggregates by data type: growth, trend, anomalies, visit frequency, next-visit forecast | Two rules exist: numeric → Stats, relation → linked block (`smartSuggest.ts`) | **MVP, honestly labelled (#155).** #059 shipped as "smart suggestions" without saying how little it covers. The gap is real product work, tracked, and not to be cited as delivered. |
| D-6 | Scene 4 — a relation is two-way: the target's card gains the back-link | The inverse property is **derived**, not written. A back-link appears through backlink enrichment and linked blocks; the target's frontmatter is only touched when the user maintains such a property themselves | **Decided 2026-08-28 (#143), approved by the user the same day.** WikiLink stays the single foreign key (contract §2 principle 3). Writing a second copy into the target would need rename/delete reconciliation that does not exist, and duplicates the truth. The wizard no longer claims otherwise — both the explanation and the checkbox label were corrected — and real write failures are now surfaced. The writer still runs when the user has maintained such a property themselves: that is synchronisation of their own data, not a second source of truth. Reversible: the writer path is intact. |
| D-5 | Scene 5 — a saved filter becomes a base with its own views | A filter is a field inside one view; it has no identity of its own | **Being closed.** User decision 2026-08-27: build it as a real entity. `M-SAVED-SELECTION` (#160 done, #159 brief next). |

## How to use this file

- **Adding:** when a decision knowingly leaves a Vision promise unmet, add a row the same day,
  with the reason it was accepted — not just what was chosen.
- **Removing:** a row leaves only when the promise is actually met in code, and the ticket that
  met it is named in the commit.
- **Not for:** bugs, unfinished tickets, or things nobody decided. A deviation is a *decision*.
  If it was not decided, it is a gap in the backlog, not a row here.
