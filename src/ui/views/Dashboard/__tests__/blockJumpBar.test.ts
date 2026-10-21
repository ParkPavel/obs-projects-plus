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

import { jumpItems, jumpToBlock } from "../layout/blockJump";
import { createBlockProperties, readsHostProject } from "../layout/blockProperties";
import { buildWidgetMenuEntries } from "../widgets/widgetMenu";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? "" }) };
});
jest.mock("../widgets/WidgetHost.svelte", () => require("./mocks/WidgetHost.mock.svelte"));

const BlockJumpBar = require("../layout/BlockJumpBar.svelte").default;
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

describe("BlockJumpBar", () => {
  it("renders one button per block, a number for an untitled one, and reports the pick", async () => {
    const view = render(BlockJumpBar, { props: { items: jumpItems(blocks) } });
    const buttons = Array.from(view.container.querySelectorAll<HTMLButtonElement>(".ppp-block-jump__item"));
    expect(buttons.map((b) => b.textContent)).toEqual(["Totals", "Tasks", "3"]);
    expect(buttons[1]).toHaveClass("ppp-block-jump__item--collapsed");
    expect(view.container.querySelector("nav")).toHaveAttribute("aria-label", "Blocks on this page");
    const onJump = jest.fn();
    view.component.$on("jump", onJump);
    await fireEvent.click(buttons[1]!);
    expect(onJump.mock.calls[0][0].detail).toBe("b");
  });
});

describe("WidgetGrid — narrow page navigation", () => {
  it("shows the jump bar above the stack and jumps to the picked block", async () => {
    const view = mountGrid();
    const bar = view.container.querySelector(".ppp-block-jump");
    expect(bar).not.toBeNull();
    // The bar precedes the canvas, so it stays at the top while the blocks scroll.
    const canvas = view.container.querySelector(".ppp-database-canvas--stack")!;
    expect(bar!.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const target = canvas.querySelector<HTMLElement>('[data-widget-id="c"]')!;
    target.scrollIntoView = jest.fn();
    await fireEvent.click(view.container.querySelector('[data-jump-id="c"]')!);
    await tick();
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "start", inline: "nearest" });
    expect(document.activeElement).toBe(target);
  });

  it("works on a read-only page too, and is absent for a single block", () => {
    expect(mountGrid(blocks, true).container.querySelector(".ppp-block-jump")).not.toBeNull();
    document.body.innerHTML = "";
    expect(mountGrid([blocks[0]!]).container.querySelector(".ppp-block-jump")).toBeNull();
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
