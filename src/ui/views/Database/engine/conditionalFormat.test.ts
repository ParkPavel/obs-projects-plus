// src/ui/views/Database/engine/conditionalFormat.test.ts

import {
  computeCellStyle,
  computeRowStyles,
  cellStyleToCSS,
} from "./conditionalFormat";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { ConditionalFormat } from "../types";

function makeRecord(values: Record<string, unknown>): DataRecord {
  return { id: "test", values: values as DataRecord["values"] };
}

const formats: ConditionalFormat[] = [
  {
    id: "fmt1",
    field: "status",
    conditions: [
      { operator: "is", value: "active", style: { backgroundColor: "#00ff00" } },
      { operator: "is", value: "done", style: { textColor: "#999999", italic: true } },
    ],
  },
  {
    id: "fmt2",
    field: "priority",
    conditions: [
      { operator: "gt", value: "5", style: { bold: true, textColor: "#ff0000" } },
    ],
  },
];

describe("computeCellStyle", () => {
  test("returns matching style for status=active", () => {
    const record = makeRecord({ status: "active", priority: 3 });
    const style = computeCellStyle(formats, "status", record);
    expect(style).not.toBeNull();
    expect(style!.backgroundColor).toBe("#00ff00");
  });

  test("returns matching style for status=done", () => {
    const record = makeRecord({ status: "done", priority: 1 });
    const style = computeCellStyle(formats, "status", record);
    expect(style).not.toBeNull();
    expect(style!.textColor).toBe("#999999");
    expect(style!.italic).toBe(true);
  });

  test("returns null when no rule matches", () => {
    const record = makeRecord({ status: "pending", priority: 1 });
    const style = computeCellStyle(formats, "status", record);
    expect(style).toBeNull();
  });

  test("returns null for unformatted field", () => {
    const record = makeRecord({ status: "active", priority: 3 });
    const style = computeCellStyle(formats, "name", record);
    expect(style).toBeNull();
  });

  test("matches number comparison (gt)", () => {
    const record = makeRecord({ status: "active", priority: 8 });
    const style = computeCellStyle(formats, "priority", record);
    expect(style).not.toBeNull();
    expect(style!.bold).toBe(true);
    expect(style!.textColor).toBe("#ff0000");
  });
});

describe("computeRowStyles", () => {
  test("returns styles for multiple fields", () => {
    const record = makeRecord({ status: "active", priority: 8 });
    const styles = computeRowStyles(formats, record);

    expect(styles["status"]).toBeDefined();
    expect(styles["status"]!.backgroundColor).toBe("#00ff00");
    expect(styles["priority"]).toBeDefined();
    expect(styles["priority"]!.bold).toBe(true);
  });

  test("returns empty object when nothing matches", () => {
    const record = makeRecord({ status: "pending", priority: 2 });
    const styles = computeRowStyles(formats, record);
    expect(Object.keys(styles)).toHaveLength(0);
  });
});

describe("cellStyleToCSS", () => {
  test("generates full CSS string", () => {
    const css = cellStyleToCSS({
      backgroundColor: "#ff0000",
      textColor: "#ffffff",
      bold: true,
      italic: true,
    });

    expect(css).toContain("background-color: #ff0000");
    expect(css).toContain("color: #ffffff");
    expect(css).toContain("font-weight: 700");
    expect(css).toContain("font-style: italic");
  });

  test("generates partial CSS string", () => {
    const css = cellStyleToCSS({ bold: true });
    expect(css).toBe("font-weight: 700");
    expect(css).not.toContain("background-color");
  });

  test("empty style produces empty string", () => {
    expect(cellStyleToCSS({})).toBe("");
  });
});
