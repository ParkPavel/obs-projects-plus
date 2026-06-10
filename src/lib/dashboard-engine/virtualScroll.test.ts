import {
  computeVirtualScroll,
  shouldVirtualize,
  getRowHeight,
} from "./virtualScroll";

describe("computeVirtualScroll", () => {
  const baseOpts = {
    itemCount: 500,
    rowHeight: 36,
    containerHeight: 400,
    overscan: 5,
  };

  it("should compute correct window at scrollTop=0", () => {
    const state = computeVirtualScroll(0, baseOpts);
    expect(state.startIndex).toBe(0);
    // ceil(400/36) = 12, + overscan 5 = 17
    expect(state.endIndex).toBe(17);
    expect(state.offsetTop).toBe(0);
    expect(state.totalHeight).toBe(500 * 36);
    expect(state.visibleCount).toBe(17);
  });

  it("should offset correctly when scrolled to middle", () => {
    // Scroll to ~row 100
    const scrollTop = 100 * 36;
    const state = computeVirtualScroll(scrollTop, baseOpts);
    expect(state.startIndex).toBe(95); // 100 - 5 overscan
    // floor(3600/36) = 100, ceil((3600+400)/36) = ceil(111.11) = 112
    // 112 + 5 = 117
    expect(state.endIndex).toBe(117);
    expect(state.offsetTop).toBe(95 * 36);
  });

  it("should clamp at end of list", () => {
    const scrollTop = 499 * 36; // near end
    const state = computeVirtualScroll(scrollTop, baseOpts);
    expect(state.endIndex).toBe(500);
    expect(state.startIndex).toBeLessThan(500);
  });

  it("should handle negative scrollTop", () => {
    const state = computeVirtualScroll(-100, baseOpts);
    expect(state.startIndex).toBe(0);
    expect(state.offsetTop).toBe(0);
  });

  it("should handle 0 items", () => {
    const state = computeVirtualScroll(0, { ...baseOpts, itemCount: 0 });
    expect(state.startIndex).toBe(0);
    expect(state.endIndex).toBe(0);
    expect(state.totalHeight).toBe(0);
    expect(state.visibleCount).toBe(0);
  });

  it("should handle 0 rowHeight", () => {
    const state = computeVirtualScroll(0, { ...baseOpts, rowHeight: 0 });
    expect(state.visibleCount).toBe(0);
  });

  it("should handle 0 containerHeight", () => {
    const state = computeVirtualScroll(0, { ...baseOpts, containerHeight: 0 });
    expect(state.visibleCount).toBe(0);
  });

  it("should use default overscan when not specified", () => {
    const state = computeVirtualScroll(0, {
      itemCount: 500,
      rowHeight: 36,
      containerHeight: 400,
    });
    // default overscan = 5, same as explicit
    expect(state.startIndex).toBe(0);
    expect(state.endIndex).toBe(17);
  });

  it("should render all items when count is small", () => {
    const state = computeVirtualScroll(0, {
      ...baseOpts,
      itemCount: 10,
    });
    expect(state.startIndex).toBe(0);
    expect(state.endIndex).toBe(10);
    expect(state.visibleCount).toBe(10);
  });
});

describe("shouldVirtualize", () => {
  it("should return false for small datasets", () => {
    expect(shouldVirtualize(50)).toBe(false);
    expect(shouldVirtualize(100)).toBe(false);
  });

  it("should return true above threshold", () => {
    expect(shouldVirtualize(101)).toBe(true);
    expect(shouldVirtualize(1000)).toBe(true);
  });
});

describe("getRowHeight", () => {
  it("should return correct heights for each density", () => {
    expect(getRowHeight("compact")).toBe(28);
    expect(getRowHeight("default")).toBe(36);
    expect(getRowHeight("expanded")).toBe(48);
  });
});
