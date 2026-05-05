import {
  ariaGrid,
  ariaGridCell,
  ariaWidget,
  navigateGrid,
  navigateList,
} from "../engine/accessibility";

describe("accessibility", () => {
  describe("ariaGrid", () => {
    test("generates grid ARIA props", () => {
      const props = ariaGrid("Test Grid", 10, 5);
      expect(props.role).toBe("grid");
      expect(props["aria-rowcount"]).toBe(10);
      expect(props["aria-colcount"]).toBe(5);
      expect(props["aria-label"]).toBe("Test Grid");
    });
  });

  describe("ariaGridCell", () => {
    test("generates active cell props", () => {
      const props = ariaGridCell(2, 3, true);
      expect(props.role).toBe("gridcell");
      expect(props["aria-rowindex"]).toBe(2);
      expect(props["aria-colindex"]).toBe(3);
      expect(props.tabindex).toBe(0);
    });

    test("generates inactive cell props", () => {
      const props = ariaGridCell(1, 1, false);
      expect(props.tabindex).toBe(-1);
    });
  });

  describe("ariaWidget", () => {
    test("generates widget ARIA props", () => {
      const props = ariaWidget("Stats Widget");
      expect(props.role).toBe("region");
      expect(props["aria-label"]).toBe("Stats Widget");
      expect(props.tabindex).toBe(0);
    });
  });

  describe("navigateGrid", () => {
    const maxRow = 5;
    const maxCol = 4;

    test("ArrowDown moves row down", () => {
      const result = navigateGrid({ row: 1, col: 2 }, "ArrowDown", maxRow, maxCol);
      expect(result).toEqual({ row: 2, col: 2 });
    });

    test("ArrowUp moves row up", () => {
      const result = navigateGrid({ row: 2, col: 0 }, "ArrowUp", maxRow, maxCol);
      expect(result).toEqual({ row: 1, col: 0 });
    });

    test("ArrowRight moves col right", () => {
      const result = navigateGrid({ row: 0, col: 1 }, "ArrowRight", maxRow, maxCol);
      expect(result).toEqual({ row: 0, col: 2 });
    });

    test("ArrowLeft moves col left", () => {
      const result = navigateGrid({ row: 0, col: 2 }, "ArrowLeft", maxRow, maxCol);
      expect(result).toEqual({ row: 0, col: 1 });
    });

    test("Home jumps to first column", () => {
      const result = navigateGrid({ row: 3, col: 3 }, "Home", maxRow, maxCol);
      expect(result).toEqual({ row: 3, col: 0 });
    });

    test("End jumps to last column", () => {
      const result = navigateGrid({ row: 3, col: 0 }, "End", maxRow, maxCol);
      expect(result).toEqual({ row: 3, col: 3 });
    });

    test("returns null for out-of-bounds up", () => {
      expect(navigateGrid({ row: 0, col: 0 }, "ArrowUp", maxRow, maxCol)).toBeNull();
    });

    test("returns null for out-of-bounds down", () => {
      expect(navigateGrid({ row: 4, col: 0 }, "ArrowDown", maxRow, maxCol)).toBeNull();
    });

    test("returns null for out-of-bounds left", () => {
      expect(navigateGrid({ row: 0, col: 0 }, "ArrowLeft", maxRow, maxCol)).toBeNull();
    });

    test("returns null for out-of-bounds right", () => {
      expect(navigateGrid({ row: 0, col: 3 }, "ArrowRight", maxRow, maxCol)).toBeNull();
    });

    test("returns null for unknown key", () => {
      expect(navigateGrid({ row: 1, col: 1 }, "Enter", maxRow, maxCol)).toBeNull();
    });
  });

  describe("navigateList", () => {
    test("ArrowDown moves to next item", () => {
      expect(navigateList(2, "ArrowDown", 5)).toBe(3);
    });

    test("ArrowUp moves to previous item", () => {
      expect(navigateList(2, "ArrowUp", 5)).toBe(1);
    });

    test("returns null for ArrowUp at start", () => {
      expect(navigateList(0, "ArrowUp", 5)).toBeNull();
    });

    test("returns null for ArrowDown at end", () => {
      expect(navigateList(4, "ArrowDown", 5)).toBeNull();
    });

    test("Home returns 0", () => {
      expect(navigateList(3, "Home", 5)).toBe(0);
    });

    test("End returns last index", () => {
      expect(navigateList(0, "End", 5)).toBe(4);
    });

    test("returns null for unknown key", () => {
      expect(navigateList(2, "Tab", 5)).toBeNull();
    });
  });
});
