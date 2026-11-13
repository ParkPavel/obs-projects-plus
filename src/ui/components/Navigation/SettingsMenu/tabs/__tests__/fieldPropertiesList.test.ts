import "@testing-library/jest-dom";
import { tick } from "svelte";
import { fieldRows, reorderShown, withHidden, matchesFieldQuery } from "../fieldListModel";

/**
 * i3-final (B4) — «Properties» in View settings: one list with a search box,
 * an eye per row, order by drag or the arrow keys, hidden fields in a
 * collapsed group. Mounted through ViewConfigTab, so what is checked is the
 * partial update the tab emits — the path SettingsMenuPopover persists.
 */

type Mounted = {
  $destroy(): void;
  $set(props: Record<string, unknown>): void;
  $on(event: string, handler: (e: CustomEvent<Record<string, unknown>>) => void): () => void;
};
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const ViewConfigTab = require("../ViewConfigTab.svelte").default as ComponentClass;

const FIELDS = [
  { name: "name", type: "string" },
  { name: "status", type: "string" },
  { name: "owner", type: "string" },
  { name: "path", type: "string" },
  { name: "due", type: "date" },
];

function dashboard(table: Record<string, unknown> = {}) {
  return {
    name: "Dashboard",
    id: "view-dash",
    type: "dashboard",
    config: { table },
    filter: { conjunction: "and", conditions: [] },
    colors: { conditions: [] },
    sort: { criteria: [] },
  };
}

function mount(table: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new ViewConfigTab({ target, props: { view: dashboard(table), fields: FIELDS } });
  const updates: Record<string, unknown>[] = [];
  component.$on("update", (e) => updates.push(e.detail));
  const rowNames = (selector: string) =>
    Array.from(target.querySelectorAll<HTMLElement>(`${selector} [data-view-property]`)).map((el) => el.dataset["viewProperty"]);
  return {
    target,
    component,
    updates,
    shown: () => rowNames("ol.ppp-props-list"),
    hidden: () => rowNames("[data-property-hidden-list]"),
    row: (name: string): HTMLElement | undefined =>
      Array.from(target.querySelectorAll<HTMLElement>("[data-view-property]")).find((el) => el.dataset["viewProperty"] === name),
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("the model", () => {
  it("orders shown fields by the saved order and hides what the table hides (path by default)", () => {
    const rows = fieldRows(FIELDS, { owner: { hide: true } }, ["due", "status"]);
    expect(rows.shown.map((f) => f.name)).toEqual(["due", "status", "name"]);
    expect(rows.hidden.map((f) => f.name)).toEqual(["owner", "path"]);
    expect(rows.primary).toBe("name");
  });

  it("moves a shown field and keeps hidden ones after", () => {
    expect(reorderShown(["a", "b", "c"], ["h"], "c", 0)).toEqual(["c", "a", "b", "h"]);
    expect(reorderShown(["a", "b", "c"], [], "a", 2)).toEqual(["b", "c", "a"]);
  });

  it("keeps the rest of a field's entry when toggling it", () => {
    expect(withHidden({ due: { widthRem: 9 } }, "due", true)).toEqual({ due: { widthRem: 9, hide: true } });
  });

  it("matches names case-insensitively", () => {
    expect(matchesFieldQuery("Owner", "own")).toBe(true);
    expect(matchesFieldQuery("Owner", "  ")).toBe(true);
    expect(matchesFieldQuery("Owner", "due")).toBe(false);
  });
});

describe("Properties in View settings", () => {
  it("is one list with a search box; hidden fields start collapsed", () => {
    const m = mount({ fieldConfig: { owner: { hide: true } } });
    expect(m.target.querySelector("[data-view-properties] input")).not.toBeNull();
    expect(m.shown()).toEqual(["name", "status", "due"]);
    const group = m.target.querySelector<HTMLButtonElement>("[data-property-group='hidden']");
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(m.target.querySelector("[data-property-hidden-list]")).toBeNull();
    m.destroy();
  });

  it("the eye hides a field, and the hidden group's eye shows it again", async () => {
    const m = mount({ fieldConfig: { owner: { hide: true } } });
    m.row("status")?.querySelector<HTMLButtonElement>("[data-property-action='hide']")?.click();
    expect(m.updates.at(-1)).toEqual({ table: { fieldConfig: { owner: { hide: true }, status: { hide: true } } } });

    m.target.querySelector<HTMLButtonElement>("[data-property-group='hidden']")?.click();
    await tick();
    expect(m.hidden()).toEqual(["owner", "path"]);
    m.row("owner")?.querySelector<HTMLButtonElement>("[data-property-action='show']")?.click();
    expect(m.updates.at(-1)).toEqual({ table: { fieldConfig: { owner: { hide: false } } } });
    m.destroy();
  });

  it("the title field cannot be hidden", () => {
    const m = mount();
    expect(m.row("name")?.querySelector("[data-property-action='hide']")).toBeDisabled();
    m.destroy();
  });

  it("the search narrows both groups and opens the hidden one when it reaches into it", async () => {
    const m = mount({ fieldConfig: { owner: { hide: true } } });
    const input = m.target.querySelector<HTMLInputElement>("[data-view-properties] input");
    if (!input) throw new Error("no search box");
    input.value = "ow";
    input.dispatchEvent(new Event("input"));
    await tick();
    expect(m.shown()).toEqual([]);
    expect(m.hidden()).toEqual(["owner"]);
    input.value = "zzz";
    input.dispatchEvent(new Event("input"));
    await tick();
    expect(m.target.querySelector("[data-property-empty]")).not.toBeNull();
    m.destroy();
  });

  it("Up and Down on a grip reorder the shown fields", async () => {
    const m = mount();
    const grip = m.row("due")?.querySelector<HTMLButtonElement>("[data-property-grip]");
    grip?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(m.updates.at(-1)).toEqual({ table: { orderFields: ["name", "status", "due", "owner", "path"] } });
    m.component.$set({ view: dashboard({ orderFields: ["name", "status", "due", "owner"] }) });
    await tick();
    expect(m.shown()).toEqual(["name", "status", "due", "owner"]);
    m.row("name")?.querySelector<HTMLButtonElement>("[data-property-grip]")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(m.updates).toHaveLength(1); // already first: nothing to write
    m.destroy();
  });

  // w4-p06: the grip follows a pointer — a mouse or a finger — instead of HTML
  // drag and drop, which never starts from touch. Each row is 30 px tall here.
  it("a drag on the grip, with a finger too, reorders the shown fields", () => {
    const m = mount();
    const rows = Array.from(m.target.querySelectorAll<HTMLElement>("[data-view-property]"));
    rows.forEach((row, i) => { row.getBoundingClientRect = () => ({ top: i * 30, bottom: i * 30 + 30, left: 0, right: 200, width: 200, height: 30, x: 0, y: i * 30, toJSON: () => ({}) }); });
    const pointer = (type: string, clientY: number) => {
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
      Object.defineProperties(e, { pointerId: { value: 7 }, pointerType: { value: "touch" } });
      return e;
    };
    const grip = m.row("due")!.querySelector<HTMLElement>("[data-property-grip]")!;
    expect(grip.querySelector("svg, .svg-icon") ?? grip).toBeTruthy();
    const statusTop = rows.findIndex((r) => r.dataset["viewProperty"] === "status") * 30;
    grip.dispatchEvent(pointer("pointerdown", 0));
    grip.dispatchEvent(pointer("pointermove", statusTop + 15));
    grip.dispatchEvent(pointer("pointerup", statusTop + 15));
    expect(m.updates.at(-1)).toEqual({ table: { orderFields: ["name", "due", "status", "owner", "path"] } });
    m.destroy();
  });

  it("a cancelled drag writes nothing", () => {
    const m = mount();
    const before = m.updates.length;
    const grip = m.row("due")!.querySelector<HTMLElement>("[data-property-grip]")!;
    const e = (type: string) => Object.defineProperties(new MouseEvent(type, { bubbles: true, cancelable: true, clientY: 0 }), { pointerId: { value: 3 }, pointerType: { value: "touch" } });
    grip.dispatchEvent(e("pointerdown"));
    grip.dispatchEvent(e("pointermove"));
    grip.dispatchEvent(e("pointercancel"));
    expect(m.updates.length).toBe(before);
    m.destroy();
  });
});
