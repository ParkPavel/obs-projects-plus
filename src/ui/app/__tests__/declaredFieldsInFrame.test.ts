/**
 * i2-safety — a property created without a value is no longer written into the
 * notes, so no note carries its key and `detectFields` cannot see it. The
 * base's settings declare it instead, and the frame every view reads takes it
 * from there. Without this the column would vanish, and the next settings
 * write would prune its config (`updateFieldConfig` keeps only fields the
 * frame lists).
 */
import { describe, expect, it } from "@jest/globals";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { applyDeclaredFieldTypes, type FieldConfigRelationMap } from "../viewHelpers";

const nameField = { name: "name", type: DataFieldType.String, identifier: true, derived: true, repeated: false, typeConfig: {} };
const frame: DataFrame = { fields: [nameField], records: [{ id: "a.md", values: { name: "a" } }] };

describe("i2-safety — declared properties appear without a key in any note", () => {
  it("a declared relation with a target", () => {
    const fc: FieldConfigRelationMap = { Клиент: { relation: { targetProjectId: "clients" } } };
    const f = applyDeclaredFieldTypes(frame, fc).fields.find((x) => x.name === "Клиент");
    expect(f).toMatchObject({ type: DataFieldType.Relation, repeated: true, derived: false });
  });

  it("a declared formula, with or without an expression yet, is read-only", () => {
    const fc: FieldConfigRelationMap = { Итого: { formula: "price * 2" }, Пустая: { type: "formula" } };
    const fields = applyDeclaredFieldTypes(frame, fc).fields;
    expect(fields.find((x) => x.name === "Итого")).toMatchObject({ type: DataFieldType.Formula, derived: true });
    expect(fields.find((x) => x.name === "Пустая")).toMatchObject({ type: DataFieldType.Formula, derived: true });
  });

  it("a declared plain property keeps its type", () => {
    const fc: FieldConfigRelationMap = { Заметка: { type: "string" }, Сумма: { type: "number" }, Статус: { type: "status" } };
    const fields = applyDeclaredFieldTypes(frame, fc).fields;
    expect(fields.find((x) => x.name === "Заметка")?.type).toBe(DataFieldType.String);
    expect(fields.find((x) => x.name === "Сумма")?.type).toBe(DataFieldType.Number);
    expect(fields.find((x) => x.name === "Статус")?.type).toBe(DataFieldType.Status);
  });

  it("a field the notes already carry is not duplicated", () => {
    const withKey: DataFrame = { ...frame, fields: [...frame.fields, { ...nameField, name: "Сумма", type: DataFieldType.Number, identifier: false, derived: false }] };
    const fields = applyDeclaredFieldTypes(withKey, { Сумма: { type: "number" } }).fields;
    expect(fields.filter((x) => x.name === "Сумма")).toHaveLength(1);
  });

  it("config entries that declare nothing add nothing (a rollup is added by applyRollupColumns)", () => {
    const fc: FieldConfigRelationMap = { Опции: { options: ["a"] } as never, Сумма: { rollup: { relationField: "x" } } as never };
    expect(applyDeclaredFieldTypes(frame, fc)).toBe(frame);
  });
});
