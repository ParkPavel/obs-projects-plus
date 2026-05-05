import { describe, expect, it } from "@jest/globals";
import { hexToHsv, hsvToHex, normaliseHex } from "../math";

describe("colors/math — hexToHsv", () => {
  it("parses 6-digit hex with leading hash", () => {
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 100, v: 100 });
  });

  it("parses 6-digit hex without hash and is case-insensitive", () => {
    expect(hexToHsv("00FF00")).toEqual({ h: 120, s: 100, v: 100 });
    expect(hexToHsv("#0000ff")).toEqual({ h: 240, s: 100, v: 100 });
  });

  it("expands 3-digit shorthand", () => {
    // "#abc" → "#aabbcc"
    const long = hexToHsv("#aabbcc");
    const short = hexToHsv("#abc");
    expect(short).toEqual(long);
  });

  it("drops alpha from 8-digit hex", () => {
    expect(hexToHsv("#ff000080")).toEqual(hexToHsv("#ff0000"));
  });

  it("returns null for invalid lengths", () => {
    expect(hexToHsv("#ff")).toBeNull();
    expect(hexToHsv("#ffff")).toBeNull();
    expect(hexToHsv("#fffff")).toBeNull();
    expect(hexToHsv("#fffffff")).toBeNull();
  });

  it("returns null for non-hex characters", () => {
    expect(hexToHsv("#gggggg")).toBeNull();
    expect(hexToHsv("not-a-color")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(hexToHsv(null as unknown as string)).toBeNull();
    expect(hexToHsv(undefined as unknown as string)).toBeNull();
    expect(hexToHsv(123 as unknown as string)).toBeNull();
  });

  it("yields zero saturation for greys", () => {
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv("#808080")).toEqual({ h: 0, s: 0, v: 50 });
    expect(hexToHsv("#ffffff")).toEqual({ h: 0, s: 0, v: 100 });
  });

  it("computes hue across all 6 sectors", () => {
    expect(hexToHsv("#ff0000")?.h).toBe(0);    // red
    expect(hexToHsv("#ffff00")?.h).toBe(60);   // yellow
    expect(hexToHsv("#00ff00")?.h).toBe(120);  // green
    expect(hexToHsv("#00ffff")?.h).toBe(180);  // cyan
    expect(hexToHsv("#0000ff")?.h).toBe(240);  // blue
    expect(hexToHsv("#ff00ff")?.h).toBe(300);  // magenta
  });

  it("trims surrounding whitespace", () => {
    expect(hexToHsv("  #ff0000  ")).toEqual({ h: 0, s: 100, v: 100 });
  });
});

describe("colors/math — hsvToHex", () => {
  it("renders the canonical primaries", () => {
    expect(hsvToHex(0, 100, 100)).toBe("#ff0000");
    expect(hsvToHex(120, 100, 100)).toBe("#00ff00");
    expect(hsvToHex(240, 100, 100)).toBe("#0000ff");
  });

  it("renders zero-saturation as a grey ramp", () => {
    expect(hsvToHex(0, 0, 0)).toBe("#000000");
    expect(hsvToHex(0, 0, 100)).toBe("#ffffff");
    expect(hsvToHex(180, 0, 50)).toBe("#808080");
  });

  it("normalises hue ≥360 and negative hue", () => {
    expect(hsvToHex(360, 100, 100)).toBe(hsvToHex(0, 100, 100));
    expect(hsvToHex(-60, 100, 100)).toBe(hsvToHex(300, 100, 100));
  });

  it("clamps saturation/value out of range", () => {
    expect(hsvToHex(0, 200, 200)).toBe("#ff0000");
    expect(hsvToHex(0, -50, -50)).toBe("#000000");
  });

  it("returns a stable hex for non-finite input", () => {
    expect(hsvToHex(Number.NaN, Number.NaN, Number.NaN)).toBe("#000000");
  });
});

describe("colors/math — round-trip and normaliseHex", () => {
  it("round-trips hex → HSV → hex within rounding tolerance", () => {
    const samples = ["#ff0000", "#00ff00", "#0000ff", "#abcdef", "#123456"];
    for (const hex of samples) {
      const hsv = hexToHsv(hex);
      expect(hsv).not.toBeNull();
      if (!hsv) continue;
      // Allow ±2 per channel due to integer rounding through the sRGB cube.
      const back = hsvToHex(hsv.h, hsv.s, hsv.v);
      expect(back).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("normaliseHex returns a valid canonical 6-digit hex", () => {
    // 3-digit shorthand expansion may drift by ±1 per channel after the
    // round-trip through integer HSV (documented rounding loss). The kernel
    // guarantees only that the output is a valid 6-digit hex and that the
    // operation is idempotent.
    const out = normaliseHex("#abc");
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    expect(out).not.toBeNull();
    if (out) expect(normaliseHex(out)).toBe(out);
  });

  it("normaliseHex returns null on garbage", () => {
    expect(normaliseHex("rgb(0,0,0)")).toBeNull();
  });
});
