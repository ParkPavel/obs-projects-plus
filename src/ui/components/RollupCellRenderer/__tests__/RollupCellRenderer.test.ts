/**
 * Tests for RollupCellRenderer (#045.4).
 *
 * JSDOM-level smoke + branch coverage:
 *   - percent group: bar with correct width
 *   - show group: chip strip / empty-placeholder
 *   - plain group: numeric formatting, list join, empty
 *   - modeId wins over fn when both present
 *   - clamp + scale 0..1 percent values
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";

import RollupCellRenderer from "../RollupCellRenderer.svelte";

describe("RollupCellRenderer — percent group", () => {
  test("renders a bar at the requested width with rounded label", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: 42, fn: "percent_not_empty" },
    });
    const bar = container.querySelector("[data-testid='ppp-rollup-bar']") as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute("style")).toContain("width: 42%");
    expect(container.textContent).toContain("42%");
  });

  test("clamps values above 100", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: 150, fn: "percent_empty" },
    });
    const bar = container.querySelector("[data-testid='ppp-rollup-bar']") as HTMLElement | null;
    expect(bar!.getAttribute("style")).toContain("width: 100%");
    expect(container.textContent).toContain("100%");
  });

  test("scales 0..1 (Notion-style) to 0..100 range", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: 0.37, fn: "percent_true" },
    });
    const bar = container.querySelector("[data-testid='ppp-rollup-bar']") as HTMLElement | null;
    expect(bar!.getAttribute("style")).toContain("width: 37%");
  });

  test("accepts a string like '25%'", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: "25%", fn: "percent_not_empty" },
    });
    const bar = container.querySelector("[data-testid='ppp-rollup-bar']") as HTMLElement | null;
    expect(bar!.getAttribute("style")).toContain("width: 25%");
  });
});

describe("RollupCellRenderer — show group", () => {
  test("renders chips from a comma-separated string", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: "alpha, beta, gamma", fn: "show_unique" },
    });
    const chips = Array.from(container.querySelectorAll(".ppp-rollup-chip"));
    expect(chips.length).toBe(3);
    expect(chips[0]?.textContent).toBe("alpha");
    expect(chips[1]?.textContent).toBe("beta");
    expect(chips[2]?.textContent).toBe("gamma");
  });

  test("renders chips from a string array", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: ["a", "b"], fn: "show_original" },
    });
    const chips = container.querySelectorAll(".ppp-rollup-chip");
    expect(chips.length).toBe(2);
  });

  test("renders an empty placeholder when value is empty", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: "", fn: "show_unique" },
    });
    expect(container.querySelector(".ppp-rollup-empty")).not.toBeNull();
    expect(container.textContent).toContain("—");
  });

  test("renders an empty placeholder when array is empty", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: [], fn: "show_unique" },
    });
    expect(container.querySelector(".ppp-rollup-empty")).not.toBeNull();
  });

  test("handles concat fn as show-group (legacy mapping)", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: "x, y", fn: "concat" },
    });
    expect(container.querySelectorAll(".ppp-rollup-chip").length).toBe(2);
  });
});

describe("RollupCellRenderer — plain (count / more) group", () => {
  test("renders an integer count as-is", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: 7, fn: "count_values" },
    });
    expect(container.querySelector(".ppp-rollup-plain")?.textContent).toBe("7");
  });

  test("renders a float with precision=2 by default", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: 3.14159, fn: "avg" },
    });
    expect(container.querySelector(".ppp-rollup-plain")?.textContent).toBe("3.14");
  });

  test("respects custom precision", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: 3.14159, fn: "avg", precision: 4 },
    });
    expect(container.querySelector(".ppp-rollup-plain")?.textContent).toBe("3.1416");
  });

  test("renders empty placeholder for null", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: null, fn: "sum" },
    });
    expect(container.querySelector(".ppp-rollup-plain")?.textContent).toBe("—");
  });

  test("renders a date as YYYY-MM-DD", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: new Date("2024-03-15T12:00:00Z"), fn: "min" },
    });
    expect(container.querySelector(".ppp-rollup-plain")?.textContent).toBe("2024-03-15");
  });

  test("supports custom emptyPlaceholder", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: null, fn: "sum", emptyPlaceholder: "(none)" },
    });
    expect(container.querySelector(".ppp-rollup-plain")?.textContent).toBe("(none)");
  });
});

describe("RollupCellRenderer — modeId resolution", () => {
  test("modeId='percent_per_group' overrides fn='count' and renders a bar", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: 60, modeId: "percent_per_group", fn: "count" },
    });
    expect(container.querySelector("[data-testid='ppp-rollup-bar']")).not.toBeNull();
  });

  test("modeId='show_original' renders chips even with fn='count'", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: "a, b", modeId: "show_original", fn: "count" },
    });
    expect(container.querySelectorAll(".ppp-rollup-chip").length).toBe(2);
  });

  test("unknown modeId falls back to fn-based resolution", () => {
    const { container } = render(RollupCellRenderer, {
      // Cast through unknown — testing the runtime fallback for corrupted saves.
      props: { value: 5, modeId: "unknown_mode" as unknown as never, fn: "count_values" },
    });
    expect(container.querySelector(".ppp-rollup-plain")?.textContent).toBe("5");
  });
});

describe("RollupCellRenderer — group attribute", () => {
  test("sets data-rollup-group attribute for downstream styling", () => {
    const { container } = render(RollupCellRenderer, {
      props: { value: 50, modeId: "percent_not_empty" },
    });
    const cell = container.querySelector(".ppp-rollup-cell") as HTMLElement;
    expect(cell.getAttribute("data-rollup-group")).toBe("percent");
  });
});
