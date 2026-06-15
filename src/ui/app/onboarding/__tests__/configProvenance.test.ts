/**
 * configProvenance.test.ts — UT2026-D P1 invariant (#072).
 *
 * Generators must emit the CURRENT config schema: running every relevant
 * migration over freshly generated output must be a no-op. The demo
 * project shipped stats cards with the pre-R5-004 literal
 * `aggregation: "count"` — migrations fix stored configs, but a generator
 * emitting a retired value re-creates the bug on every fresh install.
 */

import { demoGeneratedWidgets } from "../demoProject";
import { WIDGET_TEMPLATES } from "src/ui/views/Dashboard/widgetTemplates";
import { migrateAggregationCount } from "src/ui/views/Dashboard/migration";
import type { StatsCardConfig, WidgetDefinition } from "src/ui/views/Dashboard/types";

const LEGACY_TYPES: ReadonlyArray<string> = [
  "data-table", "summary-row", "comparison", "view-port",
  "data-list", "sub-base-canvas", "yaml-visualizer", "timeline",
];

describe("config provenance (UT2026-D, #072)", () => {
  it("demo widget generator output passes migrateAggregationCount as a no-op", () => {
    const widgets = demoGeneratedWidgets();
    const migrated = migrateAggregationCount(widgets);
    // The migration returns the ORIGINAL reference when nothing applies —
    // reference equality is the strongest possible "no-op" assertion.
    expect(migrated).toBe(widgets);
  });

  it("demo stats cards never use the retired kernel literal 'count'", () => {
    const cards = demoGeneratedWidgets()
      .filter((w) => w.type === "stats")
      .flatMap((w) => (w.config as { cards: StatsCardConfig[] }).cards);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.aggregation).not.toBe("count");
    }
  });

  it("demo chart yAxis aggregations are post-R5-004 values", () => {
    const charts = demoGeneratedWidgets().filter((w) => w.type === "chart");
    expect(charts.length).toBeGreaterThan(0);
    for (const chart of charts) {
      const yAxis = (chart.config as { yAxis?: { aggregation?: string } }).yAxis;
      expect(yAxis?.aggregation).not.toBe("count");
    }
  });

  // ── F3 (UT2026-A L3): templates are generators too ─────────────────

  function allTemplateWidgets(): WidgetDefinition[] {
    return WIDGET_TEMPLATES.flatMap((t) => t.widgets);
  }

  it("widget templates pass migrateAggregationCount as a no-op", () => {
    const widgets = allTemplateWidgets();
    expect(migrateAggregationCount(widgets)).toBe(widgets);
  });

  it("no generator emits retired legacy widget types", () => {
    const offenders = [...demoGeneratedWidgets(), ...allTemplateWidgets()]
      .filter((w) => LEGACY_TYPES.includes(w.type))
      .map((w) => `${w.type}:${w.title}`);
    expect(offenders).toEqual([]);
  });

  it("every generated database-call carries viewTabs (UT2026-G finding)", () => {
    const blocks = [...demoGeneratedWidgets(), ...allTemplateWidgets()]
      .filter((w) => w.type === "database-call");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const tabs = (block.config as { viewTabs?: unknown[] }).viewTabs;
      expect(Array.isArray(tabs) && tabs.length > 0).toBe(true);
    }
  });
});
