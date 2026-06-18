import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * R0.3 — CSS px-budget ratchet
 *
 * Revision 3 §2.1 mandates "ИСКЛЮЧИТЕЛЬНО относительные единицы". Mass
 * conversion of legacy px values is scheduled for R0.3b (file-by-file).
 * In the meantime this test guards a NUMERIC RATCHET: the current count
 * of `<digits>px` occurrences across `src/**\/*.{svelte,css}` is captured
 * here as a budget; any change that grows the count fails the build.
 *
 * To DECREASE the budget after a real conversion, lower the constant.
 * NEVER raise it without an explicit approval recorded in CHANGELOG.
 *
 * Allowed-by-spec exceptions (counted but not flagged at the linter level):
 * - `1px`: hairline borders / dividers (Obsidian-native idiom).
 * - `0px`: no-op offsets (rare).
 * Both are part of the budget so even decorative growth is caught.
 */

const SRC_ROOT = join(__dirname, "..");
const PX_RE = /\b\d+(?:\.\d+)?px\b/g;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "__mocks__") continue;
      yield* walk(full);
    } else if (entry.endsWith(".svelte") || entry.endsWith(".css")) {
      yield full;
    }
  }
}

function countPxAcrossSrc(): { total: number; perFile: Map<string, number> } {
  const perFile = new Map<string, number>();
  let total = 0;
  for (const file of walk(SRC_ROOT)) {
    const text = readFileSync(file, "utf8");
    const matches = text.match(PX_RE);
    if (matches && matches.length > 0) {
      perFile.set(file, matches.length);
      total += matches.length;
    }
  }
  return { total, perFile };
}

describe("R0.3 — CSS px-budget ratchet", () => {
  // Captured 2026-05-01 (Revision 3 baseline). Decrease only after real
  // conversion to relative units; never increase without CHANGELOG entry.
  // Bumps log:
  //   783 → 784 (R1.1 — VisualizerPane border-bottom 1px hairline).
  //   784 → 785 (R1.2 — VisualizerPane toolbar button 1px border).
  //   785 → 786 (R1.4 — VisualizerPane color-swatch 1px border).
  //   786 → 787 (R2.4 — VisualizerPane linked-from section 1px border-top).
  //   787 → 788 (R2.6 — VisualizerPane edit-input 1px border).
  //   788 → 791 (R2.2 — SubBaseTabs: bottom hairline + active inset shadow + edit-input border).
  //   791 → 792 (R3.1 — FormulaEditor shell textarea 1px border).
  //   792 → 793 (R-bug3 — GridCell focus-visible inset 2px ring for keyboard nav).
  //   793 → 794 (PARITY-001 — VisualizerPane link text-underline-offset 2px).
  //   794 → 715 (REFACTOR-404a — design-tokens.css + tokens.css comment-px scrub: pure documentation cleanup, zero behavioral change).
  //   715 → 640 (REFACTOR-404b — ColorFiltersTab + SortTab CSS migrated to rem under matryoshka principle; hairline 1px borders and accent 2px borders preserved per spec).
  //   640 → 432 (REFACTOR-404c — bulk pass: ViewToolbar/YearHeatmap/MultiDayEventStrip/FieldControl real conversion + var() radius/shadow fallbacks, box-shadow drop-shadow patterns, outline focus-rings 2px→0.125rem across 28 component files; comment scrub on DayPopup/InfiniteHorizontalCalendar/Day/AllDayEventStrip).
  //   432 → 355 (REFACTOR-404d — TimelineView/AgendaListEditor/CalendarView/ColorItem manual sweeps + extended bulk-pass: var(--radius-{s,m,l,xl}, Npx) extra fallbacks, var(--font-ui-smaller, 12px), var(--ppp-border-width-thick, 2px), var(--ppp-radius-full, 999px) and 9999px tokenized, text-underline-offset, comment scrub on // line comments, design-tokens shadow scale).
  //   355 → 332 (REFACTOR-404e — FilterGroupEditor 3px border-left, DatetimeInput/DateFormatSelector/AccordionItem spacing, BoardColumn 2px accent borders, CardList borderRadius+gap+margin, InfiniteHorizontalCalendar 2px axis borders, SettingsMenuPopover translateY(-4px), GridCell error border 2px, AgendaFilterEditor gap/padding, ColorFiltersTab swatch border 2px).
  //   332 → 301 (REFACTOR-404f — Onboarding/TabContainer/CardMetadata/Field/FileListInput/HorizontalGroup/DateInput/CreateProject/Inspector/ColumnHeader spacing; ErrorBoundary/ImagePreview layout dimensions; EventList/ColorPill/Day borderRadius; SubBaseTabs/TableView/ViewsTab/SettingsMenuTabs inset box-shadow+translateY+outline-offset; CurrentTimeLine glow shadow; TimelineView ghost border-left; token files keep 1px/2px/9999px as canonical definitions).
  //   301 → 191 (REFACTOR-403b — DateFormulaInput/FilterRow/AdvancedFilterEditor: bulk px→rem conversion of inline JS-built style strings + CSS style blocks; 1px hairlines preserved; UTF-8 BOM + Cyrillic comments verified intact).
  //   191 → 187 (TDT-12 — WidgetHost.svelte: 4 × border/border-bottom 1px solid → 0.0625rem solid).
  //   187 → 186 (#034.2a — net px reduction during popoverDropdown→FloatingPopup migration: archived popoverDropdown.ts (legacy .ts file did not count); new PopoverList.svelte uses 0.0625rem hairlines).
  //   186 → 177 (#077 slice 4 — DateFormulaInput retired its imperative inline-style portal (px borders/box-shadow/badge radii); now a thin FormulaConstructor wrapper with rem-only cell overrides).
  const PX_BUDGET = 177;

  it("does not exceed the agreed px-budget", () => {
    const { total, perFile } = countPxAcrossSrc();
    if (total > PX_BUDGET) {
      const top = [...perFile.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([f, c]) => `  ${c.toString().padStart(4)}  ${f}`)
        .join("\n");
      throw new Error(
        `px-budget exceeded: ${total} > ${PX_BUDGET}\nTop offenders:\n${top}\n\n` +
          `If this is the result of a deliberate conversion that REDUCES the count, ` +
          `lower PX_BUDGET in this test. If it is new px, please convert to rem/em/%.`,
      );
    }
    expect(total).toBeLessThanOrEqual(PX_BUDGET);
  });
});
