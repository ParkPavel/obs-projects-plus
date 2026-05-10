import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import {
  configPanelRegistry,
  getConfigPanel,
} from "../widgets/configPanelRegistry";
import { WIDGET_REGISTRY } from "../widgets/widgetRegistry";
import type { WidgetType } from "../types";

const mkFields = (): DataField[] => [
  { name: "status", type: DataFieldType.String, repeated: false, derived: false, identifier: false },
  { name: "estimate", type: DataFieldType.Number, repeated: false, derived: false, identifier: false },
  { name: "completed", type: DataFieldType.Boolean, repeated: false, derived: false, identifier: false },
];

describe("configPanelRegistry (Phase 2a)", () => {
  test("covers every WidgetType from WIDGET_REGISTRY", () => {
    for (const meta of WIDGET_REGISTRY) {
      expect(configPanelRegistry[meta.type]).toBeDefined();
    }
  });

  test("getConfigPanel returns the same object as direct lookup", () => {
    const all: WidgetType[] = [
      "data-table",
      "chart",
      "stats",
      "comparison",
      "checklist",
      "view-port",
      "filter-tabs",
      "summary-row",
      "data-list",
      "sub-base-canvas",
      "yaml-visualizer",
      "database-call",
      "timeline",
      "cover-banner",
      "text",
      "divider",
    ];
    for (const t of all) {
      expect(getConfigPanel(t)).toBe(configPanelRegistry[t]);
    }
  });

  test("data-table has no cog (right-click menu owns its settings)", () => {
    expect(configPanelRegistry["data-table"].hasCog).toBe(false);
  });

  test("yaml-visualizer has no cog (owns its own toolbar)", () => {
    expect(configPanelRegistry["yaml-visualizer"].hasCog).toBe(false);
  });

  test("every other widget has cog (INTERFACE RECLAMATION)", () => {
    const noCog = new Set<WidgetType>(["data-table", "yaml-visualizer", "database-call", "text", "divider"]);
    for (const meta of WIDGET_REGISTRY) {
      if (noCog.has(meta.type)) continue;
      expect(configPanelRegistry[meta.type].hasCog).toBe(true);
    }
  });

  describe("isConfigured", () => {
    test("chart: empty config is unconfigured", () => {
      expect(configPanelRegistry.chart.isConfigured({})).toBe(false);
    });
    test("chart: config with chartType+xAxis is configured", () => {
      expect(
        configPanelRegistry.chart.isConfigured({
          chartType: "bar",
          xAxis: { property: "x" },
        })
      ).toBe(true);
    });
    test("stats: config with cards array is configured", () => {
      expect(configPanelRegistry.stats.isConfigured({ cards: [] })).toBe(true);
    });
    test("view-port: config without viewId is unconfigured", () => {
      expect(configPanelRegistry["view-port"].isConfigured({})).toBe(false);
      expect(
        configPanelRegistry["view-port"].isConfigured({ viewId: "board" })
      ).toBe(true);
    });
    test("comparison/filter-tabs/checklist/summary-row: non-empty is configured", () => {
      expect(configPanelRegistry.comparison.isConfigured({ metrics: [] })).toBe(
        true
      );
      expect(configPanelRegistry["filter-tabs"].isConfigured({ field: "x" }))
        .toBe(true);
      expect(configPanelRegistry.checklist.isConfigured({ field: "done" }))
        .toBe(true);
      expect(
        configPanelRegistry["summary-row"].isConfigured({ columns: [] })
      ).toBe(true);
    });
  });

  describe("initDefaults", () => {
    test("chart: seeds xAxis.property from first field", () => {
      const defaults = configPanelRegistry.chart.initDefaults(mkFields());
      const cfg = defaults as { xAxis: { property: string } };
      expect(cfg.xAxis.property).toBe("status");
    });
    test("stats: returns empty cards + columns=2", () => {
      const defaults = configPanelRegistry.stats.initDefaults(mkFields());
      expect(defaults).toEqual({ cards: [], columns: 2 });
    });
    test("comparison: picks first numeric field", () => {
      const defaults = configPanelRegistry.comparison.initDefaults(mkFields());
      const cfg = defaults as { metrics: { field: string }[] };
      expect(cfg.metrics[0]?.field).toBe("estimate");
    });
    test("checklist: picks first boolean field", () => {
      const defaults = configPanelRegistry.checklist.initDefaults(mkFields());
      const cfg = defaults as { field: string };
      expect(cfg.field).toBe("completed");
    });
    test("checklist: falls back to 'completed' when no boolean present", () => {
      const defaults = configPanelRegistry.checklist.initDefaults([]);
      const cfg = defaults as { field: string };
      expect(cfg.field).toBe("completed");
    });
    test("view-port: empty viewId, headerVisible=true", () => {
      const defaults = configPanelRegistry["view-port"].initDefaults([]);
      expect(defaults).toEqual({
        viewId: "",
        viewLabel: "",
        headerVisible: true,
      });
    });
    test("filter-tabs: seeds field from first entry", () => {
      const defaults = configPanelRegistry["filter-tabs"].initDefaults(
        mkFields()
      );
      const cfg = defaults as { field: string };
      expect(cfg.field).toBe("status");
    });
    test("summary-row: seeds a count column on the first field", () => {
      const defaults = configPanelRegistry["summary-row"].initDefaults(
        mkFields()
      );
      const cfg = defaults as {
        columns: { field: string; aggregation: string; format: string }[];
      };
      expect(cfg.columns[0]?.field).toBe("status");
      expect(cfg.columns[0]?.aggregation).toBe("count_total");
    });
    test("data-table initDefaults returns empty object", () => {
      expect(configPanelRegistry["data-table"].initDefaults([])).toEqual({});
    });
  });
});
