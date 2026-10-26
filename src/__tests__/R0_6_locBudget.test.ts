/**
 * R0_6_locBudget.test.ts — #067 F1 (UT2026-F) component size ratchet.
 *
 * The #052 lesson: a 947-LOC WidgetHost monolith survived two milestones
 * because nothing enforced the budgets written in UI_DESIGN_ARCHITECTURE §7.
 * This test makes the ceilings executable. Budgets may only be lowered.
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");

const BUDGETS: ReadonlyArray<{ file: string; maxLines: number }> = [
  // 240 → 230 (#184): the frame math moved to `hostFrames.ts`, and a ceiling
  // that keeps the room the move freed is not a ceiling. Banked in the same
  // commit as the removal, which is the rule this ratchet exists to enforce.
  // 230 → 225 (#194): the content chain left for `WidgetContent.svelte` (−20)
  // and the data-scope panel arrived (+15). The net is banked rather than
  // pocketed — the host stood at 229 under a 230 ceiling before this ticket,
  // which is how a "one line of room" file gets ten lines added to it twice.
  { file: "ui/views/Dashboard/widgets/WidgetHost.svelte", maxLines: 225 },
  // 120 → 106 (3.6.0): which records a widget starts from moved to
  // widgetInput.ts when a chart or stats block learned to read another
  // project; the room that move freed is not kept.
  { file: "ui/views/Dashboard/widgets/hostFrames.ts", maxLines: 106 },
  { file: "ui/views/Dashboard/widgets/widgetInput.ts", maxLines: 64 },
  { file: "ui/views/Dashboard/widgets/_shared/DataProjectPicker.svelte", maxLines: 36 },
  { file: "ui/views/Dashboard/widgets/WidgetShell.svelte", maxLines: 350 },
  { file: "ui/views/Dashboard/widgets/WidgetHeaderActions.svelte", maxLines: 220 },
  { file: "ui/views/Dashboard/widgets/widgetMenu.ts", maxLines: 80 },
  { file: "ui/views/Dashboard/widgets/WidgetSetupWizard.svelte", maxLines: 80 },
  { file: "ui/views/Dashboard/widgets/widgetComponentRegistry.ts", maxLines: 260 },
  // #169. Entered at their measured size, which is not a raise: the header's
  // primary action shipped as its own component precisely BECAUSE the three
  // files the ticket named were each within a line of their ceiling, and
  // context assembly moved out of the host for the same reason.
  { file: "ui/views/Dashboard/widgets/WidgetPrimaryAction.svelte", maxLines: 90 },
  { file: "ui/views/Dashboard/widgets/renderContext.ts", maxLines: 90 },
  // #194. Entered at their measured size, for the third time and the same
  // reason: the host was one line under its ceiling and the data-scope surface
  // needed about ten, so the content chain and the source selector each became
  // a component. `BUDGETS` covers `ui/views/Dashboard/**` by hand, so a new
  // component that is not listed here is a component with no ceiling at all.
  { file: "ui/views/Dashboard/widgets/WidgetContent.svelte", maxLines: 95 },
  { file: "ui/views/Dashboard/widgets/DataScopeField.svelte", maxLines: 85 },
  { file: "ui/views/Dashboard/widgets/DataScopePanel.svelte", maxLines: 60 },
  { file: "ui/views/Dashboard/widgets/dataScope.ts", maxLines: 75 },
  // Master-prompt invariant 1: canvas ≤200 (restored in compliance audit).
  // 200 → 195 (#191): the template controller, its confirm dialog and the
  // apply handler left with the mechanism. A ceiling that keeps the room a
  // deletion freed is not a ceiling.
  { file: "ui/views/Dashboard/DashboardCanvas.svelte", maxLines: 195 },
  { file: "ui/views/Dashboard/dashboardSuggest.ts", maxLines: 60 },
  // Wave 2 mechanisms enter at measured sizes, existing ceilings never rise.
  { file: "ui/views/Dashboard/dashboardReorder.ts", maxLines: 15 },
  { file: "ui/views/Dashboard/dashboardReveal.ts", maxLines: 19 },
  // i3-dash: the tile grid / jump bar / block «Properties» modules enter at
  // their measured sizes; DashboardCanvas paid for its two new lines inside
  // its own ceiling.
  { file: "ui/views/Dashboard/layout/tileGrid.ts", maxLines: 166 },
  { file: "ui/views/Dashboard/layout/tileResize.ts", maxLines: 47 },
  { file: "ui/views/Dashboard/layout/measureWidth.ts", maxLines: 34 },
  { file: "ui/views/Dashboard/layout/blockProperties.ts", maxLines: 53 },
  { file: "ui/views/Dashboard/layout/blockJump.ts", maxLines: 29 },
  // i3-close: «Insert block after» enters at its measured size.
  { file: "ui/views/Dashboard/layout/blockInsert.ts", maxLines: 40 },
  { file: "ui/views/Dashboard/widgets/Stats/statsDefaults.ts", maxLines: 18 },
  { file: "ui/views/Dashboard/widgets/Stats/statsSparkline.ts", maxLines: 35 },
  { file: "ui/views/Dashboard/widgets/Stats/StatsWidget.svelte", maxLines: 100 },
  { file: "ui/views/Dashboard/widgets/Stats/StatsCard.svelte", maxLines: 124 },
  { file: "ui/actions/fitVisibleViewport.ts", maxLines: 33 },
  { file: "ui/utils/visibleViewport.ts", maxLines: 11 },
  { file: "ui/views/Dashboard/widgets/Chart/chartAggregations.ts", maxLines: 18 },
  // Additional-series and agenda viewport fixes enter at their measured sizes.
  { file: "ui/views/Dashboard/widgets/Chart/ChartSeriesEditor.svelte", maxLines: 180 },
  { file: "ui/views/Calendar/agenda/fitAgendaOverlay.ts", maxLines: 21 },
  // F2 (#074) — TABLE_V2_CANON §5 budgets
  // 3.7.1 feedback: search/windowing and typed editing gained guards. Their
  // mechanisms are extracted, not paid for by raising component limits.
  { file: "ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte", maxLines: 277 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableControlBar.svelte", maxLines: 200 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableHeader.svelte", maxLines: 200 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte", maxLines: 200 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableFooter.svelte", maxLines: 120 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts", maxLines: 248 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/EditableCell.svelte", maxLines: 221 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TypedCellEditor.svelte", maxLines: 91 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/ListCellEditor.svelte", maxLines: 96 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableSearch.ts", maxLines: 68 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableSearchMatch.ts", maxLines: 13 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableInteractions.ts", maxLines: 51 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/editedCellValue.ts", maxLines: 13 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableWindow.ts", maxLines: 121 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/CellChoiceDropdown.svelte", maxLines: 130 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableNewRow.svelte", maxLines: 100 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableRowOps.ts", maxLines: 170 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableHeaderOps.ts", maxLines: 230 },
  { file: "ui/views/Dashboard/widgets/ViewTabBar.svelte", maxLines: 260 },
  // i3-final (B3/B4): linked-view tabs and the inherited field list enter at
  // their measured sizes; the tab bar paid for its two lines inside its ceiling.
  { file: "ui/views/Dashboard/widgets/DatabaseCall/linkedView.ts", maxLines: 117 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tabLinkMenu.ts", maxLines: 50 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/fieldLayout.ts", maxLines: 70 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableGroupSection.svelte", maxLines: 100 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte", maxLines: 240 },
  // B10: the calendar's day window moved onto FloatingPopup (1124 → 230 lines:
  // its private layer, Escape, focus, scroll lock and swipe are the engine's
  // now). Entered at its measured size so the room cannot grow back.
  { file: "ui/views/Calendar/components/DayPopup/DayPopup.svelte", maxLines: 230 },
];

describe("R0.6 component LOC budgets (#067)", () => {
  it.each(BUDGETS)("$file stays within $maxLines lines", ({ file, maxLines }) => {
    const content = fs.readFileSync(path.join(SRC, file), "utf8");
    const lines = content.split("\n").length;
    expect(lines).toBeLessThanOrEqual(maxLines);
  });
});
