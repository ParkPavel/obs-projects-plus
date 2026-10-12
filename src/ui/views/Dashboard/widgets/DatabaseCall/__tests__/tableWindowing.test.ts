/**
 * stab-dash (3.7.1) - a long table in an auto-height tile renders the rows in view.
 *
 * Seen live: DataTableContent windowed its rows from its own `.ppp-t2-scroll`
 * scrollTop. In a dashboard tile that body grows to full height and the PAGE
 * scrolls, so scrollTop stayed 0 and only the first ~29 rows of a 131-record
 * table ever rendered; the rest was blank space. It also converted rem to px at
 * a fixed 16.
 *
 * jsdom does no layout, so the page is a fake scrolling ancestor and the boxes
 * are stubbed the way layout would report them: the ancestor is a 600 px window
 * onto a 200-row body (7200 px at 36 px a row), scrolled to the middle.
 * requestAnimationFrame is queued by hand so the throttle is part of the test.
 *
 * RED on the old code: nothing listens to the ancestor, so the first row
 * rendered is row 0 and the bottom spacer is the whole remainder, not the rows
 * past the middle. The 20 px root test fails the same way (rowPx fixed at 16).
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? "" }) };
});

const { DataFieldType } = require("src/lib/dataframe/dataframe");
const { rootFontPx } = require("src/ui/utils/cssLength");
const DataTableContent = require("../DataTableContent.svelte").default;

const ROWS = 200;
const ROW_REM = 2.25; // the default row height in DataTableContent
const OVERSCAN = 12;
const VIEW_PX = 600;

const field = { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false, typeConfig: {} };
const frame = {
  fields: [field],
  records: Array.from({ length: ROWS }, (_, i) => ({ id: `row-${i}.md`, values: { name: `row-${i}` } })),
};

let frames: Array<() => void> = [];
const realGetComputedStyle = window.getComputedStyle.bind(window);
let rootPx: string | null = null;
let scroller: HTMLElement;

function box(top: number, height: number): DOMRect {
  return { top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON: () => ({}) };
}

function setup() {
  scroller = document.createElement("div");
  document.body.appendChild(scroller);
  const target = document.createElement("div");
  scroller.appendChild(target);
  const view = render(DataTableContent, {
    target,
    props: { frame, api: {}, readonly: true, getRecordColor: () => null, fields: [field], config: undefined },
  });
  return { ...view, body: target.querySelector<HTMLElement>(".ppp-t2-scroll") as HTMLElement, target };
}

/** The page scrolled by `pageTop` px: layout would put the body at -pageTop. */
async function scrollPage(body: HTMLElement, pageTop: number, bodyHeightPx: number) {
  scroller.getBoundingClientRect = () => box(0, VIEW_PX);
  body.getBoundingClientRect = () => box(-pageTop, bodyHeightPx);
  scroller.dispatchEvent(new Event("scroll"));
  const queued = frames;
  frames = [];
  queued.forEach((run) => run());
  await tick();
}

const rows = (el: HTMLElement) => Array.from(el.querySelectorAll(".ppp-t2-row")).map((r) => r.textContent ?? "");
const spacers = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLElement>(".ppp-t2-table > div[aria-hidden='true']")).map((s) => parseFloat(s.style.height));

beforeEach(() => {
  document.body.innerHTML = "";
  frames = [];
  rootPx = null;
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(() => cb(0)));
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  // jsdom reports neither a root font size nor which ancestors clip: say so.
  jest.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (el === document.documentElement && rootPx) return { fontSize: rootPx, getPropertyValue: () => "" } as unknown as CSSStyleDeclaration;
    // Only the fake page clips: a component's injected style must not add a zero-sized one.
    if (el === scroller || el !== document.documentElement) {
      const overflow = el === scroller ? "auto" : "visible";
      return { fontSize: "16px", getPropertyValue: (p: string) => (p === "overflow-y" ? overflow : "") } as unknown as CSSStyleDeclaration;
    }
    return realGetComputedStyle(el, pseudo);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DataTableContent windowing in an auto-height tile (stab-dash)", () => {
  it("does not hide a shortened dataset behind the old scroll offset", async () => {
    const { body, target, component } = setup();
    const bodyPx = ROWS * ROW_REM * rootFontPx(document);
    await scrollPage(body, bodyPx / 2, bodyPx);
    component.$set({ frame: { fields: [field], records: [frame.records[0]] } });
    await tick();
    // ResizeObserver/scroll have not corrected the geometry yet. The next
    // render must still show the surviving row, not a hundred-row spacer.
    expect(rows(target)).toHaveLength(1);
    expect(rows(target)[0]).toContain("row-0");
    expect(spacers(target)).toEqual([]);
  });

  it("renders the rows in view when the page, not the table, scrolls to the middle", async () => {
    const { body, target } = setup();
    const rowPx = ROW_REM * rootFontPx(document);
    const bodyPx = ROWS * rowPx;
    await scrollPage(body, bodyPx / 2, bodyPx);

    const shown = rows(target);
    const first = Math.floor(bodyPx / 2 / rowPx) - OVERSCAN;
    const last = Math.ceil((bodyPx / 2 + VIEW_PX) / rowPx) + OVERSCAN;
    expect(shown).toHaveLength(last - first);
    expect(shown[0]).toContain(`row-${first}`);
    expect(shown[shown.length - 1]).toContain(`row-${last - 1}`);
    // The rows in view are among them, and row 0 is not.
    expect(shown.some((r) => r.includes(`row-${ROWS / 2}`))).toBe(true);
    expect(shown.some((r) => r.includes("row-0"))).toBe(false);
  });

  it("keeps the total height with spacers above and below", async () => {
    const { body, target } = setup();
    const rowPx = ROW_REM * rootFontPx(document);
    const bodyPx = ROWS * rowPx;
    await scrollPage(body, bodyPx / 2, bodyPx);

    const [above, below] = spacers(target);
    const rem = rootFontPx(document);
    expect((above ?? 0) * rem + rows(target).length * rowPx + (below ?? 0) * rem).toBeCloseTo(bodyPx, 3);
    expect(above).toBeGreaterThan(0);
    expect(below).toBeGreaterThan(0);
  });

  it("reads rem from the real root font size, not a fixed 16", async () => {
    rootPx = "20px";
    const { body, target } = setup();
    const rowPx = ROW_REM * 20;
    const bodyPx = ROWS * rowPx;
    await scrollPage(body, bodyPx / 2, bodyPx);

    const first = Math.floor(bodyPx / 2 / rowPx) - OVERSCAN;
    expect(rows(target)[0]).toContain(`row-${first}`);
  });

  it("throttles a burst of scrolls to one measurement per frame and stops on destroy", async () => {
    const { body, component } = setup();
    scroller.getBoundingClientRect = () => box(0, VIEW_PX);
    body.getBoundingClientRect = () => box(-100, 7200);
    frames = [];
    for (let i = 0; i < 5; i++) scroller.dispatchEvent(new Event("scroll"));
    expect(frames).toHaveLength(1);
    component.$destroy();
    frames = [];
    scroller.dispatchEvent(new Event("scroll"));
    expect(frames).toHaveLength(0);
  });
});
