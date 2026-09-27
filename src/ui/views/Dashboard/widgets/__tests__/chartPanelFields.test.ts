/**
 * A chart is drawn from its widget's transformed frame, so its configuration
 * must offer the same columns — a Compute step's output, a group-by key, an
 * aggregate — for the axis pickers and for the defaults seeded on first
 * configure. It used to be handed the project's base fields, so a column the
 * pipeline produced was drawn but could not be picked (architect map
 * calc-charts-map, 2026-09-26).
 */

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import { WIDGET_PANELS, panelFields, type WidgetRenderContext } from "../widgetComponentRegistry";

const field = (name: string, type = DataFieldType.Number): DataField =>
  ({ name, type, repeated: false, identifier: false, derived: false }) as DataField;

function ctx(): WidgetRenderContext {
  const base = [field("date", DataFieldType.Date), field("price"), field("minutes")];
  const transformed = [field("date", DataFieldType.Date), field("revenue_per_hour")];
  return {
    fields: base,
    transformedFrame: { fields: transformed, records: [] },
    chartConfig: null,
    availableSources: [],
  } as unknown as WidgetRenderContext;
}

describe("chart configuration offers the pipeline's columns", () => {
  test("the chart panel is given the transformed frame's fields", () => {
    const props = WIDGET_PANELS.chart!.props(ctx());
    const names = (props["fields"] as DataField[]).map((f) => f.name);
    expect(names).toContain("revenue_per_hour");
    expect(names).not.toContain("price");
  });

  test("first-configure defaults read the same fields as the panel", () => {
    const c = ctx();
    expect(panelFields(c)).toBe(c.transformedFrame.fields);
  });
});
