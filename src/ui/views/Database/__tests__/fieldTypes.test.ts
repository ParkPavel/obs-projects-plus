// src/ui/views/Database/__tests__/fieldTypes.test.ts

import {
  isSelectConfig,
  isStatusConfig,
  isFormulaConfig,
  getOptionColor,
  DEFAULT_STATUS_GROUPS,
  DEFAULT_SELECT_COLORS,
  type SelectFieldTypeConfig,
  type StatusFieldTypeConfig,
  type FormulaFieldTypeConfig,
} from "../fieldTypes";

describe("fieldTypes — type guards", () => {
  test("isSelectConfig identifies select config", () => {
    const config: SelectFieldTypeConfig = {
      type: "select",
      options: [{ name: "A", color: "#ff0000" }],
    };
    expect(isSelectConfig(config)).toBe(true);
    expect(isStatusConfig(config)).toBe(false);
    expect(isFormulaConfig(config)).toBe(false);
  });

  test("isStatusConfig identifies status config", () => {
    const config: StatusFieldTypeConfig = {
      type: "status",
      groups: DEFAULT_STATUS_GROUPS,
    };
    expect(isStatusConfig(config)).toBe(true);
    expect(isSelectConfig(config)).toBe(false);
  });

  test("isFormulaConfig identifies formula config", () => {
    const config: FormulaFieldTypeConfig = {
      type: "formula",
      expression: "a + b",
      resultType: "number",
    };
    expect(isFormulaConfig(config)).toBe(true);
    expect(isSelectConfig(config)).toBe(false);
  });

  test("type guards return false for null/undefined", () => {
    expect(isSelectConfig(null)).toBe(false);
    expect(isStatusConfig(undefined)).toBe(false);
    expect(isFormulaConfig(null)).toBe(false);
  });

  test("type guards return false for plain objects", () => {
    expect(isSelectConfig({ foo: "bar" })).toBe(false);
    expect(isStatusConfig({ type: "unknown" })).toBe(false);
  });
});

describe("fieldTypes — getOptionColor", () => {
  const selectConfig: SelectFieldTypeConfig = {
    type: "select",
    options: [
      { name: "High", color: "#ff0000" },
      { name: "Medium", color: "#ffaa00" },
      { name: "Low", color: "#00ff00" },
    ],
  };

  const statusConfig: StatusFieldTypeConfig = {
    type: "status",
    groups: DEFAULT_STATUS_GROUPS,
  };

  test("returns color for known select option", () => {
    expect(getOptionColor(selectConfig, "High")).toBe("#ff0000");
    expect(getOptionColor(selectConfig, "Low")).toBe("#00ff00");
  });

  test("returns null for unknown select option", () => {
    expect(getOptionColor(selectConfig, "Critical")).toBeNull();
  });

  test("returns color for status group", () => {
    expect(getOptionColor(statusConfig, "Done")).toBe("#2ecc71");
  });

  test("returns null for unknown status", () => {
    expect(getOptionColor(statusConfig, "Cancelled")).toBeNull();
  });
});

describe("fieldTypes — defaults", () => {
  test("DEFAULT_STATUS_GROUPS has 3 groups", () => {
    expect(DEFAULT_STATUS_GROUPS).toHaveLength(3);
    expect(DEFAULT_STATUS_GROUPS.map((g) => g.name)).toEqual([
      "To-do",
      "In Progress",
      "Done",
    ]);
  });

  test("DEFAULT_SELECT_COLORS has 8 colors", () => {
    expect(DEFAULT_SELECT_COLORS).toHaveLength(8);
  });
});
