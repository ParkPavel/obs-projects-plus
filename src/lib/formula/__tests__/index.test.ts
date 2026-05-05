import {
  parseFormula,
  evaluateFormula,
  validateFormula,
  type FormulaNode,
} from "src/lib/formula";

/**
 * R0.1 — Smoke test for the unified formula entry point.
 *
 * Verifies that the canonical import path (`src/lib/formula`) exposes the
 * same surfaces that legacy callers used from `src/lib/helpers/formulaParser`.
 * Migrations of legacy surfaces will be guarded by their own tests; this
 * suite only protects the entry point itself.
 */
describe("src/lib/formula (R0.1 unified entry)", () => {
  it("parseFormula returns a FormulaNode", () => {
    const node: FormulaNode = parseFormula('status = "Active"');
    expect(node).toBeDefined();
    expect(typeof node).toBe("object");
  });

  it("evaluateFormula resolves comparisons against a record", () => {
    const node = parseFormula("priority > 3");
    const record = {
      id: "a",
      name: "Test",
      values: { priority: 5 },
    };
    const out = evaluateFormula(node, record as never, new Date());
    expect(out).toBe(true);
  });

  it("validateFormula reports unknown field references", () => {
    const errors = validateFormula(
      "missingField > 0",
      ["status", "priority"],
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
