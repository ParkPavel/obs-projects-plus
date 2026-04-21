import {
  SPACE,
  BREAKPOINTS,
  TOUCH,
  ROW_HEIGHT,
  RADIUS,
  getDesignTokenCSS,
  CONTAINER_NAMES,
} from "../designTokens";

describe("designTokens", () => {
  describe("token constants", () => {
    test("SPACE has expected keys", () => {
      expect(SPACE.xxs).toBe("0.125rem");
      expect(SPACE.md).toBe("0.5rem");
      expect(SPACE["2xl"]).toBe("1.5rem");
    });

    test("BREAKPOINTS has expected keys", () => {
      expect(BREAKPOINTS.compact).toBe("20rem");
      expect(BREAKPOINTS.wide).toBe("60rem");
    });

    test("TOUCH sizes meet minimum requirements", () => {
      // 44px = 2.75rem is standard touch target
      expect(TOUCH.coarse).toBe("2.75rem");
      expect(TOUCH.fine).toBe("2rem");
    });

    test("ROW_HEIGHT has 3 density levels", () => {
      expect(Object.keys(ROW_HEIGHT)).toHaveLength(3);
      expect(ROW_HEIGHT.compact).toBeDefined();
      expect(ROW_HEIGHT.default).toBeDefined();
      expect(ROW_HEIGHT.expanded).toBeDefined();
    });

    test("RADIUS has expected keys", () => {
      expect(RADIUS.sm).toBe("0.25rem");
      expect(RADIUS.pill).toBe("62.5rem");
    });
  });

  describe("getDesignTokenCSS", () => {
    test("generates non-empty CSS string", () => {
      const css = getDesignTokenCSS();
      expect(css).toBeTruthy();
      expect(typeof css).toBe("string");
    });

    test("includes space tokens", () => {
      const css = getDesignTokenCSS();
      expect(css).toContain("--ppp-space-md: 0.5rem");
      expect(css).toContain("--ppp-space-xs: 0.25rem");
    });

    test("includes breakpoint tokens", () => {
      const css = getDesignTokenCSS();
      expect(css).toContain("--ppp-bp-compact: 20rem");
      expect(css).toContain("--ppp-bp-wide: 60rem");
    });

    test("includes touch tokens", () => {
      const css = getDesignTokenCSS();
      expect(css).toContain("--ppp-touch-coarse: 2.75rem");
      expect(css).toContain("--ppp-touch-fine: 2rem");
    });

    test("includes row height tokens", () => {
      const css = getDesignTokenCSS();
      expect(css).toContain("--ppp-row-default:");
      expect(css).toContain("--ppp-row-compact:");
    });

    test("includes radius tokens", () => {
      const css = getDesignTokenCSS();
      expect(css).toContain("--ppp-radius-sm: 0.25rem");
      expect(css).toContain("--ppp-radius-pill: 62.5rem");
    });
  });

  describe("CONTAINER_NAMES", () => {
    test("has expected container names", () => {
      expect(CONTAINER_NAMES.canvas).toBe("canvas");
      expect(CONTAINER_NAMES.widget).toBe("widget");
      expect(CONTAINER_NAMES.table).toBe("table");
    });
  });
});
