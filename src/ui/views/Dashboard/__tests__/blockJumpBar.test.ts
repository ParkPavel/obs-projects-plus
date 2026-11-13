/**
 * i3-dash — the narrow dashboard's jump bar and the block menu's «Properties».
 *
 * A phone shows the page as one stack; the jump bar lists the blocks in page
 * order and moves the page to the one tapped. The toolbar «Properties» button
 * is gone; the same dialog is offered from the menu of a block that reads this
 * dashboard's project, named after it.
 */

import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";

import { get, writable } from "svelte/store";
import { jumpItems, jumpToBlock } from "../layout/blockJump";
import { BLOCK_OUTLINE_KEY } from "../layout/blockOutline";
import { createBlockProperties, readsHostProject } from "../layout/blockProperties";
import { buildWidgetMenuEntries } from "../widgets/widgetMenu";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? "" }) };
});
jest.mock("../widgets/WidgetHost.svelte", () => require("./mocks/WidgetHost.mock.svelte"));

const BlockOutlineButton = require("../layout/BlockOutlineButton.svelte").default;
const WidgetGrid = require("../WidgetGrid.svelte").default;
const DashboardToolbar = require("../DashboardToolbar.svelte").default;

const blocks = [
  { id: "a", type: "stats", title: "Totals", layout: { x: 0, y: 0, w: 12, h: 2 }, config: {} },
  { id: "b", type: "database-call", title: "  Tasks ", layout: { x: 0, y: 2, w: 12, h: 6 }, config: {}, collapsed: true },
  { id: "c", type: "text", title: "", layout: { x: 0, y: 8, w: 12, h: 1 }, config: {} },
];

function mountGrid(widgets = blocks, readonly = false) {
  return render(WidgetGrid, {
    props: {
      widgets, dndWidgets: widgets, canDnd: !readonly, readonly,
      frame: { fields: [], records: [] }, displayFrame: { fields: [], records: [] },
      api: {}, getRecordColor: () => null, fields: [], tableConfig: undefined,
      primaryDataTableId: "a", fieldPresets: [], activeFieldPresetId: undefined,
      availableSources: [], rightFrames: new Map(), project: { id: "p", name: "Plans" },
    },
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("jumpItems / jumpToBlock", () => {
  it("lists blocks in page order with trimmed titles and their collapsed state", () => {
    expect(jumpItems(blocks)).toEqual([
      { id: "a", title: "Totals", collapsed: false },
      { id: "b", title: "Tasks", collapsed: true },
      { id: "c", title: "", collapsed: false },
    ]);
  });

  it("scrolls the block to the top and focuses it without a second scroll", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-widget-id="x" tabindex="0"></div><div data-widget-id="y" tabindex="0"></div>';
    document.body.appendChild(root);
    const y = root.querySelector<HTMLElement>('[data-widget-id="y"]')!;
    y.scrollIntoView = jest.fn();
    const focus = jest.spyOn(y, "focus");
    expect(jumpToBlock(root, "y")).toBe(true);
    expect(y.scrollIntoView).toHaveBeenCalledWith({ block: "start", inline: "nearest" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(y);
    expect(jumpToBlock(root, "missing")).toBe(false);
  });
});

describe("BlockOutlineButton (w4-p10a, N15) — the table of contents is one button", () => {
  const outline = (jump = jest.fn()) => ({ items: jumpItems(blocks), jump, current: () => "b" });

  it("names the blocks' count, opens them in page order, marks the current one and reports the pick", async () => {
    const jump = jest.fn();
    const view = render(BlockOutlineButton, { props: { outline: outline(jump) } });
    const button = view.container.querySelector<HTMLButtonElement>(".ppp-block-outline")!;
    expect(button).toHaveAttribute("aria-label", "Blocks on this page");
    expect(button.querySelector(".ppp-block-outline__count")?.textContent).toBe("3");
    await fireEvent.click(button);
    await tick();
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".ppp-pop-item"));
    expect(rows.map((r) => r.textContent?.trim())).toEqual(["Totals", "Tasks · collapsed", "3"]);
    expect(rows[1]).toHaveClass("ppp-pop-item--selected");
    await fireEvent.mouseDown(rows[2]!);
    expect(jump).toHaveBeenCalledWith("c");
  });
});

describe("WidgetGrid — page navigation", () => {
  it("without an App bar: the button above the blocks, no carousel, and a pick jumps", async () => {
    const view = mountGrid();
    expect(view.container.querySelector(".ppp-block-jump")).toBeNull();
    const button = view.container.querySelector<HTMLButtonElement>(".ppp-block-outline")!;
    expect(button).not.toBeNull();
    const canvas = view.container.querySelector(".ppp-database-canvas--stack")!;
    expect(button.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const target = canvas.querySelector<HTMLElement>('[data-widget-id="c"]')!;
    target.scrollIntoView = jest.fn();
    await fireEvent.click(button);
    await tick();
    await fireEvent.mouseDown(document.querySelectorAll<HTMLElement>(".ppp-pop-item")[2]!);
    await tick();
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "start", inline: "nearest" });
    expect(document.activeElement).toBe(target);
  });

  it("under an App: the grid publishes its blocks to the bar and draws no button of its own", async () => {
    const store = writable<unknown>(null);
    const view = render(WidgetGrid, {
      props: {
        widgets: blocks, dndWidgets: blocks, canDnd: true, readonly: false,
        frame: { fields: [], records: [] }, displayFrame: { fields: [], records: [] },
        api: {}, getRecordColor: () => null, fields: [], tableConfig: undefined,
        primaryDataTableId: "a", fieldPresets: [], activeFieldPresetId: undefined,
        availableSources: [], rightFrames: new Map(), project: { id: "p", name: "Plans" },
      },
      context: new Map([[BLOCK_OUTLINE_KEY, store]]),
    });
    await tick();
    expect(view.container.querySelector(".ppp-block-outline")).toBeNull();
    const published = get(store) as { items: Array<{ id: string }> };
    expect(published.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    view.unmount();
    expect(get(store)).toBeNull();
  });

  it("works on a read-only page too, and is absent for a single block", () => {
    expect(mountGrid(blocks, true).container.querySelector(".ppp-block-outline")).not.toBeNull();
    document.body.innerHTML = "";
    expect(mountGrid([blocks[0]!]).container.querySelector(".ppp-block-outline")).toBeNull();
  });

  it("stays a stack, with no tile handles, on a canvas that has not been measured wide", () => {
    const view = mountGrid();
    expect(view.container.querySelector(".ppp-database-canvas--tiles")).toBeNull();
    expect(view.container.querySelector(".ppp-tile-resize")).toBeNull();
  });
});

describe("«Properties» lives in the block menu, not the toolbar", () => {
  it("the toolbar no longer carries it", () => {
    const { container } = render(DashboardToolbar, { props: { readonly: false, showFormulaBar: false } });
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.textContent).not.toContain("Properties");
  });

  it("is offered for blocks that read this project and named after it", () => {
    expect(readsHostProject({ type: "database-call" })).toBe(true);
    expect(readsHostProject({ type: "database-call", sourceConfig: { projectId: "" } })).toBe(true);
    expect(readsHostProject({ type: "chart" })).toBe(true);
    expect(readsHostProject({ type: "database-call", sourceConfig: { projectId: "other" } })).toBe(false);
    for (const type of ["text", "divider", "cover-banner"] as const) expect(readsHostProject({ type })).toBe(false);
    const open = jest.fn();
    const props = createBlockProperties(() => "Plans", open);
    expect(props.sourceFor({ type: "stats" })).toBe("Plans");
    expect(props.sourceFor({ type: "text" })).toBeNull();
  });

  it("the menu entry sits after the source settings and opens the dialog", () => {
    const open = jest.fn();
    const noop = () => {};
    const base = {
      hasCog: true, isDatabase: true, hasPipeline: false, pipelineStepCount: 0, locked: false, collapsed: false,
      t: (_k: string, d: string) => d, onRename: noop, onConfigure: noop, onFilter: noop, onPipeline: noop,
      onToggleCollapse: noop, onToggleLock: noop, onDuplicate: noop, onRemove: noop,
    };
    const without = buildWidgetMenuEntries(base);
    const withProps = buildWidgetMenuEntries({ ...base, properties: { label: "Properties of «Plans»…", open } });
    expect(withProps).toHaveLength(without.length + 1);
    const titles = withProps.map((e) => ("title" in e ? e.title : "—"));
    expect(titles.indexOf("Properties of «Plans»…")).toBe(titles.indexOf("Source and settings…") + 1);
    const entry = withProps.find((e) => "title" in e && e.title === "Properties of «Plans»…") as { onClick: () => void };
    entry.onClick();
    expect(open).toHaveBeenCalledTimes(1);
  });
});
