# Internal documentation archive

Historical plans, audits and analysis reports live here when a newer active document replaces
their role. Archive files are evidence and context, not instructions for new work.

## Active sources

- Product priority and acceptance: `../PRODUCT_RESET_2026-07-18.md`
- User-facing north star: `../DASHBOARD_V2_VISION.md`
- Current ticket queue: `../BACKLOG.md`
- Current branch/session state: `../CONTEXT.md`

## Archived 2026-07-18

| File | Former role | Replaced by |
|---|---|---|
| `AUDIT_VISION_ALIGNMENT_2026-06-10.md` | Documentation-to-Vision gap audit | `../PRODUCT_RESET_2026-07-18.md` |
| `AUDIT_ROADMAP_2026-06-18.md` | W2–W5 execution roadmap | `../PRODUCT_RESET_2026-07-18.md` for product priority; `../BACKLOG.md` for tickets |
| `CONTEXT_2026-06-26.md` | Previous session log and W2 execution history | `../CONTEXT.md` for current state |

## Archived 2026-09-02

| File | Former role | Replaced by |
|---|---|---|
| `ENGINE_CONTRACTS_V4_DESIGN.md` | The v4 "Unified DataEngine" type layer — `src/lib/{engine,relations,colors}/contracts.ts`, deleted by #178 | Nothing. The engine was never built; the live equivalents are `lib/engine/filterEvaluator.ts` (filters), `lib/engine/aggregate.ts` (`RollupFunction`), `lib/dashboard-engine/transformTypes.ts` (the stored pipeline step) and `lib/stores/palettes.ts` (palettes) |

This one is archived design rather than a superseded document: it is the only surviving copy of
515 lines of deliberately written types, kept so the intent behind them is not re-derived from
scratch, and kept out of `src/` so it is not mistaken for code.

Historical test reports remain outside this directory while their referenced working-tree stack
still awaits the user's manual verification and merge decision.
