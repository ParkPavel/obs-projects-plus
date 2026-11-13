/**
 * i2-data (R3): a formula property of the base (`fieldConfig.formula`) was
 * stored and never computed anywhere — the column stayed empty. It is
 * computed in the view's enrichment pass, after rollups.
 */
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { applyFormulaFields } from "src/lib/dashboard-engine/applyFormulaFields";
import { applyDeclaredFieldTypes, formulaPropertiesOf } from "src/lib/relations/declaredFieldTypes";

it("a declared formula property gets a value on every record, its name matched without case", () => {
  const frame: DataFrame = {
    fields: [{ name: "paid", type: DataFieldType.Number, identifier: false, derived: false, repeated: false, typeConfig: {} }],
    records: [{ id: "a.md", values: { paid: 5 } }, { id: "b.md", values: { paid: 2 } }],
  };
  const fc = { Итого: { formula: "Paid + 1", type: "formula" as const } };
  const out = applyFormulaFields(applyDeclaredFieldTypes(frame, fc), formulaPropertiesOf(fc));
  expect(out.records.map((r) => r.values["Итого"])).toEqual([6, 3]);
  expect(out.fields.find((f) => f.name === "Итого")).toMatchObject({ type: DataFieldType.Formula, derived: true });
  expect(out.fields.find((f) => f.name === "Итого")?.typeConfig?.formula).toBe("Paid + 1");
});

it("a demo formula overriding an inferred column retains its editable definition", () => {
  const frame: DataFrame = { fields: [{name: "total",type:DataFieldType.Number,derived:false,identifier:false,repeated:false}], records: [] };
  const fields = applyDeclaredFieldTypes(frame, {total:{formula:"price * 2",formulaVersion:"unified-v1"}}).fields;
  expect(fields[0]).toMatchObject({name:"total",type:DataFieldType.Formula,derived:true,typeConfig:{formula:"price * 2",formulaVersion:"unified-v1"}});
});
