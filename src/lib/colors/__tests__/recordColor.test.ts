/**
 * recordColor.test.ts — UT2026-C (#070) single record-color contract.
 */

import type { DataRecord } from "src/lib/dataframe/dataframe";
import {
  normalizeHexColor,
  isColorFieldName,
  explicitRecordColor,
  resolveRecordColor,
} from "../recordColor";

function record(values: Record<string, unknown>): DataRecord {
  return { id: "r1", values } as DataRecord;
}

describe("normalizeHexColor", () => {
  it("accepts canonical #RRGGBB and lowercases it", () => {
    expect(normalizeHexColor("#00FFB3")).toBe("#00ffb3");
  });

  it("expands #RGB shorthand", () => {
    expect(normalizeHexColor("#0fb")).toBe("#00ffbb");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeHexColor(" #00ffb3 ")).toBe("#00ffb3");
  });

  it("rejects named colors, rgb() and garbage", () => {
    expect(normalizeHexColor("red")).toBeNull();
    expect(normalizeHexColor("rgb(0,255,179)")).toBeNull();
    expect(normalizeHexColor("#00ffb")).toBeNull();
    expect(normalizeHexColor(42)).toBeNull();
    expect(normalizeHexColor(undefined)).toBeNull();
  });
});

describe("isColorFieldName", () => {
  it.each(["color", "Color", "eventColor", "tagColor", "backgroundColor", "myColorField"])(
    "detects %s",
    (name) => expect(isColorFieldName(name)).toBe(true)
  );

  it("ignores unrelated names", () => {
    expect(isColorFieldName("status")).toBe(false);
    expect(isColorFieldName("colleague")).toBe(false);
  });
});

describe("explicitRecordColor", () => {
  it("reads the configured eventColorField", () => {
    expect(explicitRecordColor(record({ myTint: "#112233" }), "myTint")).toBe("#112233");
  });

  it("matches frontmatter keys case-insensitively (Color vs color)", () => {
    expect(explicitRecordColor(record({ Color: "#00ffb3" }), "color")).toBe("#00ffb3");
  });

  it("falls back to any color-named field when config field is absent", () => {
    expect(explicitRecordColor(record({ eventColor: "#aabbcc" }))).toBe("#aabbcc");
  });

  it("normalizes shorthand hex from frontmatter", () => {
    expect(explicitRecordColor(record({ color: "#0fb" }))).toBe("#00ffbb");
  });

  it("returns null when no valid color present", () => {
    expect(explicitRecordColor(record({ color: "red", status: "x" }))).toBeNull();
  });
});

describe("resolveRecordColor (C1 priority)", () => {
  const rule = jest.fn(() => "#ff0000");

  beforeEach(() => rule.mockClear());

  it("explicit per-record color beats the project rule", () => {
    const result = resolveRecordColor(record({ color: "#00ffb3" }), {
      getRecordColor: rule,
    });
    expect(result).toBe("#00ffb3");
    expect(rule).not.toHaveBeenCalled();
  });

  it("falls back to the project rule when no explicit color", () => {
    const result = resolveRecordColor(record({ status: "active" }), {
      getRecordColor: rule,
    });
    expect(result).toBe("#ff0000");
  });

  it("returns null when neither source yields a color", () => {
    expect(resolveRecordColor(record({}), {})).toBeNull();
  });
});
