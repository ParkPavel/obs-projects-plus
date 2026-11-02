/**
 * B10 — the calendar's day window runs on the shared popup engine.
 *
 * It used to build its own `position: fixed` layer with its own Escape, focus
 * and keyboard handling. It now mounts through FloatingPopup, anchored at the
 * day that was tapped, so it inherits the engine's contract: the layer lives in
 * the anchor's own document (popout windows), Escape closes the top layer only,
 * focus returns to the anchor, and the mobile sheet sits above the keyboard.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";
import dayjs from "dayjs";
import { processCalendarData } from "../../processor";
import { DEFAULT_RECORD_COLOR } from "src/lib/colors/recordColor";

// The Svelte transform reads `dayjs.default`; the CommonJS build has none.
jest.mock("dayjs", () => {
  const real = jest.requireActual("dayjs");
  real.default = real;
  return real;
});
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (key: string) => key }) };
});
jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

type Mounted = { $destroy(): void; $on(ev: string, cb: (e: CustomEvent) => void): () => void };
type ComponentClass = new (o: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;
const DayPopup = require("../DayPopup/DayPopup.svelte").default as ComponentClass;

const flush = async () => {
  await tick();
  await new Promise((r) => setTimeout(r, 0));
  await tick();
};

function mount(props: Record<string, unknown> = {}) {
  const anchor = document.createElement("button");
  anchor.className = "day-anchor";
  document.body.appendChild(anchor);
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new DayPopup({
    target,
    props: {
      project: { id: "p", name: "p", dataSource: { kind: "folder", config: {} }, views: [] },
      date: dayjs("2026-10-14"),
      records: [{ id: "Notes/a.md", values: { name: "a" } }],
      checkField: undefined,
      visible: true,
      anchorEl: anchor,
      ...props,
    },
  });
  return { component, anchor, target };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("B10 — DayPopup on FloatingPopup", () => {
  it.each(["day", "week", "month"] as const)("uses the same default color as the %s calendar without writing it into the note", async interval => {
    const record = { id: "a.md", values: { starts: "2026-11-03" } };
    const config = { interval, startDateField: "starts", eventColorField: "color" };
    const processed = processCalendarData({ fields: [], records: [record] }, config, () => null);
    const { component } = mount({ records: [record], config, eventColorField: "color" });
    await flush();
    const color = document.querySelector<HTMLElement>(".color-indicator")!.style.getPropertyValue("--indicator-color");
    expect(color).toBe(DEFAULT_RECORD_COLOR);
    expect(processed.index.get(record.id)?.color).toBe(color);
    expect(record.values).toEqual({ starts: "2026-11-03" });
    component.$destroy();
  });

  async function openColor() {
    document.querySelector<HTMLElement>(".actions-toggle")!.click();
    await flush();
    document.querySelector<HTMLElement>(".color-action")!.click();
    await flush();
    return document.querySelector<HTMLElement>('.hsl-apply-button[aria-label="views.calendar.colors.apply"]')!;
  }

  it("one color selection produces one legacy event", async () => {
    const { component } = mount();
    const changed = jest.fn();
    component.$on("recordColorChange", changed);
    await flush();
    const apply = await openColor();
    apply.click();
    await flush();
    expect(changed).toHaveBeenCalledTimes(1);
    component.$destroy();
  });

  it("waits for one color write, keeps the palette on failure, and allows retry", async () => {
    let resolve!: (written: boolean) => void;
    const saveRecordColor = jest.fn(() => new Promise<boolean>(done => { resolve = done; }));
    const { component } = mount({ saveRecordColor });
    const changed = jest.fn();
    component.$on("recordColorChange", changed);
    await flush();
    const apply = await openColor();
    apply.click(); apply.click();
    await flush();
    expect(saveRecordColor).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".color-palette")).not.toBeNull();
    resolve(false);
    await flush();
    expect(document.querySelector(".color-palette")).not.toBeNull();
    apply.click();
    await flush();
    expect(saveRecordColor).toHaveBeenCalledTimes(2);
    resolve(true);
    await flush();
    expect(document.querySelector(".color-palette")).toBeNull();
    expect(changed).not.toHaveBeenCalled();
    component.$destroy();
  });

  it("mounts as the engine's floating layer in the anchor's own document", async () => {
    const { anchor } = mount();
    await flush();
    const layer = anchor.ownerDocument.querySelector(".ppp-popup--floating");
    expect(layer).not.toBeNull();
    expect(layer?.parentElement).toBe(anchor.ownerDocument.body);
    expect(layer?.querySelector(".ppp-day-popup")).not.toBeNull();
    expect(layer).toHaveAttribute("role", "dialog");
    // The old private layer is gone.
    expect(document.querySelector(".obsidian-projects-popup-portal")).toBeNull();
  });

  it("Escape closes it and hands focus back to the day", async () => {
    const { component, anchor } = mount();
    const onClose = jest.fn();
    component.$on("close", onClose);
    await flush();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".ppp-popup--floating")).toBeNull();
    expect(document.activeElement).toBe(anchor);
  });

  it("the list's open action asks the view to open the record", async () => {
    const { component } = mount();
    const onRecord = jest.fn();
    component.$on("recordClick", (e) => onRecord(e.detail));
    await flush();
    // A tap on the row shows its actions; "Open" is the first of them.
    document.querySelector<HTMLElement>(".ppp-day-popup .record-item")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    const row = document.querySelector<HTMLElement>(".ppp-day-popup .action-button.primary");
    expect(row).not.toBeNull();
    row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ id: "Notes/a.md" }));
  });
});
