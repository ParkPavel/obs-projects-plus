import {
  WIDGET_REGISTRY,
  getWidgetMeta,
  canAddWidget,
} from "../widgets/widgetRegistry";

describe("widgetRegistry", () => {
  describe("WIDGET_REGISTRY", () => {
    test("has 8 widget types", () => {
      expect(WIDGET_REGISTRY).toHaveLength(8);
    });

    test("all entries have required fields", () => {
      for (const meta of WIDGET_REGISTRY) {
        expect(meta.type).toBeTruthy();
        expect(meta.label).toBeTruthy();
        expect(meta.icon).toBeTruthy();
        expect(meta.defaultLayout).toBeDefined();
        expect(meta.minW).toBeGreaterThan(0);
        expect(meta.minH).toBeGreaterThan(0);
      }
    });

    test("types are unique", () => {
      const types = WIDGET_REGISTRY.map((m) => m.type);
      expect(new Set(types).size).toBe(types.length);
    });
  });

  describe("getWidgetMeta", () => {
    test("returns meta for known type", () => {
      const meta = getWidgetMeta("data-table");
      expect(meta).toBeDefined();
      expect(meta!.type).toBe("data-table");
      expect(meta!.label).toBe("Data Table");
    });

    test("returns undefined for unknown type", () => {
      expect(getWidgetMeta("does-not-exist" as any)).toBeUndefined();
    });
  });

  describe("canAddWidget", () => {
    test("allows adding widget with no maxCount", () => {
      expect(canAddWidget("chart", [])).toBe(true);
    });

    test("allows adding chart when others exist", () => {
      const current = [{ type: "chart" as const }, { type: "stats" as const }];
      expect(canAddWidget("chart", current)).toBe(true);
    });

    test("prevents exceeding maxCount for data-table", () => {
      const current = [{ type: "data-table" as const }];
      expect(canAddWidget("data-table", current)).toBe(false);
    });

    test("allows data-table when none exist", () => {
      expect(canAddWidget("data-table", [])).toBe(true);
    });

    test("view-port maxCount is 4", () => {
      const current = Array.from({ length: 4 }, () => ({
        type: "view-port" as const,
      }));
      expect(canAddWidget("view-port", current)).toBe(false);
      expect(canAddWidget("view-port", current.slice(0, 3))).toBe(true);
    });

    test("returns false for unknown type", () => {
      expect(canAddWidget("unknown-type" as any, [])).toBe(false);
    });

    test("filter-tabs maxCount is 1", () => {
      const current = [{ type: "filter-tabs" as const }];
      expect(canAddWidget("filter-tabs", current)).toBe(false);
      expect(canAddWidget("filter-tabs", [])).toBe(true);
    });

    test("summary-row maxCount is 1", () => {
      const current = [{ type: "summary-row" as const }];
      expect(canAddWidget("summary-row", current)).toBe(false);
      expect(canAddWidget("summary-row", [])).toBe(true);
    });
  });
});
