import { WIDGET_TEMPLATES } from "../widgetTemplates";

describe("widgetTemplates", () => {
  test("has 3 templates", () => {
    expect(WIDGET_TEMPLATES).toHaveLength(3);
  });

  test("all templates have required fields", () => {
    for (const tpl of WIDGET_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.label).toBeTruthy();
      expect(tpl.description).toBeTruthy();
      expect(Array.isArray(tpl.widgets)).toBe(true);
      expect(tpl.widgets.length).toBeGreaterThan(0);
    }
  });

  test("all widget definitions have required fields", () => {
    for (const tpl of WIDGET_TEMPLATES) {
      for (const widget of tpl.widgets) {
        expect(widget.id).toBeTruthy();
        expect(widget.type).toBeTruthy();
        expect(widget.title).toBeTruthy();
        expect(widget.layout).toBeDefined();
        expect(widget.layout.w).toBeGreaterThan(0);
        expect(widget.layout.h).toBeGreaterThan(0);
      }
    }
  });

  test("widget IDs are unique within each template", () => {
    for (const tpl of WIDGET_TEMPLATES) {
      const ids = tpl.widgets.map((w) => w.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("widget IDs are unique across all templates", () => {
    const allIds = WIDGET_TEMPLATES.flatMap((t) => t.widgets.map((w) => w.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  test("Dashboard template has stats, chart, and data-table", () => {
    const dashboard = WIDGET_TEMPLATES.find((t) => t.id === "dashboard");
    expect(dashboard).toBeDefined();
    const types = dashboard!.widgets.map((w) => w.type);
    expect(types).toContain("stats");
    expect(types).toContain("chart");
    expect(types).toContain("data-table");
  });

  test("Analytics template has multiple charts", () => {
    const analytics = WIDGET_TEMPLATES.find((t) => t.id === "analytics");
    expect(analytics).toBeDefined();
    const chartCount = analytics!.widgets.filter(
      (w) => w.type === "chart"
    ).length;
    expect(chartCount).toBeGreaterThanOrEqual(2);
  });

  test("Kanban+ template has data-table and checklist", () => {
    const kanban = WIDGET_TEMPLATES.find((t) => t.id === "kanban-plus");
    expect(kanban).toBeDefined();
    const types = kanban!.widgets.map((w) => w.type);
    expect(types).toContain("data-table");
    expect(types).toContain("checklist");
  });
});
