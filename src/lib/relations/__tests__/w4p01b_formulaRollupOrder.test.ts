/**
 * w4-p01b (acceptance 26.10, N4) — a rollup reads a formula of its own project.
 *
 * The demo «Кабинет» wrote each visit's `paidAmount`, `debt` and `sessions` as
 * fixed numbers, so unticking «paid» or changing a price left every client
 * total as it was. Declared as formulas they follow the note — but every
 * formula ran AFTER the rollups, so a client's sum over its visits' formula
 * read an empty column. Formulas no rollup feeds now run first.
 */
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { applyComputedColumns, splitFormulasAroundRollups } from "../computedColumns";

const field = (name: string, type: DataFieldType) => ({
  name, type, identifier: false, derived: false, repeated: false, typeConfig: {},
});

const cabinet = (): DataFrame => ({
  fields: [
    field("name", DataFieldType.String),
    field("client", DataFieldType.Relation),
    field("price", DataFieldType.Number),
    field("paid", DataFieldType.Boolean),
  ],
  records: [
    { id: "Clients/Anna.md", values: { name: "Anna" } },
    { id: "Visits/v1.md", values: { name: "v1", client: "[[Anna]]", price: 3000, paid: true } },
    { id: "Visits/v2.md", values: { name: "v2", client: "[[Anna]]", price: 1500, paid: false } },
  ],
});

const config = {
  client: { relation: { targetProjectId: "cab" } },
  paidAmount: { formula: "IF(paid, price, 0)" },
  paidTotal: {
    rollup: { relationField: "", targetField: "paidAmount", function: "sum", backlink: { projectId: "cab", relationField: "client" } },
  },
  share: { formula: "paidTotal / 1000" },
} as never;

const anna = (frame: DataFrame) => frame.records.find((r) => r.id === "Clients/Anna.md")!.values;

describe("a rollup over a formula of its own project", () => {
  it("sums the formula's values (old order: the column was empty)", () => {
    expect(anna(applyComputedColumns(cabinet(), config, "cab", new Map()))["paidTotal"]).toBe(3000);
  });

  it("follows the note: a visit marked paid changes the total", () => {
    const frame = cabinet();
    frame.records[2]!.values["paid"] = true;
    expect(anna(applyComputedColumns(frame, config, "cab", new Map()))["paidTotal"]).toBe(4500);
  });

  it("still lets a formula read a rollup", () => {
    expect(anna(applyComputedColumns(cabinet(), config, "cab", new Map()))["share"]).toBe(3);
  });
});

describe("splitFormulasAroundRollups", () => {
  const defs = [
    { name: "a", expression: "price * 2" },
    { name: "b", expression: "total + 1" },
    { name: "c", expression: "b * 2" },
    { name: "d", expression: "a + 1" },
  ];

  it("puts a formula after the rollups when it reads one, directly or through another formula", () => {
    const { before, after } = splitFormulasAroundRollups(defs, new Set(["total"]));
    expect(before.map((d) => d.name)).toEqual(["a", "d"]);
    expect(after.map((d) => d.name)).toEqual(["b", "c"]);
  });

  it("keeps every formula before when there is no rollup", () => {
    expect(splitFormulasAroundRollups(defs, new Set()).after).toEqual([]);
  });
});
