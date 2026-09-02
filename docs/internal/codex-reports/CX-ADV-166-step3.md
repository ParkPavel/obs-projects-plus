# CX-ADV-166-step3 — adversarial reviewer, `feat/166-step3-minimums`

- Role: `adversarial-reviewer` (`.codex/agents/adversarial-reviewer.toml`), `--effort high`
- Base `d2f2bbd` (`main`) → head `f81a7d5`; run 2026-09-02
- Scene: Vision 7 — the same block in a narrow column and at full width looks proportionate
- Asked to challenge four decisions: the filler vs UT-R2 #083, moving `[+]` out of its own track,
  leaving the popover literal, and deleting `db-table`.

## Disposition by `lead` (2026-09-02)

**P1 (popover / mobile branch) — TRUE, accepted, and filed as #182 rather than fixed here.**
The reviewer is right that the ADR's flat "the popover is portaled" was incomplete: only the
desktop branch carries `use:portal`; the mobile bottom sheet renders in place under
`.ppp-widget-host`, so `min-width: 22rem` can overflow a narrow widget's sheet. This was seen by
`lead` during the portal determination and, on the reviewer's challenge, is now written down
instead of carried silently. It is **not** fixed inside Step 3 for two reasons, both recorded in
the ADR and in #182: the defect is pre-existing (#112's portal fix was desktop-only, and #166
neither caused nor worsened it), and the obvious patch does not actually close it — `cqi` measures
`.ppp-widget-host`'s content box while the sheet's usable width is that minus its own `0.5rem`
padding, leaving ~1rem of overflow. The real fix is `min(22rem, 100%)` or a containing-block fix
in `FloatingPopup`, and it needs a mobile render to check against.

Changed in response: the ADR's portal paragraph now states both branches, and the comment beside
the rule in `BlockFilterBar.svelte` names the mobile case and #182.

**Grid decision — challenged and upheld, on independent evidence.** The reviewer traced the
template written once at `DataTableContent.svelte:81,182` and consumed identically by header, row
and footer, confirmed the fixed columns precede the sole filler, and confirmed the add button has
a definite width in that filler. It found no conflicting consumer in the group or footer paths.

**`db-table` deletion — upheld.** No named query or container reference after deletion; the filter
bar is a *sibling* of the table content, not a descendant, so it never resolved against it.

**UNKNOWN, and agreed — this is the honest limit of the step.** Real resize-drag, grouping, footer
and readonly acceptance are unverified: the new test checks source strings, not computed layout,
and the probe is a reconstruction. Already recorded in the ADR under Step 3 and in the ticket; the
vault run is the outstanding evidence, and the ticket is **not** marked DONE without it.

Its inability to run Jest is the known read-only-sandbox artefact, not a finding.

## Raw output

Verdict: do not accept the popover decision as complete.

**P1 — the “leave it literal” rationale misses the mobile branch.**  
Observed: desktop alone is portaled to `body`, while the mobile bottom sheet is rendered in place ([FloatingPopup.svelte](src/ui/components/FloatingPopup/FloatingPopup.svelte:265), [FloatingPopup.svelte](src/ui/components/FloatingPopup/FloatingPopup.svelte:285)). The filter content retains `min-width: 22rem` ([BlockFilterBar.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/BlockFilterBar.svelte:83)), and its widget ancestor is an inline-size container ([WidgetShell.svelte](src/ui/views/Dashboard/widgets/WidgetShell.svelte:156)). The mobile branch activates below the configured mobile breakpoint ([ui.ts](src/lib/stores/ui.ts:24), [ui.ts](src/lib/stores/ui.ts:133)).

Inference: on a mobile widget narrower than that minimum, the unportaled popover can still overflow its sheet. `min(22rem, 100cqi)` would be a no-op for the portaled desktop case yet cap the mobile descendant to its container. The ADR’s unqualified assertion that the popover “is portaled” is therefore incomplete ([ADR](docs/internal/ADR_MATRYOSHKA_SIZING_2026-09-02.md:371)).  
Confidence: high. Falsify it by opening the block filter in a real narrow mobile dashboard and showing the sheet has no horizontal overflow while its inner popover’s computed used width remains within the sheet.

The grid decision itself looks structurally sound, but only at source level: the live resize template is written once on the table root ([DataTableContent.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:81), [DataTableContent.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:182)); header, record row, and footer consume the identical template ([TableHeader.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/TableHeader.svelte:107), [TableRow.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte:92), [TableFooter.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/TableFooter.svelte:27)). Fixed columns precede the sole filler ([tableCanon.ts](src/ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts:74)); the add button has a definite width in that filler ([TableHeader.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/TableHeader.svelte:183)). No conflicting current consumer appeared in the inspected group or footer paths.

However, real resize-drag, grouping, footer, and readonly acceptance remains **UNKNOWN**. The added test checks source strings, not computed layout ([tableCanon.test.ts](src/ui/views/Dashboard/widgets/DatabaseCall/__tests__/tableCanon.test.ts:214)), and the ADR explicitly records those real cases as unverified ([ADR](docs/internal/ADR_MATRYOSHKA_SIZING_2026-09-02.md:416)).

For `db-table`: I found no present named query or container reference after deletion, and the filter bar is a sibling—not a descendant—of the table content ([DatabaseCallBlock.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:402), [DatabaseCallBlock.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:509)). Present-consumer breakage is unsupported by the code inspected; future consumers are inherently **UNKNOWN**.

Targeted Jest could not run in this sandbox: PowerShell blocked `npx.ps1`, and `npx.cmd` was denied access while resolving the user directory.

Codex session ID: 01a06228-b36c-7940-a37a-8ea2c7a4a464
Resume in Codex: codex resume 01a06228-b36c-7940-a37a-8ea2c7a4a464
