/**
 * w4-p10a (N8, N15; Codex design A and B) — fewer rows over a block's data.
 *
 * - The block's filter is one "Filter · N" button in the row of its views (the
 *   pills had a row of their own): N counts the switched-on conditions and is
 *   not shown at zero; the button opens the same editor; read-only, the
 *   conditions as pills.
 * - The table's search folds away keeping its query; the button is marked
 *   while a folded query filters the rows; Escape clears.
 * - The plugin bar shows "Blocks · N" when the view publishes its blocks.
 *
 * Why these fail on the old code: BlockFilterBar drew a row of pills with an
 * "add" pill, DatabaseCallBlock stacked the views and the filter in two rows,
 * folding the search cleared the query, and the bar had no blocks button.
 */

import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join } from "path";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { writable } from "svelte/store";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false), isTouchDevice: writable(false) };
});

const BlockFilterBar = require("../widgets/DatabaseCall/BlockFilterBar.svelte").default;
const TableControlBar = require("../widgets/DatabaseCall/TableControlBar.svelte").default;
const CompactNavBar = require("src/ui/components/Navigation/CompactNavBar.svelte").default;
const { BLOCK_OUTLINE_KEY } = require("../layout/blockOutline");

const settle = async () => { await tick(); await tick(); };
const cond = (field: string, enabled = true) => ({ field, operator: "is", value: "x", enabled });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the block's filter is one button (N8)", () => {
  test("no row of pills: one button, with the count of switched-on conditions", () => {
    const filter = { conjunction: "and", conditions: [cond("a"), cond("b", false), cond("c")] };
    const view = render(BlockFilterBar, { props: { filter, fields: [], records: [] } });
    expect(view.container.querySelectorAll("button")).toHaveLength(1);
    expect(view.container.querySelector(".ppp-filterpills-pill")).toBeNull();
    expect(view.container.querySelector(".ppp-blockfilter-count")?.textContent).toBe("2");
    expect(view.container.querySelector(".ppp-blockfilter-button")).toHaveClass("ppp-blockfilter-button--on");
  });

  test("no conditions, no number; the button opens the shared editor", async () => {
    const view = render(BlockFilterBar, { props: { filter: undefined, fields: [{ name: "a", type: "string" }], records: [] } });
    expect(view.container.querySelector(".ppp-blockfilter-count")).toBeNull();
    view.container.querySelector<HTMLButtonElement>(".ppp-blockfilter-button")!.click();
    await settle();
    expect(document.querySelector(".ppp-blockfilter-popover .row-btn, .ppp-blockfilter-popover .add-btn")).not.toBeNull();
  });

  test("read-only: shown only with conditions, and opens them as pills", async () => {
    const empty = render(BlockFilterBar, { props: { filter: undefined, readonly: true } });
    expect(empty.container.querySelector(".ppp-blockfilter-button")).toBeNull();
    empty.unmount();
    const view = render(BlockFilterBar, { props: { filter: { conjunction: "and", conditions: [cond("a")] }, readonly: true } });
    view.container.querySelector<HTMLButtonElement>(".ppp-blockfilter-button")!.click();
    await settle();
    expect(document.querySelector(".ppp-blockfilter-popover .ppp-filterpills-pill")).not.toBeNull();
  });

  test("the block draws its views and its filter in one row", () => {
    const block = readFileSync(join(__dirname, "..", "widgets", "DatabaseCall", "DatabaseCallBlock.svelte"), "utf8");
    const head = block.indexOf('<div class="ppp-dbc-head">');
    const end = block.indexOf("</div>", block.indexOf("<BlockFilterBar"));
    expect(head).toBeGreaterThan(-1);
    expect(block.indexOf("<ViewTabBar")).toBeGreaterThan(head);
    expect(block.indexOf("<BlockFilterBar")).toBeGreaterThan(block.indexOf("<ViewTabBar"));
    expect(end).toBeGreaterThan(block.indexOf("<BlockFilterBar"));
  });
});

describe("the table's search folds away keeping its query (N8)", () => {
  test("fold keeps the query and marks the button; Escape clears", async () => {
    const view = render(TableControlBar, { props: { sortCriteria: [], recordCount: 3 } });
    const searches: string[] = [];
    view.component.$on("search", (e: CustomEvent<string>) => searches.push(e.detail));
    const button = view.container.querySelector<HTMLButtonElement>(".ppp-t2-cb-btn")!;
    button.click();
    await settle();
    const input = view.container.querySelector<HTMLInputElement>(".ppp-search-field input")!;
    input.value = "ab";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    button.click();
    await settle();
    expect(view.container.querySelector(".ppp-search-field")).toBeNull();
    expect(searches[searches.length - 1]).toBe("ab");
    expect(button).toHaveClass("ppp-t2-cb-btn--query");
    expect(button.querySelector(".ppp-t2-cb-dot")).not.toBeNull();
    expect(button.getAttribute("aria-label")).toContain("ab");
    button.click();
    await settle();
    const again = view.container.querySelector<HTMLInputElement>(".ppp-search-field input")!;
    expect(again.value).toBe("ab");
    again.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await settle();
    expect(searches[searches.length - 1]).toBe("");
    expect(button).not.toHaveClass("ppp-t2-cb-btn--query");
  });
});

describe("the plugin bar's blocks button (N15)", () => {
  test("shown when the view publishes its blocks, gone when it stops", async () => {
    const store = writable<unknown>(null);
    const view = render(CompactNavBar, { props: { views: [], viewId: undefined }, context: new Map([[BLOCK_OUTLINE_KEY, store]]) });
    expect(view.container.querySelector(".ppp-block-outline")).toBeNull();
    store.set({ items: [{ id: "a", title: "A", collapsed: false }, { id: "b", title: "B", collapsed: false }], jump: jest.fn(), current: () => null });
    await settle();
    expect(view.container.querySelector(".ppp-block-outline__count")?.textContent).toBe("2");
    store.set(null);
    await settle();
    expect(view.container.querySelector(".ppp-block-outline")).toBeNull();
  });
});
