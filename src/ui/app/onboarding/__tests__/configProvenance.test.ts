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
import { migrateAggregationCount } from "src/ui/views/Dashboard/migration";
import type { StatsCardConfig } from "src/ui/views/Dashboard/types";

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
});
