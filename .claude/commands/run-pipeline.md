---
description: "Run the development pipeline on the next open ticket. Routes by ticket complexity — XS/S inline, M/L/XL through the orchestrator — and halts only at the user-reserved Codex review and merge/push gates."
---

Take the next open ticket and drive it to READY FOR PR.

**First, route.** Read the ticket's `Complexity` in `docs/internal/BACKLOG.md` and pick the lane
(see CLAUDE.md → Routing). Escalate a lane when the ticket touches ≥2 modules, changes stored-data
shape, or changes existing behavior, whatever complexity it claims.

- **XS / S — stay in this session.** Do the work inline: implement, run the 4 gates with raw
  output, update `BACKLOG.md` status in the same commit series, then spawn `audit-manager` for the
  pre-PR verdict. Spawning six cold agents to change ten lines costs more than it returns.
- **M — partial chain.** `senior-developer` + `audit-manager`, with `semantic-analyzer` first when
  the blast radius is unclear.
- **L / XL — full pipeline.** Spawn the `orchestrator` agent and let it run its sequence.

**Skip, don't stall.** A ticket marked "needs user decision" whose decision record is not yet
`RESOLVED` cannot be unblocked by a subagent — relayed approval is not approval. Take the next
unblocked ticket and report the skipped one. If the decision is genuinely needed now, ask the user
here, in this session, where their answer is real, and write it into `BACKLOG.md` before running.

**Accumulate the stack.** Do not stop for merge/push between tickets; that gate comes once, at the
end.

**Before merge, the Codex gate.** Ask the user to run `/codex:review --base main --background`, and
`/codex:adversarial-review` as well for L/XL or behavior-changing work. Triage what it returns.

Do not merge. Do not push. Do not pass a failed gate, and never raise a budget constant to make one
pass.
