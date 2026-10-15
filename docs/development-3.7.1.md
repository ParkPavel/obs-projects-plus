# 3.7.1 stabilization baseline

[Русский](development-3.7.1-RU.md)

Snapshot: 2026-10-08. This document consolidates the existing implementation, the original 19-point tester report and the completion requirements for the 3.7.1 candidate. It is a stabilization specification, not a release announcement or a claim that every scenario works.

## Boundaries and document authority

The current request is to finish existing functions before adding roadmap features. The initial Notion-grade mandate describes the target experience; it is not evidence that the plugin already meets that target. The September 29 roadmap remains background direction. The October 5 stabilization cycle puts data-loss, input and performance defects before that roadmap. The original tester report supplies the numbered acceptance cases below.

The private Borshkit `release-371` contract is narrower than the full matrix: stabilization stages 2–4 remain excluded outside explicit C9/C10/C11/C12, and the remaining step-6 field migration is excluded. Wave 1 has C7/C8, wave 2 has C9/C10, wave 3 has C11/C12. Green automated checks cannot establish completion of all 19 cases. Additional work needs explicit criteria before completion is claimed; modeled checks never replace manual criteria.

Use these documents for different questions:

| Question | Authority |
|---|---|
| What must the existing product do reliably? | Original tester cases and this completion matrix |
| What is actually implemented? | Source at the exact checkout plus regression tests |
| What passed on a particular device? | Recorded scenario, artifact hash, environment and observed result |
| What has been accepted? | Borshkit acceptance sheet; manual criteria belong to the user |
| What may come later? | Roadmap; it does not close a stabilization defect |
| How do I use or extend it? | [User guide](user-guide-EN.md), [architecture](architecture-EN.md), [API](api.md), [contributing](../CONTRIBUTING.md) |

Keep historical reports intact. A new report supersedes an old result only for the same scenario on a newer identified artifact. Do not count an unrelated green test, static bundle analysis, a narrow desktop window or the absence of a reported theme defect as mobile acceptance.

## Exact implementation baseline

The main checkout is at `479321bd871b83e8d245b6ac5b9fdfc102f0fb50`. The candidate is `borshkit/release-371` at `352cc1083288060f9b2aa6b9408c394f3f6d6f45` plus uncommitted source fixes. Both package and manifest still declare **3.7.0**, minimum Obsidian **1.8.7**, `isDesktopOnly: false`. “3.7.1” names the candidate, not an installed release version.

The current uncommitted fixes cover context-sensitive UK/US date parsing, retention of the original stored date spelling through read → table edit → write → reload, and the Agenda's missing-mode/custom-list inconsistency. They have targeted regression tests. This does not close all database input, calendar gesture or Agenda UX defects.

The isolated runtime built on October 8 has `main.js` SHA-256 `954955dfd15bfbe11b75052e66b7ec96f37fe381001e191113d27e3cc8d0643b` and `styles.css` SHA-256 `d247bf40b210e42b2a41c363a3d5efdab617798af016ec178e464e1fea3b7dd7`. It loaded in a synthetic vault in desktop Obsidian **1.13.7**. This proves loading only. The environment rejected launching the CDP-enabled instance needed to attach Playwright; no Playwright UI scenario or real-phone scenario passed in this snapshot.

## Completion matrix

Implementation wave 1 (after the loading-only baseline above) adds cooperative table search, cancellation and unmount cleanup, invalid-number/incomplete-date protection, IME guards, a bounded render window after data shrinkage, and clickable keyboard-accessible record names. `tableSearchResponsiveness.test.ts` uses 5000 records and checks yielding, query replacement, clearing, frame replacement, teardown and zero-match states. `editableCell.test.ts`, `tableWindowing.test.ts` and `tableNameNavigation.test.ts` cover the other regressions. These are implemented/code-tested improvements, not device acceptance. The private contract adds automated C7 and manual C8 without accepting or dropping C3–C6. The earlier artifact hash describes the earlier loading check, not this newer source.

Continuation of wave 1: `listEditRoundTrip.test.ts` uses the installed real YAML parser, not the lightweight shared mock, to reproduce list-to-string writeback on a no-op and duplicate-key rendering failure. Text lists now use `ListCellEditor` with shared `TextField`/`FloatingPopup`, an independent draft, explicit Apply/Cancel, add/remove and focus on a new item. Punctuation, duplicate/empty entries and other note properties/body survive the round trip; non-text values are not coerced to text. Unsupported arrays in scalar columns are protected rather than advertised as editable. IME Escape no longer dismisses the shared popup mid-composition. Extraction of scalar editing/search predicates/table interactions restores component size limits; existing limits are lowered to measured size, not raised. This does not migrate step 6 or accept all overlay/keyboard scenarios.

Priority is a triage proposal: P0 = data integrity/crash/input blocker, P1 = primary workflow failure, P2 = clarity/adaptation. Every row remains open until its observed acceptance result is attached. “Partial” means an implementation or test exists, not that the original complaint is fully resolved. Paths below are relative to `src/` and identify the inspection boundary, not a proof of success.

| ID | Priority and reported failure | Current evidence / inspection boundary | Required acceptance |
|---|---|---|---|
| 01 | P0: database edits fail; dates reset/change format | Partial: `lib/helpers/dateShape.ts`, `ui/views/Dashboard/widgets/DatabaseCall/editedCellValue.ts`; `dateEditRoundTrip.test.ts` tests persistence | Edit text, number, checkbox, selection and each supported date spelling with Enter/blur/Escape; reopen/reload. Only intended fields change, bodies and date duration/time/format remain intact. Existing date-format controls must be discoverable. Desktop + phone. |
| 02 | P1: dashboard touch drop jumps; layout/navigation inflexible | Partial reorder work; `ui/views/Dashboard/WidgetGrid.svelte` | Capture pointer offset; scroll during drag; cancel and drop at edges. A compact placement preview and coherent tile sizing/navigation must satisfy the reported need. Desktop + phone. |
| 03 | P0: visible tables freeze/crash/heat the phone | Virtualization work is not device proof; `ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte` | Test recorded small/large datasets and tile counts on a named phone; measure rendered rows, interaction latency, long tasks and memory over repeated mount/scroll. No crash or navigation lock. Record device observations; do not infer temperature from browser timing. |
| 04 | P1: table does not fit its tile | Unconfirmed; same table component and widget host | Narrow/wide tile and window, long text and horizontal scroll: content stays within the owning tile with reachable controls. Desktop + phone. |
| 05 | P0: database search freezes phone | Unclosed; `ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts` search path | Type, replace and clear a query while scrolling a large dataset. Query cancellation and scheduling must keep navigation responsive; measure before/after on a phone. |
| 06 | P1: tile lock has no meaningful effect | Unclosed; `ui/views/Dashboard/widgets/WidgetHost.svelte`, grid drag boundary | Define what locking prevents in the existing dashboard model, then prove it at every entry point, including drag. Do not retain a control with no observable effect. |
| 07 | P1: users cannot construct a chart | Configuration exists, successful tester flow absent; `ui/views/Dashboard/widgets/Chart/ChartConfig.svelte` | From a fresh dataset, create a meaningful chart using UI alone; verify source, axes, aggregation and empty/invalid states without developer assistance. |
| 08 | P2: widget creation uses confusing nested buttons | Unclosed; `ui/views/Dashboard/DashboardToolbar.svelte` | One understandable creation path; no redundant “Widgets → create” step without purpose. Verify names, focus and keyboard access. |
| 09 | P2: statistics aggregation purpose is unclear | Numeric aggregates are not charts; `ui/views/Dashboard/dashboardWidgets.ts` | Clearly distinguish a numeric summary from a chart; make aggregation, field and empty state understandable with a concrete dataset. |
| 10 | P1: new widgets disappear below the viewport | Append behavior exists; same widget creation module | On creation, bring the new tile into view and focus its relevant control, or offer an understandable placement setting. Preserve stored order after reload. |
| 11 | P1: month/two-week calendar entries overlap | Unclosed on phone; `ui/views/Calendar/CalendarView.svelte` | Multiple same-day entries in both scales remain readable/reachable; overflow handling never makes events inaccessible. |
| 12 | P1: scroll opens day popup; small-window scaling fails | Unconfirmed; calendar view and gesture handlers | Scroll never opens a day popup; deliberate tap does. Verify popup fit and focus in small windows and on phones. |
| 13 | P0: Agenda filter input ignores typing | Unit behavior is insufficient; `ui/views/Calendar/components/Timeline/AgendaSidebar.svelte` | Focus and type with physical/soft keyboard; value and suggestions update; filtering persists as specified. Input stays above the keyboard. Desktop + phone. |
| 14 | P1: creating a list reveals old presets instead | Partial missing-mode fix; `agendaListPersistence.test.ts` | Fresh start has the intended list state. Create, rename, edit, remove and reload a custom list; no unrelated preset replacement. Desktop + phone. |
| 15 | P0: inconsistent overlays jump/hide behind keyboard | Partial shared-field migration; remaining migration excluded by old contract | Inventory each editor/popup path; consistent focus, dismissal, scroll and keyboard avoidance. Native pickers may remain native if intentional, documented and usable. No field moves out of reach. |
| 16 | P0: event resize becomes move; duration collapses to one hour | Partial calendar fixes/tests; `ui/views/Calendar/calendar.ts`, `processor.ts` | Resize top/bottom, move, cancel, duplicate and reload in day/week views; multi-hour duration and body remain intact across dates/timezones. Desktop + real touch device. |
| 17 | P0: Kanban drag crashes; covers/path input fail | Partial thumbnail/drag work; `ui/views/Board/` | Repeated drag on recorded large boards, cancellation, cover selection/resize and valid/invalid local paths. No crash, text pile-up or data loss. Desktop + phone. |
| 18 | P2: no explicit theme defect reported | Not a theme pass | Repeat essential input, popup and drag scenarios in light/dark themes; contrast and focus remain visible. |
| 19 | P1: mobile gallery grid/cards are incomplete | Partial responsive grid; `ui/views/Gallery/` | At phone widths, choose layout and card size, edit/open cards and use their advertised fields/actions without clipped or unreachable controls. |

## Implementation order and stopping rules

### Wave 2: code-verifiable fixes

C9/C10 cover cases 06/08/09/10 and a bounded part of 15. `dashboardReorder` pins locked stack indices even when neighbors move and rejects invalid ID proposals. Locked tiles have no drag grip; editing, deletion and collapse are not locked. Creation opens its type menu directly; `dashboardReveal` focuses/reveals only the latest new creation within its own root after rendering, without reordering or refocusing a config echo. Title editing guards IME, cancellation and duplicate commits.

`statsDefaults` aligns first configuration and displayed cards; explicit empty cards no longer resurrect count/sum/average. Column settings apply with narrow-tile adaptation, and an explanation distinguishes summaries from charts. `statsSparkline` replaces a call-stack overflow on 200000 values with an SVG bounded to 200 points retaining bucket extrema; numeric aggregation still uses every value. The unconfigured-widget wizard and configuration handler offer no write in read-only mode.

Shared `FloatingPopup`/`ComboField` use their own window's `visualViewport` and clean up listeners; the mobile layer fits the visible area and reveals its focused field, while desktop popups constrain dimensions and scroll. Escape goes to an inner field before the topmost popup; pressing inside that popup does not close the one underneath. `popupKeyboard`, `dashboardFeedback`, `dashboardLayoutFeedback`, `statsFeedback`, `statsSparkline`, `widgetSetupFeedback` and `WidgetShell` test these mechanisms. New module ceilings are measured; existing ceilings never increase.

This updates code evidence for rows 06/08/09/10/15 above, not manual acceptance. All 19 original cases remain in the matrix. The earlier loading hash does not identify this wave; the new artifact and check results belong to a separate private Borshkit report. Paired RU/EN guides are updated; installation, versioning, merge/push/release are not performed.

1. Close data/input/crash blockers: 01, 03, 05, 13, 15, 16, 17. Add a failing regression before each fix; preserve note bodies and unrelated properties.
2. Unify common input, popup and pointer/touch lifecycles. Cover keyboard avoidance and false clicks after scrolling; an individual field fix does not prove the whole layer.
3. Stabilize dashboard placement, bounds, locking and focus: 02, 04, 06, 10. Specify observable behavior before introducing controls.
4. Validate chart/statistics/creation explanations and calendar/gallery adaptation: 07–09, 11–12, 18–19; perform real-device acceptance.

Do not start new roadmap functionality to compensate for an unresolved existing flow. Splitting fixes into bounded tasks is allowed; dropping a tester case from the matrix is not. A failed check blocks release. An unobserved manual result remains unobserved, not PASS. Do not increase quality budgets to hide regressions.

### Wave 3: charts and Agenda operators

October 9, C11/C12: a bounded part of cases 07/13/15. `chartAggregations` restricts operations by field type using the shared aggregation canon. An unsupported stored operation stays visible with a warning and is not rewritten on opening. An explicit field change preserves a compatible operation or selects “Count all”; the explanation distinguishes record counting, including empty values, from summation. Scatter does not expose its unused aggregation. `ChartWidget` unsubscribes from selection on destruction.

`chartFeedback.test.ts` connects the real `ChartConfig` and `ChartWidget`: three records A/10, A/30, B/20 produce bars 40/20 and then a line SVG. This SVG flow already worked before wave 3; confirmed RED regressions concern incompatible operations, field changes and subscription leakage. This does not prove that users understand every chart type.

`FilterRow` replaces its separate imperative operator popup with `FloatingPopup`/`PopoverList`, preserves value clearing for operators without input, and restores focus to a real field button. Tests cover arrows, button selection, Escape/IME, no write on cancellation and portaling into the anchor document. The iframe model is not a real Obsidian popout check; soft keyboard and real touch remain manual C12. The full record/vault suggestion scan and remaining field migration are not claimed fixed. All 19 original cases remain in the matrix; this newer slice requires its own identified artifact and fresh checks.

### Third-wave continuation: extra series and the agenda editor

Added on 2026-10-09: `ChartSeriesEditor` uses the same aggregation canon as the primary axis, with metadata from its own source. A text-first source no longer defaults to `sum`. Unsupported stored operations and missing fields remain visible; opening the panel and late source loading do not write configuration. Explicit field or already-loaded source changes reconcile the operation. Unknown fields/types offer counts, not unverified numerical operations. Before the fix, eight `chartSeriesEditor.test.ts` cases failed for the expected reasons; another regression reproduced the missing field's disappearing name. An empty new series uses canonical Count all. This does not resolve the historical ambiguity between a field literally named `count` and the special record count: that remains a separate configuration-format limitation.

`fitAgendaOverlay` constrains the actual list editor to the intersection of its calendar container and its own window's visible viewport. An already-open keyboard is accounted for on mount; viewport resize/scroll and container changes recalculate bounds, and closing removes listeners. The second keyboard compensation, a large bottom padding inside an already-shrunken editor, has been removed. `agendaOverlayViewport.test.ts` mounts the real `AgendaSidebar`, opens the editor and tests bounds/cleanup, container intersection, a separate document, absence of double padding and focused-field scrolling. Three RED regressions confirmed geometry problems; another RED regression confirmed the extra bottom padding. These are DOM/viewport models, not real-keyboard acceptance. Additional steps are in C10/C12, focused checks in C9/C11; seven manual criteria remain unaccepted.

The new module and series editor enter the LOC ratchet at measured sizes; existing ceilings are not raised. This continuation needs fresh artifact hashes: earlier builds do not contain these changes. All 19 matrix items remain; this slice does not close mobile crashes, month/two-week layout, board covers, gallery or the remaining shared-field migration.

## Developer configuration and verification protocol

CI uses Node 22; the maintainer's Borshkit runtime uses Node 24.21.0. Record which one ran each check. The project already uses `obsidianmd.configs.recommended` with type-aware ESLint. Its settings-definition preference is explicitly disabled to preserve the 1.8.7 minimum API; do not enable a newer-only API or raise that minimum during cleanup without a separate compatibility decision.

Run TypeScript, Svelte with `--fail-on-warnings`, ESLint with `--max-warnings 0`, the full Jest suite, and an isolated production build. Documentation changes additionally require `R0_25_documentationPairs` and `R0_26_documentationLinks`. The exact native Borshkit checks and their evidence live in the private task space; see [contributing](../CONTRIBUTING.md). Refresh them after the final file change.

For each live run, record checkout/diff, artifact hashes, Obsidian/plugin/OS versions, viewport or device, dataset size, action sequence, persisted file diff, console errors and screenshot/trace paths. Use a separate synthetic vault, not personal data. Check the vault name before automation, and preserve/restore the vault registry if a harness modifies it.

Use the GitHub [Microsoft Playwright CLI skill](https://github.com/microsoft/playwright/blob/4357c237cfde9135fb5b7894c22a45468321a973/packages/playwright-core/src/tools/skills/playwright-cli/SKILL.md) and [Obsidian CLI skill](https://github.com/kepano/obsidian-skills/blob/3ccff5338ea700537839b21900aa5358a0402c98/skills/obsidian-cli/SKILL.md), pinned here for reproducibility. This snapshot inspected `@playwright/cli` 0.1.22 and actual Obsidian CLI help. Use observed controls or DOM, never invented selectors as evidence. The installed CLI's help takes precedence over examples in a newer skill.

Obsidian CLI commands must explicitly target the test vault:

```sh
obsidian vault=<synthetic-vault-name> help
obsidian vault=<synthetic-vault-name> plugin:reload id=obs-projects-plus
obsidian vault=<synthetic-vault-name> dev:errors
obsidian vault=<synthetic-vault-name> dev:console level=error
```

Playwright can attach only when a test-owned desktop instance exposes CDP. [Electron documents the remote debugging switch](https://www.electronjs.org/docs/latest/api/command-line-switches). Never expose it on a personal vault or publicly. Detach only the named test session; do not use global browser-kill commands. Desktop resizing is not mobile acceptance. Do not enable Obsidian's global mobile emulation in this workspace.

Apply the official [Obsidian plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines): production code uses the plugin's app, atomic frontmatter updates, normalized paths and lifecycle cleanup; Node/Electron-only dependencies require mobile-safe boundaries. Theme and owning-document behavior must survive pop-outs. The existing [Obsidian ESLint rules](https://github.com/obsidianmd/eslint-plugin) help enforce these constraints but do not prove usable touch gestures or acceptable performance.

## Release completion

Completion requires all applicable matrix scenarios to pass on the identified artifact, clean automated gates, paired documentation matching actual behavior, and the user's manual acceptance. Publish exact failures and exclusions; never present a percentage based only on green tests. Keep runtime diagnostics and personal configuration out of Git. No version change, merge, push or release is authorized by this document.
