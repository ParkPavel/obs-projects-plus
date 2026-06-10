---
description: "Use when designing a NEW major feature or epic from scratch (not a BACKLOG ticket). Produces a structured spec → constraints → invariants → plan artifact in docs/internal/specs/ before any code is written. Mimics Spec-Driven Development without external tooling."
---

You are starting a brand-new feature for obs-projects-plus. Follow this Spec-Driven flow strictly — do not jump to code.

## Inputs

Ask the user (one question at a time) for any of these you do not have:

1. **Feature name** (short, kebab-case, e.g. `dashboard-v3`, `formula-debugger`)
2. **Problem statement** — what user pain does this solve? (2-5 sentences)
3. **Out of scope** — what this feature does NOT include (prevents scope creep)
4. **Success criteria** — measurable outcomes (e.g. "user can X in ≤3 clicks", "no regression in PX-budget")
5. **Affected layers** — Shell / UI / Engine / Data (see CLAUDE.md Matryoshka)

## Phase 1 — Specification (the "what" and "why")

Create `docs/internal/specs/<feature-name>/SPEC.md`:

```markdown
# Spec: <Feature Name>

## Problem
<problem statement>

## Goals
- <measurable goal 1>
- <measurable goal 2>

## Non-Goals
- <explicit exclusion>

## User Stories
- As a <user>, I want <capability>, so that <benefit>

## Success Criteria
- <verifiable outcome>
```

Stop here. Show the spec to the user. Wait for approval before Phase 2.

## Phase 2 — Constraints & Invariants Check

Spawn `semantic-analyzer` with:
> Read `docs/internal/specs/<feature-name>/SPEC.md`. Identify which existing invariants from `CLAUDE.md` constrain this feature. List affected files, types, and modules. Output: `docs/internal/specs/<feature-name>/CONSTRAINTS.md` with sections: Affected Files, Touched Invariants, Risk Areas, Dependency Map.

Wait for the artifact. Review with the user.

## Phase 3 — Plan (the "how")

Choose architect by primary layer:
- **Engine/Data/Shell layer** → spawn `backend-architect`
- **UI/widget layer** → spawn `frontend-architect`

Prompt the architect:
> Read SPEC.md + CONSTRAINTS.md. Produce `docs/internal/specs/<feature-name>/PLAN.md` with: Architecture diagram (text), Contracts (TS interfaces / props), Migration plan (if data shape changes), Test strategy, Risk mitigations. Do NOT write implementation code.

Review with user. Iterate until approved.

## Phase 4 — Task Decomposition

Convert PLAN.md into ordered tasks in BACKLOG.md:
- Create `#NNN` ticket entries with title, description, acceptance criteria, affected layer.
- Show the user the task list. Ask if they want to:
  - (a) Convert to GitHub Issues (use `/backlog-to-issues` afterwards)
  - (b) Execute directly via `/run-pipeline`
  - (c) Hand back for manual prioritization in `BACKLOG.md`

## Phase 5 — Implementation Handoff

Do NOT call `senior-developer` from within this command. The user runs `/run-pipeline` or hands the spec to a coding session. This command's job ends at "spec + plan + tasks ready".

## Halt Conditions

Stop and ask the user if:
- Any phase artifact contradicts an existing invariant
- Spec covers >2 architectural layers (suggest splitting)
- Test baseline (139/2099) cannot be preserved
- Estimated effort >5 tickets (suggest epic split)
