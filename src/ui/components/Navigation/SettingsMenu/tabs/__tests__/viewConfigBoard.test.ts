import "@testing-library/jest-dom";
import { tick } from "svelte";

/**
 * cards-g4 — the board section of the view settings offers the card
 * thumbnail layout and the cover field it reads (the gallery's field picker).
 * Each emits a partial config update through the tab's `update` event, the
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
  { name: "rank", type: "number" },
];

function boardView(config: Record<string, unknown> = {}) {
  return {
    name: "Board",
    id: "view-board",
    type: "board",
    config,
    filter: { conjunction: "and", conditions: [] },
    colors: { conditions: [] },
    sort: { criteria: [] },
  };
}

function mount(config: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new ViewConfigTab({ target, props: { view: boardView(config), fields: FIELDS } });
  const updates: Record<string, unknown>[] = [];
  component.$on("update", (e) => updates.push(e.detail));
  const q = <T extends Element>(selector: string) => target.querySelector<T>(selector) as T;
  return {
    target,
    component,
    updates,
    layout: () => q<HTMLSelectElement>('select[data-board-option="thumbnail-layout"]'),
    cover: () => q<HTMLInputElement>("#fieldlist-cover-board-input"),
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

async function type(input: HTMLInputElement, value: string): Promise<void> {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await tick();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("cards-g4 — board settings offer thumbnails", () => {
  it("a config without the keys reads as none and no cover field, and emits nothing", () => {
    const m = mount();
    expect(m.layout()).not.toBeNull();
    expect(m.layout().value).toBe("none");
    expect(Array.from(m.layout().options).map((o) => o.value)).toEqual(["none", "top", "left"]);
    // Labels come from the board keys, not a hard-coded string.
    expect(Array.from(m.layout().options).map((o) => o.textContent)).toEqual([
      "settings-menu.view-config.board.thumbnail-options.none",
      "settings-menu.view-config.board.thumbnail-options.top",
      "settings-menu.view-config.board.thumbnail-options.left",
    ]);
    expect(m.cover()).not.toBeNull();
    expect(m.cover().value).toBe("");
    // The cover picker offers the text fields, as the gallery's does.
    const options = Array.from(m.target.querySelectorAll("datalist#fieldlist-cover-board option")).map((o) =>
      o.getAttribute("value")
    );
    expect(options).toEqual(["status", "cover"]);
    expect(m.updates).toEqual([]);
    m.destroy();
  });

  it("an unknown saved layout is shown as none", () => {
    const m = mount({ thumbnailLayout: "diagonal" });
    expect(m.layout().value).toBe("none");
    m.destroy();
  });

  it("the gallery's own controls are not in the board section", () => {
    const m = mount();
    expect(m.target.querySelector("#fieldlist-cover-input")).toBeNull();
    expect(m.target.querySelector("[data-gallery-option]")).toBeNull();
    m.destroy();
  });
});

describe("cards-g4 — each board thumbnail control emits a partial update", () => {
  it("layout", () => {
    const m = mount();
    choose(m.layout(), "top");
    choose(m.layout(), "left");
    choose(m.layout(), "none");
    expect(m.updates).toEqual([{ thumbnailLayout: "top" }, { thumbnailLayout: "left" }, { thumbnailLayout: "none" }]);
    m.destroy();
  });

  it("cover field, and clearing it", async () => {
    const m = mount();
    await type(m.cover(), "cover");
    await type(m.cover(), "");
    expect(m.updates).toEqual([{ coverField: "cover" }, { coverField: undefined }]);
    m.destroy();
  });
});

describe("cards-g4 — the saved values round-trip into the controls", () => {
  it("a config written by the controls is read back by them", async () => {
    const m = mount();
    choose(m.layout(), "left");
    await type(m.cover(), "cover");
    const saved = Object.assign({}, ...m.updates) as Record<string, unknown>;
    expect(saved).toEqual({ thumbnailLayout: "left", coverField: "cover" });

    m.destroy();
    const reopened = mount(saved);
    await tick();
    expect(reopened.layout().value).toBe("left");
    expect(reopened.cover().value).toBe("cover");
    expect(reopened.updates).toEqual([]);
    reopened.destroy();
  });

  it("an updated view prop moves the controls with it", async () => {
    const m = mount();
    m.component.$set({ view: boardView({ thumbnailLayout: "top", coverField: "cover" }) });
    await tick();
    expect(m.layout().value).toBe("top");
    expect(m.cover().value).toBe("cover");
    m.destroy();
  });
});
