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
  { file: "ui/views/Dashboard/widgets/WidgetHost.svelte", maxLines: 230 },
  { file: "ui/views/Dashboard/widgets/hostFrames.ts", maxLines: 120 },
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
  // Master-prompt invariant 1: canvas ≤200 (restored in compliance audit).
  // 200 → 195 (#191): the template controller, its confirm dialog and the
  // apply handler left with the mechanism. A ceiling that keeps the room a
  // deletion freed is not a ceiling.
  { file: "ui/views/Dashboard/DashboardCanvas.svelte", maxLines: 195 },
  { file: "ui/views/Dashboard/dashboardSuggest.ts", maxLines: 60 },
  // F2 (#074) — TABLE_V2_CANON §5 budgets
  { file: "ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte", maxLines: 280 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableControlBar.svelte", maxLines: 200 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableHeader.svelte", maxLines: 200 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte", maxLines: 200 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableFooter.svelte", maxLines: 120 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts", maxLines: 260 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/EditableCell.svelte", maxLines: 250 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/CellChoiceDropdown.svelte", maxLines: 130 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableNewRow.svelte", maxLines: 100 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableRowOps.ts", maxLines: 170 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/tableHeaderOps.ts", maxLines: 230 },
  { file: "ui/views/Dashboard/widgets/ViewTabBar.svelte", maxLines: 260 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/TableGroupSection.svelte", maxLines: 100 },
  { file: "ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte", maxLines: 240 },
];

describe("R0.6 component LOC budgets (#067)", () => {
  it.each(BUDGETS)("$file stays within $maxLines lines", ({ file, maxLines }) => {
    const content = fs.readFileSync(path.join(SRC, file), "utf8");
    const lines = content.split("\n").length;
    expect(lines).toBeLessThanOrEqual(maxLines);
  });
});
