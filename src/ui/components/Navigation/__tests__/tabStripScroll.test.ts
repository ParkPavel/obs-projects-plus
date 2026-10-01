import { describe, it, expect } from "@jest/globals";
import { getTabStripScrollLeft } from "../tabStripScroll";

describe("getTabStripScrollLeft (mobile-k1)", () => {
  const strip = { clientWidth: 300, scrollWidth: 800 };

  it("centres a tab in the middle of the strip", () => {
    // tab centre = 400 + 40 = 440; target = 440 - 150 = 290
    expect(getTabStripScrollLeft({ ...strip, tabOffset: 400, tabWidth: 80 })).toBe(290);
  });

  it("clamps to 0 for a tab near the start", () => {
    expect(getTabStripScrollLeft({ ...strip, tabOffset: 0, tabWidth: 80 })).toBe(0);
  });

  it("clamps to scrollWidth - clientWidth for a tab near the end", () => {
    expect(getTabStripScrollLeft({ ...strip, tabOffset: 720, tabWidth: 80 })).toBe(500);
  });

  it("returns 0 when the strip does not overflow", () => {
    expect(
      getTabStripScrollLeft({ clientWidth: 300, scrollWidth: 300, tabOffset: 100, tabWidth: 80 })
    ).toBe(0);
  });

  it("never returns a negative offset for a strip narrower than its viewport", () => {
    expect(
      getTabStripScrollLeft({ clientWidth: 300, scrollWidth: 200, tabOffset: 100, tabWidth: 80 })
    ).toBe(0);
  });
});
