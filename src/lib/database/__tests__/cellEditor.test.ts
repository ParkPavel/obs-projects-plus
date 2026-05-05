import {
  formatCellValue,
  parseCellInput,
  type CellEditType,
} from "../cellEditor";

function expectOk<T extends ReturnType<typeof parseCellInput>>(
  result: T,
): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error(`expected ok, got error ${result.error.i18nKey}`);
  }
  return result as Extract<T, { ok: true }>;
}

describe("parseCellInput — clearing", () => {
  it("treats empty-string input as null for every scalar type", () => {
    const types: CellEditType[] = [
      "string",
      "number",
      "date",
      "datetime",
      "color",
      "select",
      "status",
    ];
    for (const t of types) {
      expect(expectOk(parseCellInput("", t)).value).toBeNull();
      expect(expectOk(parseCellInput("   ", t)).value).toBeNull();
    }
  });

  it("treats explicit null as clear", () => {
    expect(expectOk(parseCellInput(null, "string")).value).toBeNull();
  });
});

describe("parseCellInput — boolean", () => {
  it("accepts true / false strings and real booleans", () => {
    expect(expectOk(parseCellInput("true", "boolean")).value).toBe(true);
    expect(expectOk(parseCellInput("FALSE", "boolean")).value).toBe(false);
    expect(expectOk(parseCellInput(true, "boolean")).value).toBe(true);
  });

  it("rejects garbage", () => {
    const r = parseCellInput("yes", "boolean");
    expect(r.ok).toBe(false);
  });
});

describe("parseCellInput — number", () => {
  it("parses integers and decimals", () => {
    expect(expectOk(parseCellInput("42", "number")).value).toBe(42);
    expect(expectOk(parseCellInput("-3.14", "number")).value).toBe(-3.14);
  });
  it("rejects non-numeric and embedded spaces", () => {
    expect(parseCellInput("12 34", "number").ok).toBe(false);
    expect(parseCellInput("abc", "number").ok).toBe(false);
  });
});

describe("parseCellInput — date / datetime", () => {
  it("accepts ISO-8601 dates", () => {
    expect(expectOk(parseCellInput("2026-05-01", "date")).value).toBe("2026-05-01");
  });
  it("rejects malformed dates", () => {
    expect(parseCellInput("2026/05/01", "date").ok).toBe(false);
  });
  it("accepts datetime with seconds and timezone", () => {
    expect(
      expectOk(parseCellInput("2026-05-01T12:30:00Z", "datetime")).value,
    ).toBe("2026-05-01T12:30:00Z");
    expect(
      expectOk(parseCellInput("2026-05-01T12:30", "datetime")).value,
    ).toBe("2026-05-01T12:30");
  });
});

describe("parseCellInput — color", () => {
  it("normalises hex case", () => {
    expect(expectOk(parseCellInput("#ABCDEF", "color")).value).toBe("#abcdef");
  });
  it("accepts 3/4/6/8-digit hex", () => {
    expect(expectOk(parseCellInput("#abc", "color")).value).toBe("#abc");
    expect(expectOk(parseCellInput("#abcd", "color")).value).toBe("#abcd");
    expect(expectOk(parseCellInput("#11223344", "color")).value).toBe("#11223344");
  });
  it("rejects rgb() / named colors here (color-picker handles those)", () => {
    expect(parseCellInput("rgb(0,0,0)", "color").ok).toBe(false);
    expect(parseCellInput("red", "color").ok).toBe(false);
  });
});

describe("parseCellInput — list / tags / relation", () => {
  it("splits CSV strings and trims", () => {
    expect(expectOk(parseCellInput("a, b ,  c", "list")).value).toEqual(["a", "b", "c"]);
  });
  it("accepts arrays directly", () => {
    expect(expectOk(parseCellInput(["a", "b"], "list")).value).toEqual(["a", "b"]);
  });
  it("strips leading # for tags", () => {
    expect(expectOk(parseCellInput(["#alpha", "beta"], "tags")).value).toEqual(["alpha", "beta"]);
  });
  it("filters out empty entries", () => {
    expect(expectOk(parseCellInput(",,a,, ,b", "list")).value).toEqual(["a", "b"]);
  });
  it("preserves wikilink syntax for relation", () => {
    expect(
      expectOk(parseCellInput("[[Foo]], [[Bar]]", "relation")).value,
    ).toEqual(["[[Foo]]", "[[Bar]]"]);
  });
});

describe("formatCellValue", () => {
  it("round-trips booleans", () => {
    expect(formatCellValue(true, "boolean")).toBe("true");
    expect(formatCellValue(false, "boolean")).toBe("false");
  });
  it("formats arrays with commas", () => {
    expect(formatCellValue(["a", "b"], "list")).toBe("a, b");
  });
  it("re-prefixes # for tags", () => {
    expect(formatCellValue(["alpha", "beta"], "tags")).toBe("#alpha, #beta");
  });
  it("renders null as empty string", () => {
    expect(formatCellValue(null, "string")).toBe("");
  });
  it("stringifies numbers", () => {
    expect(formatCellValue(42, "number")).toBe("42");
  });
});
