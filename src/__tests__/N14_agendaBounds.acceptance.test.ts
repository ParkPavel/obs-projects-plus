/** Actual Sidebar markup + source CSS; models local/calendar/native insets, not an iPhone keyboard. */
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import dayjs from "dayjs";
import { describeWithChrome, renderProbe, svelteStyle, unscope } from "./support/renderProbe";
jest.mock("dayjs", () => { const actual = jest.requireActual("dayjs"); return Object.assign(actual, { default: actual }); });
jest.mock("src/lib/stores/ui", () => ({ ...jest.requireActual("src/lib/stores/ui"), isMobileDevice: require("svelte/store").writable(true) }));
const Sidebar = require("src/ui/views/Calendar/components/Timeline/AgendaSidebar.svelte").default;
const css = ["ui/app/App.svelte", "ui/views/Calendar/CalendarView.svelte", "ui/views/Calendar/components/Timeline/AgendaSidebar.svelte"].map(file => unscope(svelteStyle(file)));
const active = Object.getOwnPropertyDescriptor(globalThis, "activeDocument");
beforeEach(() => Object.defineProperty(globalThis, "activeDocument", { value: document, configurable: true }));
afterEach(() => { cleanup(); document.body.replaceChildren(); if (active) Object.defineProperty(globalThis, "activeDocument", active); else Reflect.deleteProperty(globalThis, "activeDocument"); });
const bounds = ["boxLeft", "boxRight", "boxTop", "boxBottom", "boxHeight", "padding-bottom"];

describeWithChrome("N14/N20 local Agenda bounds and native keyboard spacing", () => {
  test.each([
    { embedded: true, width: 240, viewport: 390, height: 844, spacing: "78px", scale: 1 },
    { embedded: true, width: 240, viewport: 700, height: 390, spacing: "78px", scale: 1 },
    { embedded: true, width: 280, viewport: 390, height: 844, spacing: "78px", scale: 0.55 },
    { embedded: false, width: 390, viewport: 390, height: 844, spacing: "0", scale: 1 },
    { embedded: false, width: 390, viewport: 390, height: 844, spacing: "calc(34px - 300px + 44px)", scale: 1 },
  ])("embedded$embedded width$width viewport$viewport spacing$spacing scale$scale", async ({ embedded, width, viewport, height, spacing, scale }) => {
    const root = document.createElement("div"); root.className = "projects-main";
    root.innerHTML = `<div class="ppp-database-root" id="canvas"><div class="calendar-zoom-container${embedded ? " calendar-zoom-container--embedded" : ""}" id="calendar"><div class="view-layer view-layer--month view-layer--active" id="month"></div></div></div>`; document.body.append(root);
    const calendar = root.querySelector<HTMLElement>("#calendar")!;
    render(Sidebar, { target: calendar, props: { project: { id: "bounds", name: "Project", agenda: { mode: "custom", custom: { lists: [] } } }, fields: [], records: [], currentDate: dayjs("2026-10-26"), onCreateRecord: () => undefined } });
    await tick(); await tick();
    calendar.querySelector<HTMLElement>(".agenda")!.id = "drawer"; calendar.querySelector<HTMLElement>(".agenda-scrim")!.id = "scrim";
    calendar.querySelector<HTMLElement>(".date-btn")!.id = "date"; calendar.querySelector<HTMLElement>(".ppp-agenda-add-record")!.id = "create";
    const ids = ["canvas", "calendar", "drawer", "scrim", "month", "date", "create"];
    const result = renderProbe({ css: [...css, `:root{--view-bottom-spacing:${spacing};--ppp-touch-target-min:44px;--ppp-border-width:1px} body{margin:0} .projects-main{transform:scale(${scale});transform-origin:top left} #calendar{width:${width}px;height:320px;flex:none}`], html: root.outerHTML, width: viewport, height,
      measure: ids.map(id => ({ id, props: bounds })),
      ...(embedded ? { evaluate: 'const parent=document.getElementById("calendar"), drawer=document.getElementById("drawer"); probe.before=String(drawer.getBoundingClientRect().height); document.documentElement.style.setProperty("--view-bottom-spacing","calc(34px - 300px + 44px)"); parent.style.height="180px"; probe.during=String(drawer.getBoundingClientRect().height); document.documentElement.style.setProperty("--view-bottom-spacing","78px"); parent.style.height="320px"; probe.after=String(drawer.getBoundingClientRect().height);' } : {}),
    });
    const n = (id: string, prop: string) => Number(result[id]![prop]);
    expect(n("drawer", "boxLeft")).toBeGreaterThanOrEqual(n("calendar", "boxLeft") - 1);
    expect(n("drawer", "boxRight")).toBeLessThanOrEqual(n("calendar", "boxRight") + 1);
    expect(n("drawer", "boxBottom")).toBeLessThanOrEqual(n("calendar", "boxBottom") + 1);
    expect(n("drawer", "boxHeight")).toBeCloseTo(320 * scale, 0); expect(n("scrim", "boxHeight")).toBeCloseTo(320 * scale, 0);
    expect(n("date", "boxLeft")).toBeGreaterThanOrEqual(n("drawer", "boxLeft") - 1); expect(n("date", "boxRight")).toBeLessThanOrEqual(n("create", "boxLeft") + 1);
    expect(n("create", "boxRight")).toBeLessThanOrEqual(n("drawer", "boxRight") + 1);
    if (embedded) {
      expect(parseFloat(result["month"]!["padding-bottom"] ?? "")).toBe(0); expect(parseFloat(result["canvas"]!["padding-bottom"] ?? "")).toBe(78);
      expect(Number(result["__probe"]!["before"])).toBeCloseTo(320 * scale, 0); expect(Number(result["__probe"]!["during"])).toBeCloseTo(180 * scale, 0); expect(Number(result["__probe"]!["after"])).toBeCloseTo(320 * scale, 0);
    }
  });
});
