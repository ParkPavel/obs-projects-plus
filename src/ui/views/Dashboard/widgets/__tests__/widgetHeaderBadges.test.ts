/**
 * d13 — inline badges are mounted in the widget header (`badges` slot of
 * WidgetShell, filled by WidgetHost) and their texts come from i18n.
 */

import "@testing-library/jest-dom";
import * as fs from "fs";
import * as path from "path";

import { DataFieldType } from "src/lib/dataframe/dataframe";
// Type aliases, not `import type`: babel (jest.mock) cannot strip them.
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
type WidgetDefinition = import("../../types").WidgetDefinition;

// Echo key and options so interpolated values stay observable and no English
// literal can pass as a translation.
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: Record<string, unknown>) =>
        options ? `${key}|${JSON.stringify(options)}` : key,
    }),
  };
});

const Harness = require("./HeaderBadgesHarness.svelte").default;

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

function makeWidget(type: WidgetDefinition["type"], config: unknown = {}): WidgetDefinition {
  return {
    id: "w1",
    type,
    title: "T",
    layout: { x: 0, y: 0, w: 4, h: 3 },
    config,
  } as WidgetDefinition;
}

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new Harness({ target, props });
  return {
    header: target.querySelector(".ppp-widget-header") as HTMLElement,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

const chartConfig = (aggregation: string) => ({
  chartType: "bar",
  xAxis: { property: "m", sortBy: "value", sortOrder: "asc", omitZero: false },
  yAxis: { property: "amount", aggregation },
  style: {},
});

// With the echoing i18n mock a translated string is its key (plus options);
// the aggregation codes come from the translated vocabulary (agg-badge).
const TRANSLATED = /^views\.dashboard\.(widget\.badge|chart\.type|agg-badge)[\w.-]*(\|\{.*\})?$/;

function visibleStrings(header: HTMLElement): string[] {
  return Array.from(header.querySelectorAll(".ppp-widget-badge")).flatMap((el) => [
    el.textContent ?? "",
    el.getAttribute("title") ?? "",
  ]);
}

function expectNoEnglishLiterals(header: HTMLElement) {
  for (const s of visibleStrings(header).map((v) => v.trim()).filter(Boolean)) {
    expect(s).toMatch(TRANSLATED);
  }
}

describe("d13 — header badges", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("chart: type and Y aggregation badges are in the header", () => {
    const h = mount({ widget: makeWidget("chart", chartConfig("avg")), frame: makeFrame(2) });
    expect(h.header.querySelector("[data-testid='widget-badge-chart-type']")).not.toBeNull();
    expect(h.header.querySelector("[data-testid='widget-badge-chart-agg']")).not.toBeNull();
    expectNoEnglishLiterals(h.header);
    h.destroy();
  });

  it("chart with aggregation none: only the type badge", () => {
    const h = mount({ widget: makeWidget("chart", chartConfig("none")), frame: makeFrame(2) });
    expect(h.header.querySelector("[data-testid='widget-badge-chart-type']")).not.toBeNull();
    expect(h.header.querySelector("[data-testid='widget-badge-chart-agg']")).toBeNull();
    h.destroy();
  });

  it("stats: one card shows the aggregation, several show a localized count", () => {
    const card = (id: string) => ({ id, label: id, field: "x", aggregation: "sum" });
    const one = mount({
      widget: makeWidget("stats", { cards: [card("a")], columns: 3 }),
      frame: makeFrame(1),
    });
    expect(one.header.querySelector("[data-testid='widget-badge-stats-agg']")).not.toBeNull();
    expectNoEnglishLiterals(one.header);
    one.destroy();

    const many = mount({
      widget: makeWidget("stats", { cards: [card("a"), card("b"), card("c")], columns: 3 }),
      frame: makeFrame(1),
    });
    const count = many.header.querySelector<HTMLElement>("[data-testid='widget-badge-stats-count']");
    expect(count).not.toBeNull();
    expect(count!.textContent?.trim()).toBe('views.dashboard.widget.badge.card-count|{"count":3}');
    expectNoEnglishLiterals(many.header);
    many.destroy();
  });

  it("data-table: column count and grouping badges, localized", () => {
    const h = mount({
      widget: makeWidget("data-table"),
      frame: makeFrame(7),
      tableConfig: {
        groupBy: {
          field: "status",
          sortOrder: "asc",
          hiddenGroups: [],
          collapsedGroups: [],
          showEmptyGroups: false,
        },
      },
    });
    const cols = h.header.querySelector<HTMLElement>("[data-testid='widget-badge-table-cols']");
    const grouped = h.header.querySelector<HTMLElement>("[data-testid='widget-badge-table-grouped']");
    expect(cols).not.toBeNull();
    expect(cols!.textContent?.trim()).toBe('views.dashboard.widget.badge.column-count|{"count":7}');
    expect(grouped).not.toBeNull();
    expect(grouped!.getAttribute("title")).toContain("status");
    expectNoEnglishLiterals(h.header);
    h.destroy();
  });

  it("other widget types render no badge", () => {
    for (const type of ["text", "divider"] as WidgetDefinition["type"][]) {
      const h = mount({ widget: makeWidget(type), frame: makeFrame(0) });
      expect(h.header.querySelectorAll(".ppp-widget-badge").length).toBe(0);
      h.destroy();
    }
  });

  it("WidgetHost fills the badges slot with the transformed frame", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "WidgetHost.svelte"), "utf8");
    expect(src).toMatch(/slot="badges"/);
    expect(src).toMatch(/<WidgetInlineBadges[^>]*frame=\{ctx\.transformedFrame\}/);
    expect(src).toMatch(/<WidgetInlineBadges[^>]*tableConfig=\{ctx\.effectiveTableConfig\}/);
  });
});
