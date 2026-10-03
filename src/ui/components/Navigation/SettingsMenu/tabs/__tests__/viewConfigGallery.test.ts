import "@testing-library/jest-dom";
import { tick } from "svelte";

/**
 * cards-g3 — the gallery section of the view settings offers layout, size
 * presets with the numeric width, cover ratio, fit and field labels. Each
 * control emits a partial config update through the tab's `update` event, the
 * path SettingsMenuPopover persists, and reads the saved value back.
 */

type Mounted = {
  $destroy(): void;
  $set(props: Record<string, unknown>): void;
  $on(event: string, handler: (e: CustomEvent<Record<string, unknown>>) => void): () => void;
};
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const ViewConfigTab = require("../ViewConfigTab.svelte").default as ComponentClass;

const FIELDS = [
  { name: "status", type: "string" },
  { name: "cover", type: "string" },
];

function galleryView(config: Record<string, unknown> = {}) {
  return {
    name: "Gallery",
    id: "view-gallery",
    type: "gallery",
    config,
    filter: { conjunction: "and", conditions: [] },
    colors: { conditions: [] },
    sort: { criteria: [] },
  };
}

function mount(config: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new ViewConfigTab({ target, props: { view: galleryView(config), fields: FIELDS } });
  const updates: Record<string, unknown>[] = [];
  component.$on("update", (e) => updates.push(e.detail));
  const q = <T extends Element>(selector: string) => target.querySelector<T>(selector) as T;
  return {
    component,
    updates,
    layout: () => q<HTMLSelectElement>('select[data-gallery-option="layout"]'),
    ratio: () => q<HTMLSelectElement>('select[data-gallery-option="aspect-ratio"]'),
    fit: () => q<HTMLSelectElement>('select[data-gallery-option="fit"]'),
    labels: () => q<HTMLInputElement>('input[data-gallery-option="labels"]'),
    preset: (size: string) => q<HTMLButtonElement>(`button[data-gallery-size="${size}"]`),
    width: () => q<HTMLInputElement>('input[type="number"]'),
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

function choose(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("cards-g3 — gallery settings read a config without the new keys as the defaults", () => {
  it("grid, 16/10, cover, labels on, width 300 = the medium preset", () => {
    const m = mount();
    expect(m.layout().value).toBe("grid");
    expect(Array.from(m.layout().options).map((o) => o.value)).toEqual(["grid", "masonry", "list"]);
    expect(m.ratio().value).toBe("16/10");
    expect(Array.from(m.ratio().options).map((o) => o.value)).toEqual(["16/10", "4/3", "1/1", "3/4", "2/3", "none"]);
    expect(m.fit().value).toBe("cover");
    expect(m.labels().checked).toBe(true);
    expect(m.width().value).toBe("300");
    expect(m.preset("m")).toHaveAttribute("aria-pressed", "true");
    expect(m.preset("s")).toHaveAttribute("aria-pressed", "false");
    expect(m.preset("l")).toHaveAttribute("aria-pressed", "false");
    expect(m.updates).toEqual([]);
    m.destroy();
  });

  it("a legacy fill fit is shown as itself, not as a blank select", () => {
    const m = mount({ fitStyle: "fill" });
    expect(m.fit().value).toBe("fill");
    m.destroy();
  });
});

describe("cards-g3 — each gallery control emits a partial update", () => {
  it("layout", () => {
    const m = mount();
    choose(m.layout(), "masonry");
    choose(m.layout(), "list");
    expect(m.updates).toEqual([{ layout: "masonry" }, { layout: "list" }]);
    m.destroy();
  });

  it("size presets write the numeric cardWidth", async () => {
    const m = mount();
    m.preset("s").click();
    await tick();
    expect(m.preset("s")).toHaveAttribute("aria-pressed", "true");
    expect(m.preset("m")).toHaveAttribute("aria-pressed", "false");
    expect(m.width().value).toBe("200");
    m.preset("l").click();
    expect(m.updates).toEqual([{ cardWidth: 200 }, { cardWidth: 400 }]);
    m.destroy();
  });

  it("the width field still writes any width, and a custom width presses no preset", async () => {
    const m = mount();
    m.width().value = "250";
    m.width().dispatchEvent(new Event("input", { bubbles: true }));
    m.width().dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    expect(m.updates).toEqual([{ cardWidth: 250 }]);
    for (const size of ["s", "m", "l"]) expect(m.preset(size)).toHaveAttribute("aria-pressed", "false");
    m.destroy();
  });

  it("cover aspect ratio, none included", () => {
    const m = mount();
    choose(m.ratio(), "3/4");
    choose(m.ratio(), "none");
    expect(m.updates).toEqual([{ coverAspectRatio: "3/4" }, { coverAspectRatio: "none" }]);
    m.destroy();
  });

  it("fit", () => {
    const m = mount();
    choose(m.fit(), "contain");
    expect(m.updates).toEqual([{ fitStyle: "contain" }]);
    m.destroy();
  });

  it("field labels", () => {
    const m = mount();
    m.labels().click();
    expect(m.updates).toEqual([{ showFieldLabels: false }]);
    m.destroy();
  });
});

describe("cards-g3 — the saved values round-trip into the controls", () => {
  it("a config written by the controls is read back by them", async () => {
    const m = mount();
    choose(m.layout(), "list");
    choose(m.ratio(), "1/1");
    choose(m.fit(), "contain");
    m.labels().click();
    m.preset("l").click();
    const saved = Object.assign({}, ...m.updates) as Record<string, unknown>;
    expect(saved).toEqual({ layout: "list", coverAspectRatio: "1/1", fitStyle: "contain", showFieldLabels: false, cardWidth: 400 });

    m.destroy();
    const reopened = mount(saved);
    await tick();
    expect(reopened.layout().value).toBe("list");
    expect(reopened.ratio().value).toBe("1/1");
    expect(reopened.fit().value).toBe("contain");
    expect(reopened.labels().checked).toBe(false);
    expect(reopened.width().value).toBe("400");
    expect(reopened.preset("l")).toHaveAttribute("aria-pressed", "true");
    reopened.destroy();
  });

  it("an updated view prop moves the controls with it", async () => {
    const m = mount();
    m.component.$set({ view: galleryView({ layout: "masonry", coverAspectRatio: "2/3" }) });
    await tick();
    expect(m.layout().value).toBe("masonry");
    expect(m.ratio().value).toBe("2/3");
    m.destroy();
  });
});
