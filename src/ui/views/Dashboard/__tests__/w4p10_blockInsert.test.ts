/**
 * w4-p10 (N7, Codex design C; CONSOLIDATION §7 row 24) — «+ Block» in the
 * plugin bar inserts after the selected block, else after the one most on
 * screen, and the palette names the place; the «+» between blocks is gone on
 * a phone.
 *
 * Why these fail on the old code: no block could be selected, the grid
 * published no insert to the bar, the palette had no place label, and the
 * in-between «+» was drawn on a phone too.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { get, writable } from "svelte/store";
import { Platform } from "obsidian";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  const t = (_key: string, o?: { defaultValue?: string; name?: string }) => (o?.defaultValue ?? "").replace("{{name}}", o?.name ?? "");
  return { i18n: writable({ t }) };
});
jest.mock("../widgets/WidgetHost.svelte", () => require("./mocks/WidgetHostHeader.mock.svelte"));

const WidgetGrid = require("../WidgetGrid.svelte").default;
const CompactNavBar = require("src/ui/components/Navigation/CompactNavBar.svelte").default;
const { BLOCK_OUTLINE_KEY } = require("../layout/blockOutline");

type Outline = { items: unknown[]; insert?: (anchor: HTMLElement | null) => void };

const blocks = [
  { id: "a", type: "stats", title: "Totals", layout: { x: 0, y: 0, w: 12, h: 2 }, config: {} },
  { id: "b", type: "text", title: "Services", layout: { x: 0, y: 2, w: 12, h: 6 }, config: {} },
  { id: "c", type: "text", title: "Notes", layout: { x: 0, y: 8, w: 12, h: 1 }, config: {} },
];

function mountGrid(readonly = false) {
  const store = writable<Outline | null>(null);
  const view = render(WidgetGrid, {
    props: {
      widgets: blocks, dndWidgets: blocks, canDnd: !readonly, readonly,
      frame: { fields: [], records: [] }, displayFrame: { fields: [], records: [] },
      api: {}, getRecordColor: () => null, fields: [], tableConfig: undefined,
      primaryDataTableId: "a", fieldPresets: [], activeFieldPresetId: undefined,
      availableSources: [], rightFrames: new Map(), project: { id: "p", name: "Plans" },
    },
    context: new Map([[BLOCK_OUTLINE_KEY, store]]),
  });
  const inserts: Array<{ type: string; index: number }> = [];
  view.component.$on("insert", (e: CustomEvent<{ type: string; index: number }>) => inserts.push(e.detail));
  return { view, store, inserts };
}

const slot = (root: ParentNode, id: string) => root.querySelector(`[data-widget-id="${id}"]`)!.closest<HTMLElement>(".ppp-block-slot")!;
const placeText = () => document.querySelector("[data-insert-place]")?.textContent?.trim();

afterEach(() => {
  document.body.innerHTML = "";
  delete (Platform as { isPhone?: boolean }).isPhone;
});

describe("w4-p10 — the selected block", () => {
  test("a click on a block's header selects it; a click on its buttons does not", async () => {
    const { view } = mountGrid();
    slot(view.container, "b").querySelector<HTMLElement>(".ppp-widget-title")!.click();
    await tick();
    expect(slot(view.container, "b")).toHaveClass("ppp-block-slot--selected");
    slot(view.container, "c").querySelector<HTMLElement>("button.menu")!.click();
    await tick();
    expect(slot(view.container, "c")).not.toHaveClass("ppp-block-slot--selected");
    expect(slot(view.container, "b")).toHaveClass("ppp-block-slot--selected");
  });

  test("«+ Block» inserts after the selected block and names the place", async () => {
    const { view, store, inserts } = mountGrid();
    await tick();
    slot(view.container, "b").querySelector<HTMLElement>(".ppp-widget-title")!.click();
    await tick();
    const anchor = document.createElement("button");
    document.body.append(anchor);
    get(store)!.insert!(anchor);
    await tick();
    await tick();
    expect(placeText()).toBe("After «Services»");
    document.querySelector<HTMLElement>('.ppp-block-insert__item[data-block-type="text"]')!.click();
    expect(inserts[inserts.length - 1]).toEqual({ type: "text", index: 2 });
  });

  test("with nothing selected: after the block most on screen", async () => {
    const { view, store, inserts } = mountGrid();
    await tick();
    const boxes: Record<string, [number, number]> = { a: [-500, -300], b: [-300, 100], c: [100, 700] };
    for (const id of Object.keys(boxes)) {
      const el = view.container.querySelector<HTMLElement>(`[data-widget-id="${id}"]`)!;
      const [top, bottom] = boxes[id]!;
      el.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top, toJSON: () => ({}) });
    }
    get(store)!.insert!(null);
    await tick();
    await tick();
    expect(placeText()).toBe("After «Notes»");
    document.querySelector<HTMLElement>('.ppp-block-insert__item[data-block-type="text"]')!.click();
    expect(inserts[inserts.length - 1]).toEqual({ type: "text", index: 3 });
  });

  test("a read-only page publishes no insert", async () => {
    const { store } = mountGrid(true);
    await tick();
    expect(get(store)?.insert).toBeUndefined();
  });
});

describe("w4-p10 — the bar's «+ Block» and the phone's in-between «+»", () => {
  test("the bar shows «+ Block» when the page takes inserts and calls it with the button", async () => {
    const insert = jest.fn();
    const store = writable<Outline | null>({ items: [], insert });
    const view = render(CompactNavBar, { props: { views: [], viewId: undefined }, context: new Map([[BLOCK_OUTLINE_KEY, store]]) });
    const add = view.container.querySelector<HTMLButtonElement>("[data-block-add]")!;
    expect(add).not.toBeNull();
    // One block: no «Blocks · N», «+ Block» still.
    expect(view.container.querySelector(".ppp-block-outline")).toBeNull();
    add.click();
    expect(insert).toHaveBeenCalledWith(add);
  });

  test("no «+» between blocks on a phone; a computer keeps them", async () => {
    (Platform as { isPhone?: boolean }).isPhone = true;
    const phone = mountGrid();
    expect(phone.view.container.querySelector(".ppp-block-insert--between")).toBeNull();
    phone.view.unmount();
    (Platform as { isPhone?: boolean }).isPhone = false;
    const desk = mountGrid();
    expect(desk.view.container.querySelector(".ppp-block-insert--between")).not.toBeNull();
  });
});
