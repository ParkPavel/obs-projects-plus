/**
 * A new table tab is named in the user's language.
 *
 * The tab label is data: it is written when the block is created and shown
 * until the user renames it. It was always the English "Table" — for a new
 * database-call block, for a converted legacy data-table, and in the Russian
 * demo project — so a Russian, Ukrainian or Chinese user met an English tab
 * in the middle of their own interface.
 */

import { tableTabConfig } from "../legacyMigration";
import { getConfigPanel } from "../configPanelRegistry";
import { demoGeneratedWidgets } from "src/ui/app/onboarding/demoProject";

// The jest i18n mock returns the key, so a translated label is the key itself.
const TABLE_KEY = "views.dashboard.database-call.view-type.table";

type Tabs = { viewTabs: Array<{ label: string }> };

describe("table tab label", () => {
  test("a converted or new tab is labelled through the locale layer", () => {
    expect((tableTabConfig() as unknown as Tabs).viewTabs[0]?.label).toBe(TABLE_KEY);
  });

  test("a caller writing for a known locale still passes its own label", () => {
    expect((tableTabConfig({}, "Таблица") as unknown as Tabs).viewTabs[0]?.label).toBe("Таблица");
  });

  test("a database-call block created from the palette gets the translated label", () => {
    const defaults = getConfigPanel("database-call").initDefaults([]) as unknown as Tabs;
    expect(defaults.viewTabs[0]?.label).toBe(TABLE_KEY);
  });

  test("the Russian demo project names its table tabs in Russian", () => {
    const labels = demoGeneratedWidgets()
      .flatMap((w) => ((w.config as Partial<Tabs>).viewTabs ?? []).map((tab) => tab.label));
    expect(labels.length).toBeGreaterThan(3);
    expect(labels.filter((label) => label !== "Таблица")).toEqual([]);
  });
});
