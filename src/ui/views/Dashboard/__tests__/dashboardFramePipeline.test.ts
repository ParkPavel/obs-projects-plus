import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import type { DatabaseViewConfig } from "../types";
import { buildDisplayFrame } from "../dashboardFramePipeline";

test("saved dashboard formulas become visible calculated columns without changing source records", () => {
  const source: DataFrame = {
    fields: [{ name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false }],
    records: [{ id: "a", values: { amount: 4 } }, { id: "b", values: { amount: 7 } }],
  };
  const config: DatabaseViewConfig = {
    widgets: [],
    layoutMode: "free",
    layoutVersion: 2,
    table: {},
    showWidgetToolbar: false,
    compactMode: false,
    formulaFields: [{ name: "doubled", expression: "amount * 2" }],
  };
  const display = buildDisplayFrame(source, config, () => null);

  expect(display.fields.map((field) => field.name)).toEqual(["amount", "doubled"]);
  expect(display.records.map((record) => record.values["doubled"])).toEqual([8, 14]);
  expect(source.records.every((record) => !("doubled" in record.values))).toBe(true);
});
