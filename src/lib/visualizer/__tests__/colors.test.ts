import {
  HEX_COLOR_TOKEN_RE,
  hexLuminance,
  isColorValue,
  normalizeColor,
} from "../colors";

describe("isColorValue", () => {
  it("recognises hex shorthand and full forms", () => {
    expect(isColorValue("#fff")).toBe(true);
    expect(isColorValue("#FFFFFF")).toBe(true);
    expect(isColorValue("#1a2b3c")).toBe(true);
    expect(isColorValue("#1a2b3c4d")).toBe(true);
  });

  it("recognises functional notations", () => {
    expect(isColorValue("rgb(0, 0, 0)")).toBe(true);
    expect(isColorValue("rgba(255, 0, 0, 0.5)")).toBe(true);
    expect(isColorValue("hsl(120, 50%, 40%)")).toBe(true);
    expect(isColorValue("hsla(120, 50%, 40%, 0.7)")).toBe(true);
  });

  it("recognises curated named colors (case-insensitive)", () => {
    expect(isColorValue("red")).toBe(true);
    expect(isColorValue("WHITE")).toBe(true);
    expect(isColorValue("transparent")).toBe(true);
  });

  it("rejects ambiguous words and non-strings", () => {
    expect(isColorValue("tomato")).toBe(false);
    expect(isColorValue("rebeccapurple")).toBe(false);
    expect(isColorValue("")).toBe(false);
    expect(isColorValue(null)).toBe(false);
    expect(isColorValue(123)).toBe(false);
    expect(isColorValue("#xyz")).toBe(false);
    expect(isColorValue("not a color")).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(isColorValue("  #ff0000  ")).toBe(true);
  });
});

describe("normalizeColor", () => {
  it("lowercases hex", () => {
    expect(normalizeColor("#ABCDEF")).toBe("#abcdef");
  });

  it("preserves functional notation as-is", () => {
    expect(normalizeColor("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
  });

  it("returns null for non-colors", () => {
    expect(normalizeColor("garbage")).toBeNull();
    expect(normalizeColor(42)).toBeNull();
  });
});

describe("hexLuminance", () => {
  it("returns 1 for white and ~0 for black", () => {
    expect(hexLuminance("#fff")).toBeGreaterThan(0.95);
    expect(hexLuminance("#000")).toBeLessThan(0.05);
  });

  it("returns mid-range for greys", () => {
    const lum = hexLuminance("#808080");
    expect(lum).toBeGreaterThan(0.4);
    expect(lum).toBeLessThan(0.6);
  });

  it("returns 0.5 sentinel for unparseable input", () => {
    expect(hexLuminance("not a hex")).toBe(0.5);
  });
});

describe("HEX_COLOR_TOKEN_RE", () => {
  it("matches inline hex tokens in body text", () => {
    const text = "Use #ff0000 or #abc as accents, but not #zzz.";
    const matches = text.match(HEX_COLOR_TOKEN_RE);
    expect(matches).toEqual(["#ff0000", "#abc"]);
  });

  it("does not match adjacent garbage characters", () => {
    HEX_COLOR_TOKEN_RE.lastIndex = 0;
    const text = "id=#abcdefghi #fff";
    const matches = text.match(HEX_COLOR_TOKEN_RE);
    expect(matches).toEqual(["#fff"]);
  });
});
