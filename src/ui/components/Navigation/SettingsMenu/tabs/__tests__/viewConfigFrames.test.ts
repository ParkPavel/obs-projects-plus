import "@testing-library/jest-dom";
import { tick } from "svelte";

/**
 * cards-g5 — the view settings of a gallery and a board offer the view-wide
 * card height (empty = automatic) and a reset of every card frame. Each emits
 * a partial config update through the tab's `update` event, the path
 * SettingsMenuPopover persists, and the saved value reads back.
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

function viewOf(type: string, config: Record<string, unknown> = {}) {
  return {
    name: type,
    id: `view-${type}`,
    type,
    config,
    filter: { conjunction: "and", conditions: [] },
    colors: { conditions: [] },
    sort: { criteria: [] },
  };
}

function mount(type: string, config: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new ViewConfigTab({ target, props: { view: viewOf(type, config), fields: FIELDS } });
  const updates: Record<string, unknown>[] = [];
  component.$on("update", (e) => updates.push(e.detail));
  const q = <T extends Element>(selector: string) => target.querySelector<T>(selector);
  return {
    target,
    component,
    updates,
    height: () => q<HTMLInputElement>('input[data-card-frame-option="height"]'),
    reset: () => q<HTMLButtonElement>('button[data-card-frame-option="reset-all"]'),
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
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

describe.each(["gallery", "board"])("cards-g5 — %s settings: card frames", (viewType) => {
  it("a config without frames: empty (automatic) height, nothing to reset, nothing emitted", () => {
    const m = mount(viewType);
    expect(m.height()).not.toBeNull();
    expect(m.height()?.value).toBe("");
    expect(m.height()).toHaveAttribute("min", "6");
    expect(m.height()).toHaveAttribute("max", "40");
    expect(m.reset()).not.toBeNull();
    expect(m.reset()).toBeDisabled();
    expect(m.updates).toEqual([]);
    m.destroy();
  });

  it("the view height emits a partial cardFrame, clamped and snapped; empty clears it", async () => {
    const m = mount(viewType);
    const input = m.height() as HTMLInputElement;
    await type(input, "12");
    await type(input, "3");
    await type(input, "12.6");
    await type(input, "");
    expect(m.updates).toEqual([
      { cardFrame: { heightRem: 12 } },
      { cardFrame: { heightRem: 6 } },
      { cardFrame: { heightRem: 13 } },
      { cardFrame: undefined },
    ]);
    m.destroy();
  });

  it("clearing the height keeps a saved view span", async () => {
    const m = mount(viewType, { cardFrame: { heightRem: 12, gridSpan: 2 } });
    expect(m.height()?.value).toBe("12");
    await type(m.height() as HTMLInputElement, "");
    expect(m.updates).toEqual([{ cardFrame: { gridSpan: 2 } }]);
    m.destroy();
  });

  it("Reset all removes the view frame and every card's frame in one update", () => {
    const m = mount(viewType, {
      layout: "grid",
      cardFrame: { heightRem: 12 },
      cardFramesByRecord: { "notes/A.md": { heightRem: 20 } },
    });
    expect(m.reset()).not.toBeDisabled();
    m.reset()?.click();
    expect(m.updates).toEqual([{ cardFrame: undefined, cardFramesByRecord: undefined }]);
    m.destroy();
  });

  it("per-card frames alone are enough to offer the reset", () => {
    const m = mount(viewType, { cardFramesByRecord: { "notes/A.md": { gridSpan: 2 } } });
    expect(m.reset()).not.toBeDisabled();
    m.destroy();
  });

  it("a saved height reads back, and an updated view moves the control", async () => {
    const m = mount(viewType);
    await type(m.height() as HTMLInputElement, "15");
    const saved = Object.assign({}, ...m.updates) as Record<string, unknown>;
    m.destroy();
    const reopened = mount(viewType, JSON.parse(JSON.stringify(saved)));
    expect(reopened.height()?.value).toBe("15");
    expect(reopened.reset()).not.toBeDisabled();
    reopened.component.$set({ view: viewOf(viewType, {}) });
    await tick();
    expect(reopened.height()?.value).toBe("");
    expect(reopened.updates).toEqual([]);
    reopened.destroy();
  });
});

describe("cards-g5 — other views have no card frames", () => {
  it.each(["calendar", "table"])("%s", (viewType) => {
    const m = mount(viewType);
    expect(m.height()).toBeNull();
    expect(m.reset()).toBeNull();
    m.destroy();
  });
});
