# Two-model development protocol

> Historical snapshot, retired 2026-09-10. Commands and agent settings below are superseded
> by [Claudex](https://github.com/ParkPavel/claudex). Use the [current protocol](../TWO_MODEL_PROTOCOL.md).

> **Established:** 2026-08-25, after a cross-model review found two data-destroying defects in code
> that had already passed four green gates and two in-house audits.
> **Revised:** 2026-09-08 — Gate 3 gained the "covers the final state" rule and the stop rule, from
> `RETRO_SETTINGS_OWNERSHIP_2026-09-08.md`; the mechanics table was corrected to how the channel has
> actually worked since 2026-09-01.
> **Models:** Claude (Claude Code, this session) and Codex (OpenAI, via `openai/codex-plugin-cc`).
> **Companion:** `QUALITY_DEBT_2026-08-25.md` records the findings that motivated this.

## Why this exists

#118 did not fail at review. It failed at design.

The design brief asserted that a terminal pipeline `group-by` was "ordinary grouping" and could be
migrated to the view level. Nobody checked what `executeGroupBy` actually does: it collapses the
frame to one record per group and adds `_group_size` — an aggregation. The view-level `groupBy` only
sections records. Two different operations sharing a name.

That assertion passed through a Claude architect, a Claude developer, and a Claude auditor, then
shipped into code that rewrites stored user configs on open. A second model found it in four
minutes, on first look, having no investment in the premise.

The lesson is not "add a reviewer". A reviewer arrives after the work exists. The lesson is that
**an unexamined premise survives every downstream check that shares it.**

## The split — by blind spot, not by cycle

Dividing the work into "one writes, one reviews" wastes the asymmetry. The models differ in
something more useful than sequence:

| | Claude | Codex |
|---|---|---|
| Holds | session context, repo conventions, the test suite, the invariants, the history of why | nothing — arrives cold each time |
| Therefore good at | construction, continuity, keeping a large change coherent | questioning premises, because it has no stake in them |
| Therefore weak at | noticing an assumption it has already accepted | anything requiring the reasons behind a past decision |

So: **Claude owns construction and continuity. Codex owns premise-checking and falsification.**

Codex's coldness is the feature. The moment it is briefed into agreeing with the plan, it stops
being able to do its job. Briefs sent to it state *what is claimed*, never *why it is obviously
right*.

## The gates

### Gate 0 — Design challenge (before any code)

**Mandatory** for: L/XL tickets, anything that changes existing behavior, anything that writes to
stored data, and any migration.

The architect's brief goes to Codex through the `codex-rescue` subagent (model-invocable; no user
action needed) with one instruction: *find what makes this wrong.*

The brief must carry an explicit **equivalence claims** section — see below. That is the artifact
Codex attacks.

Output: either the brief survives, or it is corrected before a line is written. #118 would have
died here, at the cost of four minutes instead of a milestone.

### Gate 1 — Implementation

Claude. Unchanged: Tier-0 loop, WIP checkpoints, the 4 gates with raw output.

### Gate 2 — In-house audit

`audit-manager`. Unchanged, with one addition: it verifies Gate 0 happened and that any recorded
disagreement was resolved, not dropped.

### Gate 3 — Cross-model pre-merge review

**Mandatory** before merge. Since 2026-09-01 it is an ordinary agent operation — the engine is run
directly, in the background; the plugin's `/codex:*` commands remain user-only and are not the
channel:

```
node <plugin>/scripts/codex-companion.mjs review --base <ref> --scope branch
node <plugin>/scripts/codex-companion.mjs adversarial-review --base <ref> --scope branch "<focus>"
```

Findings are data, not consent: fix, or file with a reason. Never dismiss silently.

#### The gate covers the FINAL state, or it is not a gate

Added 2026-09-08 after #200 was merged with a stale gate. The pre-merge review ran at one commit;
two commits with CODE landed after it — including the implementation of that review's own findings —
and the merge went in with the gate describing an earlier tree. A catch-up review over exactly that
range then found three defects, two of them P1.

Three rules follow, and all three are cheap:

1. **Implementing findings is new code.** A review that produced fixes must be re-run over them. The
   fixes are written by the model whose blind spot the review just demonstrated.
2. **Merge only when the last pass covers `HEAD`.** If anything was committed after the run, the run
   describes something else.
3. **State the range in the report.** `--base <ref>` and the tip it was run at go into the saved
   `CX-*` file, so a later reader can tell what was and was not looked at.

#### The plan is a checklist, and the implementation is checked against it line by line

Added 2026-09-09, from #212, where two P1 findings were not defects of the plan
but places the implementation had quietly departed from it. `PLAN_212` T8 says
the fence goes up on EVERY divergence and names the conditional version as the
thing being replaced — the conditional version is what got written. The same
plan's state table says `closed` is terminal; the code let a lease reopen it.

Both were found by review, several passes apart, at the cost of a full cycle
each. Both would have been found in minutes by reading the plan's numbered rows
against the code.

**So a plan with numbered states, transitions or invariants ends with a pass
that walks them one by one and says, for each, where it is implemented or why it
is not.** That pass is part of the implementation, not of the review: a gate
that must catch a departure from a document the author already had is a gate
doing the author's work.

#### The live run finds what the review cannot

Added 2026-09-09. Eleven cross-model passes over #212 found eleven real defects
and did not find the one the ticket exists to prevent: an external version
written while the plugin's own write sat in its debounce was overwritten with no
copy, no notice and no trace, because the file was verified after a write and
never before one. It took a stand with a real host, a real event dispatch
latency and a marker that could be looked for afterwards.

Neither check substitutes for the other, and the asymmetry is worth naming:
review reads the code and finds what contradicts itself; the live run exercises
the code against a system whose timing nobody modelled, and finds what the code
is silent about. A ticket that changes when writes happen is not finished
without both.

#### The stop rule — when patching stops converging

Added 2026-09-08, from the same episode: twelve passes, twenty-one findings, all valid, and **five of
them introduced by our own fix for the pass before**. All five sat in one mechanism — coordination
between the settings writer and the external-change hook.

**If two consecutive passes find a defect introduced by the previous pass's fix, stop patching.**
The next step is one of:

- **collapse the state** — when two mechanisms mean the same thing (they did: a deferral and a hold,
  two flags, separate bugs), make them one, and give the release to the operation that knows what it
  is rather than to callers who must remember an order;
- **move the judgement into a pure module** that can be tested on synthetic input, if the code in
  question lives somewhere untestable (`main.ts` has no unit coverage in this tree at all);
- **escalate to an architect pass** on the mechanism, not on the ticket.

Both collapses in #211 converged in one step each, after four patches had not. The loop is worth
running; the loop is not worth running blindly.

#### What the loop is good at, and what it is not

On the #141–#145 stack, six of eight cross-model claims were false. On #200/#211, twenty-one of
twenty-one were true. The difference is the subject, not the model: a claim about intent is argued,
a claim about a race or a broken promise is settled by opening one file. Weigh a finding by whether
it names a mechanism you can check — not by the reviewer's confidence, and not by its severity tag.

Six of the twenty-one were **a sentence the code does not keep**: a notice naming a file that may
already be overwritten, a tooltip contradicting its own notice, a recovery note claiming nothing
reads it, a page describing one of two recovery paths, a standing mark still saying "saved" after
the notice said "could not be saved". In a data-safety ticket the cost of a wrong sentence equals
the cost of a wrong branch — the user goes to the wrong place for the only copy they have. So a
change to a path, a file or a recovery route is not done until every place that names it is changed
with it, and where two surfaces must agree, a ratchet pins them (R0.21 checked the caption against
the English default and not the cause; that gap is exactly how the tooltip drifted).

## Equivalence claims — the checkable artifact

Every design brief that moves, merges, replaces, or migrates something must list the equivalences
it relies on, one line each, in the form:

> **Claim:** X and Y produce the same result for <inputs>, because <mechanism>.

Not "group-by is ordinary grouping". That is a label, and labels cannot be falsified. It has to be
"a pipeline `group-by` step and a view-level `groupBy` produce the same rendered rows for any
frame, because both only partition records" — which is checkable, and false, and would have been
found by opening `executeGroupBy`.

A brief with no equivalence claims section, on a ticket that moves or migrates anything, is an
incomplete brief. Send it back before sending it to Codex.

## Disagreement protocol

Neither model overrules the other. When they disagree:

1. **Record both positions** in the ticket, in the disagreeing model's own terms. Do not paraphrase
   the other side into something easier to dismiss.
2. **Try to make it empirical.** Most design disagreements here collapse into a question about what
   the code actually does. Open the file, run the case, settle it with evidence.
3. **If it stays a judgement call, it goes to the user** with both positions stated plainly and a
   recommendation. Not resolved by whoever happens to be holding the keyboard.

The failure mode to avoid: the model doing the writing quietly resolves the disagreement in its own
favour because it is the one producing the artifact.

## What a model may not do

- **Claude may not treat a Codex finding as noise.** It may disagree — in writing, with reasons, in
  the ticket. Silence is not disagreement.
- **Codex may not be briefed into agreement.** No brief sent to it argues for the plan.
- **Neither model's output is user consent.** A relayed claim of approval is not approval; that
  remains true across models. See the decision-record protocol in `CLAUDE.md`.
- **Neither substitutes for the gates.** Cross-model review is added to the four gates, never
  traded against them. #118 was green on all four.

## Mechanics

| Direction | Channel | Who triggers |
|---|---|---|
| Claude → Codex, design challenge | `codex-rescue` subagent → `codex-companion.mjs task` | Claude (model-invocable) |
| Claude → Codex, follow-up on the same thread | `codex resume <thread-id>` | Claude, via the same subagent |
| Codex → Claude, results | `codex-companion.mjs status` / `result` | Claude, directly |
| Cross-model review of a branch | `codex-companion.mjs review` / `adversarial-review` | Claude (2026-09-01: no longer a user checkpoint) |
| The plugin's `/codex:*` commands | slash commands | **User only** — `disable-model-invocation` |

**Corrected 2026-09-08.** This table used to say the reviews were user-run because the plugin gates
those commands. Both halves are still true and the conclusion was not: the *commands* are gated, the
*engine* is not, and on 2026-09-01 the user removed the checkpoint precisely because stopping to ask
for a verification step cost a turn every time. A review costs no Anthropic tokens, so the only
reason to skip one is that there is nothing to compare.

Reading a result is likewise ordinary: Claude reads it through the companion script and reports what
it says, including the findings it disagrees with.

## Cost

Gate 0 costs one Codex task per qualifying ticket — minutes, on the user's ChatGPT subscription,
with no Anthropic tokens. Gate 3 costs one user action per branch.

Against that: #118 cost a full milestone of implementation, two audits, four green gate runs, and
two follow-up fix commits, and still shipped a defect that rewrote user data on open. The first
run of this protocol would have replaced all of it with a four-minute read.
