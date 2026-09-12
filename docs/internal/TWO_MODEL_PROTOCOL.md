# Two-model development through Claudex

Agent configuration and orchestration moved to the separate public project
[Claudex](https://github.com/ParkPavel/claudex). Its shared contract, native adapters,
role definitions, task lifecycle and publication controls are maintained there.

The workspace contains the Claudex repository, this product repository and private local
storage as siblings. Start from the workspace entrypoints and run Claudex `doctor` before
delegated work. Project-local `.claude`, `.codex`, `.agents` and the old role runner are retired.

## Product responsibilities

Read `CONTEXT.md`, `BACKLOG.md` and `PRODUCT_RESET_2026-07-18.md` for current state, accepted
decisions and product criteria. Keep those decisions with the product. Do not copy baseline
or budget numbers into the harness.

Implementation happens in an assigned worktree. Independent review covers the final source
state after fixes. For visible or persistent behavior, use the native Obsidian CLI acceptance
path described in [MANUAL_TESTING_PIPELINE.md](MANUAL_TESTING_PIPELINE.md).

Record each finding as confirmed, rejected with evidence, fixed or explicitly deferred.
Record the source/build identity with acceptance evidence. A model's completion or proposed
PASS is not a product acceptance decision.

## Historical material

The [pre-Claudex protocol](archive/TWO_MODEL_PROTOCOL_PRE_CLAUDEX_2026-09-10.md) is retained
for its engineering history. Its agent names, paths, launch commands and authorization
claims are superseded. Do not execute it as the current workflow.
