/**
 * WidgetInlineBadges.test.ts — verifies inline header badges render the
 * correct text and data-testid for stats / chart / data-table widgets.
 *
 * Spec: orchestrator Phase 4 sub-PR 3 (#034.3 / #040.2).
 */

import "@testing-library/jest-dom";

// Echo key and options: interpolated values stay observable, and an English
// literal can no longer pass as a translation.
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: Record<string, unknown>) =>
        options ? `${key}|${JSON.stringify(options)}` : key,
    }),
  };
});

import { DataFieldType } from "src/lib/dataframe/dataframe";
// Type aliases, not `import type`: a file with jest.mock() goes through babel,
// which cannot strip an imported binding used only in annotations.
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
type ChartConfig = import("src/ui/views/Dashboard/types").ChartConfig;
type DataTableConfig = import("src/ui/views/Dashboard/types").DataTableConfig;
type StatsConfig = import("src/ui/views/Dashboard/types").StatsConfig;
type WidgetDefinition = import("src/ui/views/Dashboard/types").WidgetDefinition;

const WidgetInlineBadges =
  require("../WidgetInlineBadges.svelte").default;

function makeFrame(fieldCount: number): DataFrame {
  return {
    fields: Array.from({ length: fieldCount }, (_, i) => ({
      name: `f${i}`,
      type: DataFieldType.String,
      repeated: false,
      identifier: false,
      derived: false,
    })),
    records: [],
  };
}

function makeWidget(
  type: WidgetDefinition["type"],
  config: Record<string, unknown> = {}
): WidgetDefinition {
  return {
    id: "w1",
    type,
    title: "T",
    layout: { x: 0, y: 0, w: 4, h: 3 },
    config,
  };
}

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new WidgetInlineBadges({ target, props });
  return {
    component,
    target,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("WidgetInlineBadges", () => {
  it("stats single-card: renders aggregation label badge", () => {
    const statsCfg: StatsConfig = {
      cards: [
        {
          id: "c1",
          label: "Total",
          field: "amount",
          aggregation: "sum",
        },
      ],
      columns: 3,
    };
    const handle = mount({
      widget: makeWidget("stats", statsCfg as unknown as Record<string, unknown>),
      frame: makeFrame(3),
    });
    const badge = handle.target.querySelector<HTMLElement>(
      "[data-testid='widget-badge-stats-agg']"
    );
    expect(badge).not.toBeNull();
    expect(badge!.textContent?.trim()).toBe("SUM");
    expect(
      handle.target.querySelector("[data-testid='widget-badge-stats-count']")
    ).toBeNull();
    handle.destroy();
  });

  it("stats multi-card: renders card-count badge instead of aggregation", () => {
    const statsCfg: StatsConfig = {
      cards: [
        { id: "a", label: "A", field: "x", aggregation: "sum" },
        { id: "b", label: "B", field: "x", aggregation: "avg" },
        { id: "c", label: "C", field: "x", aggregation: "min" },
      ],
      columns: 3,
    };
    const handle = mount({
      widget: makeWidget("stats", statsCfg as unknown as Record<string, unknown>),
      frame: makeFrame(2),
    });
    const badge = handle.target.querySelector<HTMLElement>(
      "[data-testid='widget-badge-stats-count']"
    );
    expect(badge).not.toBeNull();
    expect(badge!.textContent?.trim()).toBe('views.dashboard.widget.badge.card-count|{"count":3}');
    expect(badge!.getAttribute("title")).toBe("views.dashboard.widget.badge.card-count-title");
    handle.destroy();
  });

  it("chart: renders chart-type + Y-axis aggregation badges", () => {
    const chartCfg: ChartConfig = {
      chartType: "bar",
      xAxis: {
        property: "month",
        sortBy: "value",
        sortOrder: "asc",
        omitZero: false,
      },
      yAxis: {
        property: "amount",
        aggregation: "avg",
      },
      style: {
        colorScheme: "auto",
        height: "medium",
        showGrid: true,
        showLabels: true,
        showLegend: false,
        showValues: false,
      },
    };
    const handle = mount({
      widget: makeWidget("chart", chartCfg as unknown as Record<string, unknown>),
      frame: makeFrame(4),
    });
    const typeBadge = handle.target.querySelector<HTMLElement>(
      "[data-testid='widget-badge-chart-type']"
    );
    const aggBadge = handle.target.querySelector<HTMLElement>(
      "[data-testid='widget-badge-chart-agg']"
    );
    expect(typeBadge).not.toBeNull();
    expect(typeBadge!.textContent?.trim()).toBe('views.dashboard.chart.types.bar|{"defaultValue":"bar"}');
    expect(typeBadge!.getAttribute("title")).toBe("views.dashboard.chart.type");
    expect(aggBadge).not.toBeNull();
    expect(aggBadge!.getAttribute("title")).toBe("views.dashboard.widget.badge.y-aggregation");
    expect(aggBadge!.textContent?.trim()).toBe("AVG");
    handle.destroy();
  });

  it("chart with aggregation=none: omits agg badge but keeps type badge", () => {
    const chartCfg: ChartConfig = {
      chartType: "line",
      xAxis: {
        property: "date",
        sortBy: "value",
        sortOrder: "asc",
        omitZero: false,
      },
      yAxis: { property: "count", aggregation: "none" },
      style: {
        colorScheme: "auto",
        height: "small",
        showGrid: false,
        showLabels: false,
        showLegend: false,
        showValues: false,
      },
    };
    const handle = mount({
      widget: makeWidget("chart", chartCfg as unknown as Record<string, unknown>),
      frame: makeFrame(2),
    });
    expect(
      handle.target.querySelector("[data-testid='widget-badge-chart-type']")
    ).not.toBeNull();
    expect(
      handle.target.querySelector("[data-testid='widget-badge-chart-agg']")
    ).toBeNull();
    handle.destroy();
  });

  it("data-table: renders column-count badge from frame.fields", () => {
    const handle = mount({
      widget: makeWidget("data-table"),
      frame: makeFrame(7),
    });
    const colsBadge = handle.target.querySelector<HTMLElement>(
      "[data-testid='widget-badge-table-cols']"
    );
    expect(colsBadge).not.toBeNull();
    expect(colsBadge!.textContent?.trim()).toBe('views.dashboard.widget.badge.column-count|{"count":7}');
    expect(colsBadge!.getAttribute("title")).toBe("views.dashboard.widget.badge.column-count-title");
    expect(
      handle.target.querySelector("[data-testid='widget-badge-table-grouped']")
    ).toBeNull();
    handle.destroy();
  });

  it("data-table grouped: renders both column-count + grouped badge", () => {
    const tableCfg: DataTableConfig = {
      groupBy: {
        field: "status",
        sortOrder: "asc",
        hiddenGroups: [],
        collapsedGroups: [],
        showEmptyGroups: false,
      },
    };
    const handle = mount({
      widget: makeWidget("data-table"),
      frame: makeFrame(5),
      tableConfig: tableCfg,
    });
    expect(
      handle.target.querySelector("[data-testid='widget-badge-table-cols']")
    ).not.toBeNull();
    const groupBadge = handle.target.querySelector<HTMLElement>(
      "[data-testid='widget-badge-table-grouped']"
    );
    expect(groupBadge).not.toBeNull();
    expect(groupBadge!.textContent?.trim()).toBe("views.dashboard.widget.badge.grouped");
    expect(groupBadge!.getAttribute("title")).toBe('views.dashboard.widget.badge.grouped-title|{"field":"status"}');
    handle.destroy();
  });

  it("data-table: the config passed by the host wins over a stale nested copy", () => {
    const handle = mount({
      widget: makeWidget("data-table", {
        table: { groupBy: { field: "stale", sortOrder: "asc", hiddenGroups: [], collapsedGroups: [], showEmptyGroups: false } },
      }),
      frame: makeFrame(2),
      tableConfig: {},
    });
    expect(handle.target.querySelector("[data-testid='widget-badge-table-grouped']")).toBeNull();
    handle.destroy();
  });

  it("an unknown chart type falls back to its own name, not a raw key", () => {
    const handle = mount({ widget: makeWidget("chart", { chartType: "radar", xAxis: {}, yAxis: { property: "y", aggregation: "none" }, style: {} }), frame: makeFrame(1) });
    const typeBadge = handle.target.querySelector("[data-testid='widget-badge-chart-type']");
    expect(typeBadge!.textContent).toContain('"defaultValue":"radar"');
    handle.destroy();
  });

  it("non-badge widget types render nothing", () => {
    const handle = mount({
      widget: makeWidget("text"),
      frame: makeFrame(0),
    });
    expect(handle.target.querySelectorAll(".ppp-widget-badge").length).toBe(0);
    handle.destroy();
  });
});
