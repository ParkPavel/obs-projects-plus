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
  { file: "ui/views/Dashboard/widgets/WidgetHost.svelte", maxLines: 230 },
  { file: "ui/views/Dashboard/widgets/WidgetShell.svelte", maxLines: 350 },
  { file: "ui/views/Dashboard/widgets/WidgetHeaderActions.svelte", maxLines: 175 },
  { file: "ui/views/Dashboard/widgets/WidgetSetupWizard.svelte", maxLines: 80 },
  { file: "ui/views/Dashboard/widgets/widgetComponentRegistry.ts", maxLines: 260 },
  { file: "ui/views/Dashboard/DashboardCanvas.svelte", maxLines: 230 },
];

describe("R0.6 component LOC budgets (#067)", () => {
  it.each(BUDGETS)("$file stays within $maxLines lines", ({ file, maxLines }) => {
    const content = fs.readFileSync(path.join(SRC, file), "utf8");
    const lines = content.split("\n").length;
    expect(lines).toBeLessThanOrEqual(maxLines);
  });
});
