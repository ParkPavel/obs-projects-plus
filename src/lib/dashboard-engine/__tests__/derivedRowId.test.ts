import { isDerivedRowId, sourceIdOf } from "../derivedRowId";
import { executeTransform } from "../transformExecutor";
import { DataFieldType } from "src/lib/dataframe/dataframe";

it("two unnest steps retain the source note and read-only derived identity", () => {
  const result = executeTransform({ fields: ["a", "b"].map(name => ({ name, type: DataFieldType.List, repeated: true, identifier: false, derived: false })),
    records: [{ id: "a.md", values: { a: [1, 2], b: [3, 4] } }] }, { steps: [{ type: "unnest", field: "a" }, { type: "unnest", field: "b" }] });
  expect(result.data.records).toHaveLength(4);
  for (const row of result.data.records) {
    expect(isDerivedRowId(row.id)).toBe(true);
    expect(sourceIdOf(row.id)).toBe("a.md");
  }
});

it.each(["a.md__0__unnest_1", "a.md__unnest_0__2", "a.md__2__4"])("chained suffixes remain derived: %s", id => {
  expect(isDerivedRowId(id)).toBe(true);
  expect(sourceIdOf(id)).toBe("a.md");
});

it("D17: a pipeline row is named by its note and is read-only", () => {
  expect(sourceIdOf("Кабинет/Антистресс.md__unnest_3")).toBe("Кабинет/Антистресс.md");
  expect(sourceIdOf("Кабинет/Анна.md__2")).toBe("Кабинет/Анна.md");
  expect(isDerivedRowId("Кабинет/Антистресс.md__unnest_3")).toBe(true);
  expect(isDerivedRowId("Кабинет/Анна.md")).toBe(false);
  expect(isDerivedRowId("Кабинет/Визит__2.md")).toBe(false);
});
