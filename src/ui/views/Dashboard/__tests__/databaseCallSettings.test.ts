import type { WidgetSourceConfig, WidgetDefinition } from "../types";

describe("DatabaseCallSettings — WidgetSourceConfig", () => {
  test("WidgetSourceConfig with empty projectId means inherit from parent view", () => {
    const config: WidgetSourceConfig = { projectId: "" };
    expect(config.projectId).toBe("");
  });

  test("WidgetSourceConfig with non-empty projectId selects an independent source", () => {
    const config: WidgetSourceConfig = { projectId: "proj-123" };
    expect(config.projectId).toBe("proj-123");
  });

  test("WidgetDefinition.sourceConfig is optional (backward compat)", () => {
    const widget: WidgetDefinition = {
      id: "w1",
      type: "database-call",
      title: "My Data",
      layout: { x: 1, y: 1, w: 4, h: 4 },
      config: {},
    };
    expect(widget.sourceConfig).toBeUndefined();
  });

  test("WidgetDefinition with sourceConfig set overrides parent frame", () => {
    const widget: WidgetDefinition = {
      id: "w2",
      type: "database-call",
      title: "External",
      layout: { x: 1, y: 1, w: 4, h: 4 },
      config: {},
      sourceConfig: { projectId: "other-project" },
    };
    expect(widget.sourceConfig?.projectId).toBe("other-project");
  });
});
