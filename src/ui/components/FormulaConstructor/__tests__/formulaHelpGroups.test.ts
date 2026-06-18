import { groupFormulaMetadata } from "../formulaHelpGroups";
import { getAllFormulaMetadata } from "src/lib/dashboard-engine/formulaMetadata";

describe("groupFormulaMetadata", () => {
  test("groups every metadata entry exactly once", () => {
    const groups = groupFormulaMetadata();
    const grouped = groups.reduce((n, g) => n + g.entries.length, 0);
    expect(grouped).toBe(getAllFormulaMetadata().length);
  });

  test("each group is non-empty and entries carry signature", () => {
    for (const group of groupFormulaMetadata()) {
      expect(group.entries.length).toBeGreaterThan(0);
      for (const entry of group.entries) {
        expect(typeof entry.signature).toBe("string");
        expect(entry.signature.length).toBeGreaterThan(0);
      }
    }
  });

  test("known categories surface with their functions", () => {
    const groups = groupFormulaMetadata();
    const logical = groups.find((g) => g.category === "logical");
    expect(logical).toBeDefined();
    expect(logical?.entries.some((e) => e.signature.startsWith("IF("))).toBe(true);

    const date = groups.find((g) => g.category === "date");
    expect(date?.entries.some((e) => e.signature.startsWith("TODAY("))).toBe(true);
  });
});
