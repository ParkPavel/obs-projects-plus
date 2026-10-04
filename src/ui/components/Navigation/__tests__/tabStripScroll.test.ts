import { describe, it, expect } from "@jest/globals";
import { getTabStripScrollLeft } from "../tabStripScroll";

describe("getTabStripScrollLeft (mobile-k1)", () => {
  const strip = { clientWidth: 300, scrollWidth: 800, scrollLeft: 0, rtl: false };

  it("centres a tab in the middle of the strip", () => {
    // tab centre = 400 + 40 = 440; target = 440 - 150 = 290
    expect(getTabStripScrollLeft({ ...strip, tabLeft: 400, tabWidth: 80 })).toBe(290);
  });

  it("accounts for the current scroll position", () => {
    // content x = 100 + 200 = 300; centre 340; target 190
    expect(getTabStripScrollLeft({ ...strip, scrollLeft: 200, tabLeft: 100, tabWidth: 80 })).toBe(190);
  });

  it("clamps to 0 for a tab near the start", () => {
    expect(getTabStripScrollLeft({ ...strip, tabLeft: 0, tabWidth: 80 })).toBe(0);
  });

  it("clamps to scrollWidth - clientWidth for a tab near the end", () => {
    expect(getTabStripScrollLeft({ ...strip, tabLeft: 720, tabWidth: 80 })).toBe(500);
  });

  it("returns 0 when the strip does not overflow", () => {
    expect(
      getTabStripScrollLeft({ ...strip, scrollWidth: 300, tabLeft: 100, tabWidth: 80 })
    ).toBe(0);
  });

  it("never returns a negative offset for a strip narrower than its viewport", () => {
    expect(
      getTabStripScrollLeft({ ...strip, scrollWidth: 200, tabLeft: 100, tabWidth: 80 })
    ).toBe(0);
  });

  describe("rtl", () => {
    const rtlStrip = { clientWidth: 300, scrollWidth: 800, scrollLeft: 0, rtl: true };

    it("centres a middle tab with a negative scrollLeft", () => {
      // max 500; scrollLeft -500 -> origin 0; content x = 400; centred = 440 - 150 = 290;
      // result = 290 - 500 = -210
      expect(
        getTabStripScrollLeft({ ...rtlStrip, scrollLeft: -500, tabLeft: 400, tabWidth: 80 })
      ).toBe(-210);
    });

    it("clamps to 0 for a tab at the start (right edge)", () => {
      // scrollLeft 0: origin 500; tab at the right edge, content x = 220 + 500 = 720, centred 610 clamps to 500
      expect(getTabStripScrollLeft({ ...rtlStrip, tabLeft: 220, tabWidth: 80 })).toBe(0);
    });

    it("clamps to -max for a tab at the far end (left edge)", () => {
      expect(
        getTabStripScrollLeft({ ...rtlStrip, scrollLeft: -500, tabLeft: 0, tabWidth: 80 })
      ).toBe(-500);
    });

    it("returns 0 when the strip does not overflow", () => {
      expect(
        getTabStripScrollLeft({ ...rtlStrip, scrollWidth: 300, tabLeft: 100, tabWidth: 80 })
      ).toBe(0);
    });
  });
});
