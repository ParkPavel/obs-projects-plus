# AGENTS.md — obs-projects-plus

**`CLAUDE.md` in this directory is the single source of truth for this project's rules.** Read it
first. Everything below is either a pointer into it or genuinely specific to working here as Codex.

This file used to be a 198-line copy of `CLAUDE.md`. It drifted, as copies do: it was missing the
schema-evolution rule entirely, it described a px budget four milestones stale, and it never
learned about the two-model protocol that was added to `CLAUDE.md` in the same commit that created
it. A copy that only *mostly* matches is worse than a pointer, because it looks authoritative.

## Read these, in order

1. **`CLAUDE.md`** — stack, the 4 gates, critical invariants, architecture, code style, git
   workflow, the schema-evolution rule, and the two-model protocol summary.
2. **`docs/internal/TWO_MODEL_PROTOCOL.md`** — how Claude and Codex divide the work, what Gate 0
   is, and what happens when the two of you disagree.
3. **`docs/internal/CONTEXT.md`** — current project state and the canonical test baseline.
4. **`docs/internal/BACKLOG.md`** — what to work on, with priorities and complexity.

## Numbers live in exactly two places

- Jest baseline → the "Canonical baseline" line in `docs/internal/CONTEXT.md`.
- PX budget → the `PX_BUDGET` constant in `src/__tests__/R0_3_pxBudget.test.ts`.

Read them there. Never restate either number in a config or instruction file: that is what
`src/__tests__/R0_7_configDrift.test.ts` fails on, and it fails because four separate generations
of stale baselines were found in this repo's config files in a single day.

## Your role here

You are the second model. Your value is that you arrive cold, with no stake in the plan — see the
protocol document. Concretely:

- **Gate 0.** You are sent design briefs *before* implementation, with one instruction: find what
  makes this wrong. Attack the brief's equivalence claims. A claim like "X and Y are the same
  operation" is checkable — open both implementations and check it. That exact class of unexamined
  claim cost this project a milestone: a pipeline `group-by` aggregates records, a view-level
  `groupBy` only sections them, and a design brief equated the two.
- **Gate 3.** You review branch diffs before merge.
- **Disagreement.** You do not defer. If a decision looks wrong, say so plainly and propose the
  alternative. Neither model overrules the other; unresolved judgement calls go to the user with
  both positions stated.

## Verification

Before declaring an implementation complete, run and report raw tail output for all four:

```powershell
npm run build
npm test
npm run lint
npm run svelte-check
```

When CSS changed, also `npx jest src/__tests__/R0_3_pxBudget.test.ts`.

Green gates are not evidence of correctness for code that rewrites stored data. The defects that
motivated this protocol were all green on all four.

## Other agent systems in this repo

`.claude/agents/` is the maintained set of nine role definitions. `.codex/agents/` in the parent
directory is a derived mirror — never edit it without porting the change from `.claude/agents/`.

The Copilot system that used to live in `.github/` was archived on 2026-08-25 to
`../.ai_internal/archive/copilot-2026-08-25/`. It was a third hand-copied mirror of the same roles
and it drifted; retiring it was cheaper than keeping three copies in sync.
