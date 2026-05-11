import { canAddWidget, WIDGET_REGISTRY } from "../widgets/widgetRegistry";
import type { WidgetType } from "../types";

describe("DashboardBlockPalette — canAddWidget guards", () => {
  test("empty widget list allows adding any unrestricted type", () => {
    expect(canAddWidget("chart", [])).toBe(true);
    expect(canAddWidget("data-table", [])).toBe(true);
    expect(canAddWidget("database-call", [])).toBe(true);
    expect(canAddWidget("timeline", [])).toBe(true);
  });

  test("filter-tabs maxCount=1: blocked once present", () => {
    const current: { type: WidgetType }[] = [{ type: "filter-tabs" }];
    expect(canAddWidget("filter-tabs", current)).toBe(false);
  });

  test("filter-tabs maxCount=1: allowed when absent", () => {
    expect(canAddWidget("filter-tabs", [])).toBe(true);
  });

  test("summary-row maxCount=1: blocked once present", () => {
    const current: { type: WidgetType }[] = [{ type: "summary-row" }];
    expect(canAddWidget("summary-row", current)).toBe(false);
  });

  test("database-call: allowed multiple times (no maxCount cap)", () => {
    const current: { type: WidgetType }[] = [
      { type: "database-call" },
      { type: "database-call" },
    ];
    expect(canAddWidget("database-call", current)).toBe(true);
  });

  test("unknown type returns false (palette must not show it)", () => {
    expect(canAddWidget("__unknown__" as WidgetType, [])).toBe(false);
  });

  test("all WIDGET_REGISTRY types are allowed on empty canvas (palette initial state)", () => {
    // Verifies TDT-02: empty canvas must be able to add any widget type.
    for (const meta of WIDGET_REGISTRY) {
      expect(canAddWidget(meta.type, [])).toBe(true);
    }
  });
});
