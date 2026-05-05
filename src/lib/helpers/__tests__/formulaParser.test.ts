/**
 * formulaParser — direct kernel coverage (REFACTOR-107).
 *
 * Sibling tests live in `src/lib/formula/__tests__/` but cover the
 * facade barrel; this file pins the raw `tokenize` / `parseFormula` /
 * `evaluateFormula` / `validateFormula` API used by Dashboard
 * advanced-mode filters.
 */

import {
  tokenize,
  parseFormula,
  evaluateFormula,
  validateFormula,
} from "src/lib/helpers/formulaParser";
import type { DataRecord } from "src/lib/dataframe/dataframe";

const rec = (values: Record<string, unknown>): DataRecord =>
  ({ id: "x", values: values as DataRecord["values"] });

describe("formulaParser", () => {
  describe("tokenize", () => {
    test("function call", () => {
      const t = tokenize("AND(a,b)");
      expect(t[0]?.type).toBe("FUNCTION");
      expect((t[0] as { value: string }).value).toBe("AND");
    });
    test("number literal", () => {
      const t = tokenize("42");
      expect(t[0]?.type).toBe("NUMBER");
    });
    test("string literal", () => {
      const t = tokenize('"hello"');
      expect(t[0]?.type).toBe("STRING");
      expect((t[0] as { value: string }).value).toBe("hello");
    });
    test("boolean literals", () => {
      expect(tokenize("true")[0]?.type).toBe("BOOLEAN");
      expect(tokenize("false")[0]?.type).toBe("BOOLEAN");
    });
    test("operator tokens", () => {
      const t = tokenize("a >= 5");
      expect(t.some((tk) => tk.type === "OPERATOR" && tk.value === ">=")).toBe(true);
    });
  });

  describe("parseFormula", () => {
    test("AND function with two operator subtrees", () => {
      const ast = parseFormula('AND(status = "Active", priority > 5)');
      expect(ast.type).toBe("function");
      if (ast.type === "function") {
        expect(ast.name).toBe("AND");
        expect(ast.args).toHaveLength(2);
      }
    });
    test("nested function call", () => {
      const ast = parseFormula("OR(IS_EMPTY(due), CONTAINS(tags, \"x\"))");
      expect(ast.type).toBe("function");
    });
    test("field reference", () => {
      const ast = parseFormula("status");
      expect(ast.type).toBe("field");
    });
  });

  describe("evaluateFormula — boolean logic", () => {
    test("AND true/true", () => {
      const ast = parseFormula("AND(true, true)");
      expect(evaluateFormula(ast, rec({}))).toBe(true);
    });
    test("AND with false short-circuits", () => {
      const ast = parseFormula("AND(true, false)");
      expect(evaluateFormula(ast, rec({}))).toBe(false);
    });
    test("OR true/false", () => {
      const ast = parseFormula("OR(false, true)");
      expect(evaluateFormula(ast, rec({}))).toBe(true);
    });
    test("NOT", () => {
      const ast = parseFormula("NOT(false)");
      expect(evaluateFormula(ast, rec({}))).toBe(true);
    });
  });

  describe("evaluateFormula — operators & functions", () => {
    test("equality with smart coercion (number vs string)", () => {
      const ast = parseFormula("priority = 5");
      expect(evaluateFormula(ast, rec({ priority: "5" }))).toBe(true);
    });
    test("greater-than numeric", () => {
      const ast = parseFormula("priority > 3");
      expect(evaluateFormula(ast, rec({ priority: 5 }))).toBe(true);
      expect(evaluateFormula(ast, rec({ priority: 2 }))).toBe(false);
    });
    test("CONTAINS case-insensitive", () => {
      const ast = parseFormula('CONTAINS(title, "URGENT")');
      expect(evaluateFormula(ast, rec({ title: "Very urgent task" }))).toBe(true);
    });
    test("STARTS_WITH", () => {
      const ast = parseFormula('STARTS_WITH(name, "Pro")');
      expect(evaluateFormula(ast, rec({ name: "Project Alpha" }))).toBe(true);
    });
    test("ENDS_WITH", () => {
      const ast = parseFormula('ENDS_WITH(name, "Alpha")');
      expect(evaluateFormula(ast, rec({ name: "Project Alpha" }))).toBe(true);
    });
    test("IS_EMPTY on missing field", () => {
      const ast = parseFormula("IS_EMPTY(due)");
      expect(evaluateFormula(ast, rec({}))).toBe(true);
    });
    test("IS_NOT_EMPTY on populated field", () => {
      const ast = parseFormula("IS_NOT_EMPTY(due)");
      expect(evaluateFormula(ast, rec({ due: "2026-01-01" }))).toBe(true);
    });
  });

  describe("evaluateFormula — date functions (with baseDate)", () => {
    const base = new Date(2026, 4, 15); // 2026-05-15

    test("IS_TODAY same day", () => {
      const ast = parseFormula("IS_TODAY(due)");
      expect(evaluateFormula(ast, rec({ due: "2026-05-15" }), base)).toBe(true);
    });
    test("IS_OVERDUE past date", () => {
      const ast = parseFormula("IS_OVERDUE(due)");
      expect(evaluateFormula(ast, rec({ due: "2026-05-10" }), base)).toBe(true);
    });
    test("IS_UPCOMING future date", () => {
      const ast = parseFormula("IS_UPCOMING(due)");
      expect(evaluateFormula(ast, rec({ due: "2026-05-20" }), base)).toBe(true);
    });
    test("IS_OVERDUE skips empty value", () => {
      const ast = parseFormula("IS_OVERDUE(due)");
      expect(evaluateFormula(ast, rec({}), base)).toBe(false);
    });
  });

  describe("validateFormula", () => {
    test("returns no errors for valid formula with known fields", () => {
      const errors = validateFormula("status = \"x\"", ["status"]);
      expect(errors).toEqual([]);
    });
    test("reports unknown field", () => {
      const errors = validateFormula("missing = 1", ["status"]);
      expect(errors.some((e) => e.message.includes("missing"))).toBe(true);
    });
    test("returns errors for syntactically invalid input", () => {
      const errors = validateFormula("AND(", ["status"]);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
