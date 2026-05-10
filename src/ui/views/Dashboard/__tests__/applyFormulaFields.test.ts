// MPLAN-001 — Tests for applyFormulaFields.

import {
  DataFieldType,
  type DataFrame,
} from "src/lib/dataframe/dataframe";
import { applyFormulaFields } from "../engine/applyFormulaFields";

function makeFrame(): DataFrame {
  return {
    fields: [
      { name: "qty", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "price", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "a", values: { qty: 2, price: 10 } },
      { id: "b", values: { qty: 3, price: 7 } },
    ],
  };
}

describe("applyFormulaFields", () => {
  test("returns frame unchanged when no formula fields", () => {
    const frame = makeFrame();
    expect(applyFormulaFields(frame, undefined)).toBe(frame);
    expect(applyFormulaFields(frame, [])).toBe(frame);
  });

  test("computes a numeric formula and appends a derived field", () => {
    const frame = makeFrame();
    const out = applyFormulaFields(frame, [
      { name: "total", expression: "qty * price" },
    ]);
    expect(out.records.map((r) => r.values["total"])).toEqual([20, 21]);
    const total = out.fields.find((f) => f.name === "total");
    expect(total).toBeDefined();
    expect(total!.type).toBe(DataFieldType.Number);
    expect(total!.derived).toBe(true);
  });

  test("uses declared resultType over inference", () => {
    const frame = makeFrame();
    const out = applyFormulaFields(frame, [
      { name: "total", expression: "qty * price", resultType: "string" },
    ]);
    const total = out.fields.find((f) => f.name === "total");
    expect(total!.type).toBe(DataFieldType.String);
  });

  test("formula columns can reference earlier formula columns", () => {
    const frame = makeFrame();
    const out = applyFormulaFields(frame, [
      { name: "total", expression: "qty * price" },
      { name: "doubled", expression: "total * 2" },
    ]);
    expect(out.records.map((r) => r.values["doubled"])).toEqual([40, 42]);
  });

  test("invalid expressions yield null without throwing", () => {
    const frame = makeFrame();
    const out = applyFormulaFields(frame, [
      { name: "broken", expression: "qty *" },
    ]);
    expect(out.records.every((r) => r.values["broken"] == null)).toBe(true);
  });

  test("does not duplicate field when name already exists", () => {
    const frame = makeFrame();
    const out = applyFormulaFields(frame, [
      { name: "qty", expression: "qty + 1" },
    ]);
    expect(out.fields.filter((f) => f.name === "qty")).toHaveLength(1);
    expect(out.records.map((r) => r.values["qty"])).toEqual([3, 4]);
  });
});
