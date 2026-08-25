import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import {
  configPanelRegistry,
  getConfigPanel,
} from "../widgets/configPanelRegistry";
import { WIDGET_REGISTRY } from "../widgets/widgetRegistry";
import { isRetiredLegacyType } from "../widgets/legacyMigration";
import type { WidgetType } from "../types";

const mkFields = (): DataField[] => [
  { name: "status", type: DataFieldType.String, repeated: false, derived: false, identifier: false },
  { name: "estimate", type: DataFieldType.Number, repeated: false, derived: false, identifier: false },
  { name: "completed", type: DataFieldType.Boolean, repeated: false, derived: false, identifier: false },
];

// #120: the registry is deliberately partial — retired types own no panel and
// resolve through the fallback. `getConfigPanel` is the total contract, so the
// tests read through it rather than indexing the table.
const panel = (type: WidgetType) => getConfigPanel(type);

describe("configPanelRegistry (Phase 2a)", () => {
  test("every live WidgetType in WIDGET_REGISTRY has its own entry", () => {
    for (const meta of WIDGET_REGISTRY) {
      if (isRetiredLegacyType(meta.type)) continue;
      expect(configPanelRegistry[meta.type]).toBeDefined();
    }
  });

  test("getConfigPanel returns the same object as direct lookup for live types", () => {
    const live: WidgetType[] = [
      "data-table",
      "chart",
      "stats",
      "checklist",
      "filter-tabs",
      "database-call",
      "cover-banner",
      "text",
      "divider",
    ];
    for (const t of live) {
      expect(getConfigPanel(t)).toBe(configPanelRegistry[t]);
    }
  });

  describe("#120 — retired types resolve to the no-panel fallback", () => {
    const retired: WidgetType[] = [
      "comparison",
      "view-port",
      "summary-row",
      "data-list",
      "sub-base-canvas",
      "yaml-visualizer",
      "timeline",
    ];

    test("no retired type carries a registry entry any more", () => {
      for (const t of retired) {
        expect(configPanelRegistry[t]).toBeUndefined();
      }
    });

    test("getConfigPanel stays total — a retired type never yields undefined", () => {
      for (const t of retired) {
        const descriptor = getConfigPanel(t);
        expect(descriptor).toBeDefined();
        // WidgetHost dereferences .hasCog unconditionally; undefined would crash it.
        expect(descriptor.hasCog).toBe(false);
        expect(descriptor.isConfigured({})).toBe(true);
        expect(descriptor.initDefaults(mkFields())).toEqual({});
      }
    });

    test("every retired type is still rendered by WIDGET_REGISTRY (placeholder needs its label)", () => {
      for (const t of retired) {
        expect(WIDGET_REGISTRY.some((m) => m.type === t)).toBe(true);
      }
    });

    test("the fallback is shared, not rebuilt per call", () => {
      expect(getConfigPanel("timeline")).toBe(getConfigPanel("comparison"));
    });
  });

  test("data-table has no cog (right-click menu owns its settings)", () => {
    expect(panel("data-table").hasCog).toBe(false);
  });

  test("yaml-visualizer has no cog (retired; owns its own toolbar)", () => {
    expect(panel("yaml-visualizer").hasCog).toBe(false);
  });

  test("database-call has cog (NPLAN-V7.1: source picker panel)", () => {
    expect(panel("database-call").hasCog).toBe(true);
  });

  test("every other live widget has cog (INTERFACE RECLAMATION)", () => {
    const noCog = new Set<WidgetType>(["data-table", "text", "divider"]);
    for (const meta of WIDGET_REGISTRY) {
      if (noCog.has(meta.type) || isRetiredLegacyType(meta.type)) continue;
      expect(panel(meta.type).hasCog).toBe(true);
    }
  });

  describe("isConfigured", () => {
    test("chart: empty config is unconfigured", () => {
      expect(panel("chart").isConfigured({})).toBe(false);
    });
    test("chart: config with chartType+xAxis is configured", () => {
      expect(
        panel("chart").isConfigured({
          chartType: "bar",
          xAxis: { property: "x" },
        })
      ).toBe(true);
    });
    test("stats: config with cards array is configured", () => {
      expect(panel("stats").isConfigured({ cards: [] })).toBe(true);
    });
    test("filter-tabs/checklist: non-empty is configured", () => {
      expect(panel("filter-tabs").isConfigured({ field: "x" })).toBe(true);
      expect(panel("checklist").isConfigured({ field: "done" })).toBe(true);
    });
  });

  describe("initDefaults", () => {
    test("chart: seeds xAxis.property from first field", () => {
      const defaults = panel("chart").initDefaults(mkFields());
      const cfg = defaults as { xAxis: { property: string } };
      expect(cfg.xAxis.property).toBe("status");
    });
    test("stats: returns empty cards + columns=2", () => {
      const defaults = panel("stats").initDefaults(mkFields());
      expect(defaults).toEqual({ cards: [], columns: 2 });
    });
    test("checklist: picks first boolean field", () => {
      const defaults = panel("checklist").initDefaults(mkFields());
      const cfg = defaults as { field: string };
      expect(cfg.field).toBe("completed");
    });
    test("checklist: falls back to 'completed' when no boolean present", () => {
      const defaults = panel("checklist").initDefaults([]);
      const cfg = defaults as { field: string };
      expect(cfg.field).toBe("completed");
    });
    test("filter-tabs: seeds field from first entry", () => {
      const defaults = panel("filter-tabs").initDefaults(mkFields());
      const cfg = defaults as { field: string };
      expect(cfg.field).toBe("status");
    });
    test("data-table initDefaults returns empty object", () => {
      expect(panel("data-table").initDefaults([])).toEqual({});
    });
  });
});
