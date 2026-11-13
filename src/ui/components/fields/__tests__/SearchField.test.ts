/**
 * stab-forms — SearchField: one look (icon, input, clear button) and one
 * contract (queryChange per edit, clear), shared by the popover, the table bar,
 * the icon picker and the relation picker.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

const SearchField = require("../SearchField.svelte").default;

function mount(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new SearchField({ target, props: { query: "", placeholder: "Find", ...props } });
  const events: string[] = [];
  const keys: string[] = [];
  component.$on("queryChange", (e: CustomEvent<string>) => events.push(`q:${e.detail}`));
  component.$on("clear", () => events.push("clear"));
  component.$on("keydown", (e: KeyboardEvent) => keys.push(e.key));
  return {
    target,
    component,
    events,
    keys,
    input: () => target.querySelector("input") as HTMLInputElement,
    clearBtn: () => target.querySelector<HTMLButtonElement>(".ppp-search-field-clear"),
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("SearchField", () => {
  test("an early blur preserves composition and reports its final entire query once", async () => {
    const m = mount({ query: "prefix " }), input = m.input(); input.focus();
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.value = "prefix か"; input.dispatchEvent(new Event("input", { bubbles: true }));
    input.blur(); await tick(); expect(input.value).toBe("prefix か"); expect(m.events).toEqual([]);
    input.value = "prefix かな";
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "かな" }));
    input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
    expect(input.value).toBe("prefix かな"); expect(m.events).toEqual(["q:prefix かな"]); m.destroy();
  });
  test("a closed list exposes no expanded state and a read-only query cannot be cleared", async () => {
    const m = mount({ query: "Kept", controls: "list", expanded: false, readOnly: true });
    expect(m.input()).toHaveAttribute("aria-expanded", "false"); expect(m.input().readOnly).toBe(true);
    expect(m.clearBtn()).toBeDisabled(); m.clearBtn()!.click(); expect(m.events).toEqual([]); expect(m.input().value).toBe("Kept");
    m.destroy();
  });
  test("a cancelled mount cannot focus its detached input after the queued tick", async () => {
    const m = mount({ focusOnMount: true }), focus = jest.spyOn(m.input(), "focus");
    m.destroy(); await tick(); await tick(); expect(focus).not.toHaveBeenCalled();
  });
  test("shows the search icon, the input and no clear button while the query is empty", () => {
    const m = mount();
    expect(m.target.querySelector(".ppp-search-field-icon")).not.toBeNull();
    expect(m.input()).toHaveAttribute("placeholder", "Find");
    expect(m.input()).toHaveAttribute("role", "searchbox");
    expect(m.clearBtn()).toBeNull();
    m.destroy();
  });

  test("typing reports the query, edit by edit", () => {
    const m = mount();
    m.input().value = "ab";
    m.input().dispatchEvent(new Event("input", { bubbles: true }));
    expect(m.events).toEqual(["q:ab"]);
    m.destroy();
  });

  test("the clear button is there whenever there is a query (no hover needed) and clears it", async () => {
    const m = mount({ query: "abc" });
    const btn = m.clearBtn();
    expect(btn).not.toBeNull();
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveAttribute("aria-label");
    btn!.click();
    expect(m.events).toEqual(["q:", "clear"]);
    m.component.$set({ query: "" });
    await tick();
    expect(m.clearBtn()).toBeNull();
    m.destroy();
  });

  test("the clear button does not take focus from the input on press", () => {
    const m = mount({ query: "abc" });
    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    m.clearBtn()!.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    m.destroy();
  });

  test("clearable=false never shows a clear button", () => {
    const m = mount({ query: "abc", clearable: false });
    expect(m.clearBtn()).toBeNull();
    m.destroy();
  });

  test("the shown text follows the query prop", async () => {
    const m = mount({ query: "one" });
    expect(m.input().value).toBe("one");
    m.component.$set({ query: "two" });
    await tick();
    expect(m.input().value).toBe("two");
    m.destroy();
  });

  test("focusOnMount focuses the input after a tick", async () => {
    const m = mount({ focusOnMount: true });
    await tick();
    await tick();
    expect(document.activeElement).toBe(m.input());
    m.destroy();
  });

  test("keydown is forwarded, so a consumer can add arrow navigation", () => {
    const m = mount();
    m.input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(m.keys).toEqual(["ArrowDown"]);
    m.destroy();
  });

  test("driving a listbox makes it a combobox over that list, with the active option named", () => {
    const m = mount({ controls: "list-1", activeDescendant: "opt-2" });
    const input = m.input();
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-controls", "list-1");
    expect(input).toHaveAttribute("aria-activedescendant", "opt-2");
    expect(input).toHaveAttribute("aria-expanded", "true");
    m.destroy();
  });

  test("one look: the field's styles use Obsidian tokens and no raw pixels", () => {
    const text = require("fs").readFileSync(require("path").join(__dirname, "..", "SearchField.svelte"), "utf8") as string;
    const style = /<style>([\s\S]*)<\/style>/.exec(text)?.[1] ?? "";
    expect(style).toContain("var(--background-modifier-border)");
    expect(style).toContain("var(--interactive-accent)");
    expect(style).not.toMatch(/\d\s*px\b/);
    expect(style).not.toMatch(/:hover/);
  });
});
