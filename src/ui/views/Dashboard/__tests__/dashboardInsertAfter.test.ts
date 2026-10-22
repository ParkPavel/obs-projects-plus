/**
 * i3-close — «Insert block after» in a tile's menu.
 *
 * Tiles hide the in-between «+», so the block menu offers the insert instead:
 * the position is the one after the block, the menu entry exists only when the
 * grid offers it, and the block palette opened from outside its own «+» sends
 * the same `insert` with that position.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

import { insertIndexAfter } from "../layout/blockInsert";
import { buildWidgetMenuEntries } from "../widgets/widgetMenu";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? "" }) };
});

type Mounted = {
  $destroy(): void;
  $on(event: string, handler: (e: CustomEvent<unknown>) => void): () => void;
};
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;
const DashboardBlockPalette = require("../widgets/DashboardBlockPalette.svelte").default as ComponentClass;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("i3-close insertIndexAfter", () => {
  it("is the place right after the block; the end for an unknown block", () => {
    expect(insertIndexAfter(["a", "b", "c"], "a")).toBe(1);
    expect(insertIndexAfter(["a", "b", "c"], "c")).toBe(3);
    expect(insertIndexAfter(["a", "b", "c"], "zz")).toBe(3);
    expect(insertIndexAfter([], "a")).toBe(0);
  });
});

describe("i3-close block menu entry", () => {
  const noop = () => {};
  const base = {
    hasCog: false, isDatabase: false, hasPipeline: false, pipelineStepCount: 0, locked: false, collapsed: false,
    t: (_k: string, d: string) => d, onRename: noop, onConfigure: noop, onFilter: noop, onPipeline: noop,
    onToggleCollapse: noop, onToggleLock: noop, onDuplicate: noop, onRemove: noop,
  };
  const titles = (entries: ReadonlyArray<object>) =>
    entries.map((e) => ("title" in e ? String((e as { title: unknown }).title) : "—"));

  it("is absent unless the grid offers it (the stack keeps its in-between «+»)", () => {
    expect(titles(buildWidgetMenuEntries(base))).not.toContain("Insert block after");
  });

  it("sits right before Duplicate and calls the grid", () => {
    const onInsertAfter = jest.fn();
    const entries = buildWidgetMenuEntries({ ...base, onInsertAfter });
    const list = titles(entries);
    expect(list.indexOf("Insert block after")).toBe(list.indexOf("Duplicate") - 1);
    const entry = entries.find((e) => "title" in e && e.title === "Insert block after") as { onClick: () => void };
    entry.onClick();
    expect(onInsertAfter).toHaveBeenCalledTimes(1);
  });
});

describe("i3-close the palette opened from a tile", () => {
  it("opens without its own «+» and inserts at the given position", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    const palette = new DashboardBlockPalette({
      target,
      props: { index: 2, currentWidgets: [], open: true, anchorEl: anchor },
    });
    const inserts: unknown[] = [];
    palette.$on("insert", (e) => inserts.push(e.detail));
    await tick();
    const item = document.querySelector<HTMLButtonElement>('[data-block-type="text"]');
    expect(item).not.toBeNull();
    item?.click();
    expect(inserts).toEqual([{ type: "text", index: 2 }]);
    palette.$destroy();
  });
});
