# Two-model development protocol

> **Established:** 2026-08-25, after a cross-model review found two data-destroying defects in code
> that had already passed four green gates and two in-house audits.
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

**Mandatory** before merge. User-run, because the plugin gates these commands deliberately:

```
/codex:review --base main --background
/codex:adversarial-review --base main --background <what to challenge>   # L/XL + behavior changes
```

Findings are data, not consent: fix, or file with a reason. Never dismiss silently.

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
| Codex → Claude, results | `/codex:result <job-id>` | **User** — the command is gated |
| Cross-model review of a branch | `/codex:review`, `/codex:adversarial-review` | **User** — gated |

The gating is deliberate on the plugin's side and is respected: the reviews and the result reads
keep a human in the loop. The design-challenge channel does not, which is what makes Gate 0
practical to run on every qualifying ticket.

When the user asks Claude to check a Codex job, that *is* the human in the loop, and Claude reads
the result through the companion script directly.

## Cost

Gate 0 costs one Codex task per qualifying ticket — minutes, on the user's ChatGPT subscription,
with no Anthropic tokens. Gate 3 costs one user action per branch.

Against that: #118 cost a full milestone of implementation, two audits, four green gate runs, and
two follow-up fix commits, and still shipped a defect that rewrote user data on open. The first
run of this protocol would have replaced all of it with a four-minute read.
