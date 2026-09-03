# CX-AUDIT-183 — auditor on the legacy Table deletion (fix/183-delete-legacy-table vs main bb669fb)

Run 2026-09-03 through `.codex/run-role.mjs --role auditor`, Codex session 01a0659c-ba75-7b63-b69a-7701eb7a9180. Verdict BLOCKED on two findings, both true and both closed in `docs/183-followups`: the baseline fall now carries a recorded exception in CONTEXT.md, and the three documents still pointing at the deleted tree were corrected.

## Verdict: BLOCKED

Findings:

- **P1 — Jest baseline falls.** [CONTEXT.md](docs/internal/CONTEXT.md:434) requires the canonical baseline not to fall, while the only deleted test suite, `src/ui/views/Table/helpers.test.ts:9,26,53,80` at `bb669fb`, is removed with no replacement test file. The ticket itself records this reduction. Failure scenario: the PR passes collection but lowers the mandated baseline. Falsified by restoring equivalent test coverage or recording an approved policy exception that supersedes the invariant.

- **P2 — active documentation still points to the deleted tree.** [ADR_RECORD_OPEN_CONTRACT_2026-09-02.md](docs/internal/ADR_RECORD_OPEN_CONTRACT_2026-09-02.md:43) states that the directory still contains `helpers.ts` and `components/DataGrid/`; [PROJECT-INFO.md](PROJECT-INFO.md:43) says its removal is merely scheduled; [ARCHITECTURE_V5.md](docs/ARCHITECTURE_V5.md:109) says it remains pending deletion. Failure scenario: a maintainer follows these references and lands on missing source or makes an incorrect reachability decision. Falsified by updating or explicitly archiving these references.

Observed:

- The commit is on `fix/183-delete-legacy-table`, not `main`.
- All 37 deleted blobs occur exactly once, byte-for-byte, in `docs/internal/archive/LEGACY_TABLE_DATAGRID.md`; no archive sections are missing or extra.
- `main.js` is the identical Git blob at base and head.
- The only deleted test file is the tree’s `helpers.test.ts`.
- The source diff is deletion-only; no source/config/build/style file was added or modified. Therefore no new `@ts-ignore`, `new Menu`, hex, regex/JSON parsing, filter-order, px, LOC, or encoding violation can have been introduced by this commit. Current `new Menu` matches are confined to the permitted context-menu helper and a mock.
- I could not execute Jest or the four gates: Node aborts before loading the runner because this read-only sandbox denies `lstat` on `C:\Users\Park`.

**UNKNOWN:** source inspection and bundle identity cannot prove that an independently installed Obsidian plugin never dynamically reaches this formerly private tree; no live Obsidian run was available.

