import { isDerivedRowId, sourceIdOf } from "../derivedRowId";

it("D17: a pipeline row is named by its note and is read-only", () => {
  expect(sourceIdOf("Кабинет/Антистресс.md__unnest_3")).toBe("Кабинет/Антистресс.md");
  expect(sourceIdOf("Кабинет/Анна.md__2")).toBe("Кабинет/Анна.md");
  expect(isDerivedRowId("Кабинет/Антистресс.md__unnest_3")).toBe(true);
  expect(isDerivedRowId("Кабинет/Анна.md")).toBe(false);
  expect(isDerivedRowId("Кабинет/Визит__2.md")).toBe(false);
});
