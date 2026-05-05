// Metadata registry tests — formulaMetadata powers FormulaBar IntelliSense.
import {
  getFormulaMetadata,
  getAllFormulaMetadata,
} from "src/ui/views/Dashboard/engine/formulaMetadata";
import { getFormulaFunctions } from "src/ui/views/Dashboard/engine/formulaEngine";

describe("formulaMetadata", () => {
  it("covers every registered formula function", () => {
    const fns = getFormulaFunctions();
    const missing = fns.filter((name) => !getFormulaMetadata(name));
    expect(missing).toEqual([]);
  });

  it("returns consistent metadata shape", () => {
    for (const meta of getAllFormulaMetadata()) {
      expect(meta.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(meta.signature).toContain(meta.name);
      expect(typeof meta.returnType).toBe("string");
      expect(meta.returnType.length).toBeGreaterThan(0);
      expect(typeof meta.doc).toBe("string");
      expect(meta.doc.length).toBeGreaterThan(0);
      expect([
        "logical",
        "math",
        "string",
        "date",
        "financial",
        "statistical",
        "array",
        "conversion",
        "utility",
      ]).toContain(meta.category);
    }
  });

  it("is case-insensitive", () => {
    expect(getFormulaMetadata("sum")).toBeDefined();
    expect(getFormulaMetadata("Sum")?.name).toBe("SUM");
    expect(getFormulaMetadata("SUM")?.returnType).toBe("number");
  });

  it("returns undefined for unknown names", () => {
    expect(getFormulaMetadata("")).toBeUndefined();
    expect(getFormulaMetadata("NOT_A_FUNCTION")).toBeUndefined();
  });

  it("signature mentions expected sentinel tokens", () => {
    expect(getFormulaMetadata("IF")?.signature).toBe("IF(condition, then, else?)");
    expect(getFormulaMetadata("SUM")?.signature).toBe("SUM(values...)");
    expect(getFormulaMetadata("DATE_ADD")?.signature).toContain("unit");
  });
});
