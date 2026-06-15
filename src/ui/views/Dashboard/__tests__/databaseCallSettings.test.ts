import "@testing-library/jest-dom";

import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataField } from "src/lib/dataframe/dataframe";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
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

describe("DatabaseCallSettings — #099.3 unnest as block property", () => {
  function field(name: string): DataField {
    return { name, type: DataFieldType.Unknown, repeated: false, identifier: false, derived: false };
  }

  const fields = [field("title"), field("exercises"), field("tags")];

  function source() {
    return {
      records: [
        { values: { title: "Mon", exercises: [{ name: "Bench" }], tags: ["a", "b"] } },
      ],
    };
  }

  function mount(props: Record<string, unknown>) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const emitted: TransformPipeline[] = [];
    const component = new DatabaseCallSettings({ target, props });
    component.$on("transformChange", (e: CustomEvent<TransformPipeline>) => emitted.push(e.detail));
    const els = Array.from(target.querySelectorAll("select"));
    // The unnest field <select> contains the array-field option list; the
    // source/link selects do not include "exercises"/"tags" options.
    const unnestSelect = els.find((s) =>
      Array.from(s.options).some((o) => o.value === "exercises" || o.value === "tags"),
    ) as HTMLSelectElement | undefined;
    const checkbox = target.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    return {
      component,
      emitted,
      unnestSelect,
      checkbox,
      destroy() {
        component.$destroy();
        target.remove();
      },
    };
  }

  function selectValue(select: HTMLSelectElement, value: string) {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  test("picker is hidden when source has no array fields", () => {
    const m = mount({ fields, source: { records: [{ values: { title: "x" } }] }, transform: { steps: [] } });
    expect(m.unnestSelect).toBeUndefined();
    m.destroy();
  });

  test("toggle-on (select a field) prepends an unnest step", () => {
    const m = mount({
      fields,
      source: source(),
      transform: { steps: [{ type: "filter", conditions: { conjunction: "and", conditions: [] } }] } as TransformPipeline,
    });
    expect(m.unnestSelect).toBeDefined();
    selectValue(m.unnestSelect!, "exercises");
    expect(m.emitted).toHaveLength(1);
    const steps = m.emitted[0]!.steps;
    expect(steps[0]).toEqual({ type: "unnest", field: "exercises" });
    expect(steps.some((s) => s.type === "filter")).toBe(true);
    expect(steps.filter((s) => s.type === "unnest")).toHaveLength(1);
    m.destroy();
  });

  test("toggle-off (checkbox uncheck) removes only that field's unnest", () => {
    const transform: TransformPipeline = {
      steps: [
        { type: "unnest", field: "exercises" },
        { type: "unnest", field: "tags" },
      ],
    };
    const m = mount({ fields, source: source(), transform });
    expect(m.checkbox?.checked).toBe(true);
    m.checkbox!.checked = false;
    m.checkbox!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(m.emitted).toHaveLength(1);
    const steps = m.emitted[0]!.steps;
    // checkbox-off uses activeUnnestField (first unnest = exercises).
    expect(steps.some((s) => s.type === "unnest" && s.field === "exercises")).toBe(false);
    expect(steps.some((s) => s.type === "unnest" && s.field === "tags")).toBe(true);
    m.destroy();
  });

  test("round-trip — emitted transform fed back as prop reflects active field (#100)", async () => {
    const m = mount({ fields, source: source(), transform: { steps: [] } });
    selectValue(m.unnestSelect!, "exercises");
    const emitted = m.emitted[0]!;
    m.component.$set({ transform: emitted });
    await Promise.resolve();
    // After round-trip the unnest <select> shows the active field.
    const els = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
    const sel = els.find((s) => Array.from(s.options).some((o) => o.value === "exercises"));
    expect(sel?.value).toBe("exercises");
    m.destroy();
  });

  test("no double unnest when a pre-existing other-field unnest is present", () => {
    const transform: TransformPipeline = { steps: [{ type: "unnest", field: "tags" }] };
    const m = mount({ fields, source: source(), transform });
    selectValue(m.unnestSelect!, "exercises");
    const steps = m.emitted[0]!.steps;
    expect(steps.filter((s) => s.type === "unnest")).toHaveLength(2);
    expect(steps[0]).toEqual({ type: "unnest", field: "exercises" });
    expect(steps.some((s) => s.type === "unnest" && s.field === "tags")).toBe(true);
    m.destroy();
  });
});
