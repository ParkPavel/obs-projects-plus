# CX-REVIEW — branch diff against `3.6.0-alpha` (2026-09-01)

First review run through the companion script directly rather than through the user-gated
`/codex:review` command. Range: `3.6.0-alpha...HEAD` — 10 files, +1053 / −51.

## Codex output, verbatim

```
# Codex Review

Target: branch diff against 3.6.0-alpha

The new R0.9 suite aborts on its first expected blocking result in the Windows setup where it is
enabled, breaking the test gate.

Review comment:

- [P1] Run each hook case in an isolated PowerShell process —
  src/__tests__/R0_9_commitHookPrecision.test.ts:60-60
  When this test runs on Windows with the local hook present, the first `commit-on-main` case
  invokes the hook with `&`; the hook's intentional `exit 2` terminates the shared runner before it
  emits JSON. Consequently `JSON.parse(run.stdout)` throws and no later cases run. Spawn the hook
  separately for each case and collect its exit code instead of invoking it inside the aggregate
  runner.
```

## Verdict: the P1 is FALSE. No change made.

The finding rests on a claim about PowerShell semantics that is not true: that `exit` inside a
script invoked with the call operator `&` terminates the *calling* script. It does not. `&` runs
the script in its own scope; `exit N` ends that script, sets `$LASTEXITCODE` in the caller, and
control returns. Only dot-sourcing (`. .\script.ps1`) would run `exit` in the caller's scope and
take the parent down with it — and line 60 uses `&`, not dot-sourcing.

Disproven twice, by experiment rather than by reading:

**1. The semantics in isolation.** A probe script containing nothing but `exit 2`, called three
times with `&` from a runner shaped like R0.9's:

```
[{"id":1,"code":2},{"id":2,"code":2},{"id":3,"code":2}]
```

The runner survived every case, captured exit code 2 each time, and emitted its JSON.

**2. The suite itself**, run on Windows with the hook present — the exact condition the finding
names:

```
√ the hook still compiles - a parse error would exit 1 and allow everything
√ blocks a real commit on main                     ← the case claimed to abort the runner
√ blocks a commit on main reached through git's own repo option
√ blocks a sequence that steps ONTO main and then commits
√ allows a commit on a feature branch
√ allows a branch and a commit issued as one command
√ allows commands that merely mention the words
√ is not fooled by the words appearing in a commit message

Test Suites: 176 passed  ·  Tests: 2473 passed
```

Five cases run *after* the one Codex says stops the runner. Had the claim held, the suite would
have failed on `JSON.parse`, and the gate would have been red rather than green.

## Why this is recorded rather than dismissed

Codex findings are data, not consent — and that cuts both ways. The prior stack review
(`CX-REVIEW-stack-141-145.md`) had six of eight claims false; this one is one of one. The value of
the run was not the finding: it was confirming that a review against a real base returns something
to argue with, after the default working-tree review compared `main` with itself and reported
"No changes exist relative to the specified merge-base commit" — which means *nothing was
compared*, not *nothing was found*.

Nothing was changed in response to this review.

## What this review did NOT cover

- `.claude/hooks/check-commit-branch.ps1` itself is **gitignored**, so the hook the P1 is about is
  not in the diff Codex read — it reasoned about the hook from the test's use of it.
- The adversarial pass (`adversarial-review`) was not run; it challenges the decision rather than
  the code and is the one that would question, for example, keeping `contracts.ts` (#178).
