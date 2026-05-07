# Lessons Learned — obs-projects-plus refactor sessions

> Append-only. Each entry = a mistake made + what it cost + invariant to enforce.
> Source: sessions 1–5 (V4 + V5.0–V5.3 + docs audit).

---

## L-001 — BOM corruption via PowerShell Set-Content

**Mistake**: Used `PowerShell Set-Content -Encoding utf8` to write files. PowerShell 5.1 writes UTF-8 BOM. This corrupted session-state.md and caused silent parse failures.

**Invariant**: **Never use PowerShell Set-Content for project files. Use the Write tool exclusively.** Applies to all .md, .ts, .svelte, .json files.

---

## L-002 — Architect subagent results from wrong codebase

**Mistake**: Architect subagent returned findings (LOC counts, file paths, module structure) that matched a different version of the codebase than the one being worked on. Code was written against these stale facts.

**Invariant**: Any architect/explore agent finding that names a file path, LOC count, or function name must be verified with a direct Read or Grep before being used in implementation. "The agent found X" ≠ "X exists now."

---

## L-003 — `indexOf(-1)` sorts unknowns BEFORE known fields

**Mistake**: Assumed `DataviewDataSource.sortFields` using `indexOf()` sorts unknown fields at the end. In JS, `indexOf` returns -1 for unknowns, and -1 < 0 sorts unknown fields BEFORE known ones.

**Invariant**: When sorting with `indexOf`, unknowns get -1 which sorts FIRST. Use `indexOf(x) === -1 ? Infinity : indexOf(x)` to sort unknowns last.

---

## L-004 — DataFieldType is an enum, not a string literal

**Mistake**: Test factories used string `"string"` instead of `DataFieldType.String`. TypeScript strict mode caught this only at runtime in some paths.

**Invariant**: Always use enum members (`DataFieldType.String`, `DataFieldType.Number`, etc.), never string literals (`"string"`). Same for `FilterOperator` and `RollupModeId`.

---

## L-005 — `DataField` requires `identifier: boolean`

**Mistake**: Test factories omitted the `identifier` field from `DataField` objects, causing silent bugs in tests that depended on it.

**Invariant**: `DataField` always requires `{ name, type, identifier }`. Include `identifier: false` explicitly in all test factories.

---

## L-006 — "Engine v2" was never the right concept

**Mistake**: Several sessions used "Engine v2" as a label for the planned enhanced formula/relations layer. This was wrong — there was no versioned engine, only the V5 architecture with an enhanced formula stack. "Engine v2" appeared in roadmaps, changelogs, and PR descriptions, creating confusion for contributors and users.

**Invariant**: The correct framing is "Dashboard Engine" for the computation layer and "Dataview adaptive absorption" for the Dataview strategy. Never use "Engine v2" — it implies a breaking engine replacement that doesn't exist.

---

## L-007 — "Database View Modernization" was a misleading label for v3.4.0

**Mistake**: v3.4.0 was described as "Database View Modernization" — implying incremental improvement of an existing view. The reality was a paradigm migration: Database View was moved INTO the Dashboard canvas as a widget. "Modernization" hid the architectural change.

**Invariant**: Roadmap entries must describe WHAT CHANGED ARCHITECTURALLY, not just that something was "improved" or "modernized". Use migration/paradigm-shift language when the change is structural.

---

## L-008 — LOC estimates in backlog were wrong by 4×

**Mistake**: REFACTOR_BACKLOG_V5.md estimated `src/ui/views/Table/` at ~1800 LOC. Actual measurement: `TableView.svelte` = 424 LOC (DataGrid.svelte is shared with DataTableWidget). The estimate was from a pre-refactor snapshot.

**Invariant**: Never copy LOC estimates from older docs into new tickets. Always measure with `wc -l` before filing a complexity estimate. Stale estimates distort prioritization.

---

## L-009 — Documentation written before terminology was locked

**Mistake**: Roadmap docs were written with "Engine v2", "Stage A/B", "M0-M5" terminology before the team locked on V5 phase naming. This created a second pass to clean up ALL public-facing docs.

**Invariant**: Lock terminology in a decision log entry (decision-log.md) BEFORE writing roadmaps, changelogs, or README sections. "What do we call this?" must be answered before "How do we describe this?".

---

## L-010 — `.ai_internal/` was referenced from official docs

**Mistake**: `NOTION_PARITY.md` referenced `.ai_internal/NOTION_DATABASE_INTEGRATION_MASTER.md` as a source of truth. `.ai_internal/` is AI scratch space, not a stable docs artifact.

**Invariant**: Official docs (`docs/internal/`, `docs/`) must never reference `.ai_internal/`. If a finding from AI scratch space is worth keeping, extract it into a proper doc first.

---

## L-011 — Stale status snapshots left in live memory space

**Mistake**: `memories/repo/STATUS_2026-05-05.md` showed V5.1-V5.3 at 0% long after those phases were complete. It was in `memories/repo/` (a live space) not in `docs/archive/`.

**Invariant**: Point-in-time status snapshots belong in `docs/archive/`, not in `memories/repo/`. `memories/repo/` contains only living documents: session-state, decision-log, contract-registry, lessons-learned.

---

## L-012 — Sub-bases exist and work in DataTableWidget, but docs described them as future

**Mistake**: README and planning docs described sub-bases as a V5.5 future feature. In reality, `SubBaseTabs.svelte` (177 LOC) + `DataTableWidget.svelte` sub-base handlers are fully implemented and working. The disconnect between code and docs eroded trust in the roadmap.

**Invariant**: Before marking any feature as "planned" in docs, grep the codebase. If implementation exists and is working, document it as current capability, not future.

---

**Last updated**: 2026-05-07
