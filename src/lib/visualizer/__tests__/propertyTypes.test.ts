import {
  PROPERTY_TYPES,
  TYPES_KEY,
  inferType,
  readPropertyTypes,
  resolveType,
  type PropertyType,
} from "../propertyTypes";

describe("inferType", () => {
  it("recognises primitives", () => {
    expect(inferType(true)).toBe("boolean");
    expect(inferType(42)).toBe("number");
    expect(inferType("text")).toBe("string");
  });

  it("recognises ISO date and datetime strings", () => {
    expect(inferType("2026-05-01")).toBe("date");
    expect(inferType("2026-05-01T10:00:00")).toBe("datetime");
  });

  it("recognises hex colors", () => {
    expect(inferType("#ff0000")).toBe("color");
    expect(inferType("#abc")).toBe("color");
  });

  it("recognises wikilink scalars and arrays", () => {
    expect(inferType("[[Note]]")).toBe("relation");
    expect(inferType(["[[A]]", "[[B]]"])).toBe("relation");
  });

  it("falls back to list for non-relation arrays", () => {
    expect(inferType(["a", "b"])).toBe("list");
    expect(inferType([1, 2])).toBe("list");
  });

  it("falls back to string for unrecognised", () => {
    expect(inferType("not a date")).toBe("string");
    expect(inferType(null)).toBe("string");
    expect(inferType({})).toBe("string");
  });

  // PARITY-001 — autodetect URL/Email/Phone shapes
  it("recognises URL strings", () => {
    expect(inferType("https://example.com")).toBe("url");
    expect(inferType("http://localhost:3000/api")).toBe("url");
    expect(inferType("HTTPS://x.io")).toBe("url");
  });

  it("recognises email addresses", () => {
    expect(inferType("user@example.com")).toBe("email");
    expect(inferType("a.b+tag@sub.domain.org")).toBe("email");
  });

  it("recognises phone-shaped strings", () => {
    expect(inferType("+1 (555) 123-4567")).toBe("phone");
    expect(inferType("555-100-2000")).toBe("phone");
  });

  it("does NOT misclassify regular text as phone/url/email", () => {
    expect(inferType("Some text with 12 digits in it")).toBe("string");
    expect(inferType("user@")).toBe("string");
    expect(inferType("123")).toBe("string"); // too short for phone
  });
});

describe("readPropertyTypes", () => {
  it("returns empty for nullish or missing key", () => {
    expect(readPropertyTypes(null)).toEqual({});
    expect(readPropertyTypes({})).toEqual({});
  });

  it("parses a valid map and drops invalid types", () => {
    const fm = {
      [TYPES_KEY]: {
        color: "color",
        priority: "select",
        bogus: "alien",
        wrongShape: 42,
      },
    };
    expect(readPropertyTypes(fm)).toEqual({
      color: "color",
      priority: "select",
    });
  });

  it("rejects array shapes", () => {
    expect(readPropertyTypes({ [TYPES_KEY]: ["color"] })).toEqual({});
  });
});

describe("resolveType", () => {
  it("override wins over inference", () => {
    const overrides: Record<string, PropertyType> = { x: "select" };
    expect(resolveType("x", 42, overrides)).toBe("select");
  });

  it("falls back to inference when no override", () => {
    expect(resolveType("x", true, {})).toBe("boolean");
  });
});

describe("PROPERTY_TYPES coverage", () => {
  it("contains the canonical types we expose to users", () => {
    for (const expected of [
      "string",
      "number",
      "boolean",
      "date",
      "datetime",
      "list",
      "tags",
      "select",
      "color",
      "relation",
      "formula",
      "rollup",
    ]) {
      expect(PROPERTY_TYPES).toContain(expected);
    }
  });
});
