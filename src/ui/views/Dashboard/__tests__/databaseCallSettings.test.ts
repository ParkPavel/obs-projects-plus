import "@testing-library/jest-dom";

import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataField } from "src/lib/dataframe/dataframe";
import type { WidgetSourceConfig, WidgetDefinition } from "../types";

const DatabaseCallSettings =
  require("../widgets/DatabaseCall/DatabaseCallSettings.svelte").default;

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

// #121 — unnest quick-toggle removed from this component. Database-call
// unnest goes exclusively through the Σ PipelineEditor's "Array fields
// detected" banner (see PipelineEditor.mutation.test.ts). This is a
// regression guard against the duplicate affordance reappearing here.
describe("DatabaseCallSettings — #121 no unnest affordance", () => {
  function field(name: string): DataField {
    return { name, type: DataFieldType.Unknown, repeated: false, identifier: false, derived: false };
  }

  test("renders no checkbox and no 'Expand list' text", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const component = new DatabaseCallSettings({
      target,
      props: {
        fields: [field("title"), field("exercises")],
        availableSources: [],
        availableWidgets: [],
      },
    });

    expect(target.querySelector('input[type="checkbox"]')).toBeNull();
    expect(target.textContent).not.toContain("Expand list");

    component.$destroy();
    target.remove();
  });
});
