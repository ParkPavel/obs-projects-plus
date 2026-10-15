/**
 * dateField.test.ts — 3.7.2 B1 (C4, C5): every date field of the plugin takes
 * typed text and keeps the calendar one tap away; a refused draft never
 * reaches the consumer, so the stored date survives.
 */
import { tick } from "svelte";

jest.mock("obsidian-svelte", () => ({
  Icon: class {
    constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; }
    $set() {}
    $on() { return () => {}; }
    $destroy() {}
  },
}), { virtual: true });

const DateInput = require("src/ui/components/DateInput.svelte").default;
const DatetimeInput = require("src/ui/components/DatetimeInput.svelte").default;

function mount(Component: any, value: Date | null) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new Component({ target, props: { value } });
  const changes: Array<Date | null> = [];
  let blurs = 0;
  component.$on("change", (e: CustomEvent<Date | null>) => changes.push(e.detail));
  component.$on("blur", () => { blurs++; });
  const text = () => target.querySelector<HTMLInputElement>("input.ppp-date-field__text")!;
  const native = () => target.querySelector<HTMLInputElement>("input.ppp-date-field__native")!;
  const button = () => target.querySelector<HTMLButtonElement>("button.ppp-date-field__calendar")!;
  return { target, component, changes, blurs: () => blurs, text, native, button, destroy: () => { component.$destroy(); target.remove(); } };
}

function type(el: HTMLInputElement, value: string) {
  el.dispatchEvent(new FocusEvent("focus"));
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
const key = (el: HTMLInputElement, k: string, extra: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));

describe("DateInput — typed date with a calendar button (C4)", () => {
  it("renders a text field showing DD.MM.YYYY and a calendar button", async () => {
    const m = mount(DateInput, new Date(2026, 9, 14));
    await tick();
    expect(m.text().type).toBe("text");
    expect(m.text().value).toBe("14.10.2026");
    expect(m.button()).not.toBeNull();
    m.destroy();
  });

  it("14.10.2026 + Enter sends change with that day", async () => {
    const m = mount(DateInput, null);
    await tick();
    type(m.text(), "14.10.2026");
    key(m.text(), "Enter");
    await tick();
    expect(m.changes).toHaveLength(1);
    const d = m.changes[0]!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 14]);
    m.destroy();
  });

  it("the calendar button opens the platform picker", async () => {
    const m = mount(DateInput, new Date(2026, 9, 14));
    await tick();
    const showPicker = jest.fn();
    (m.native() as any).showPicker = showPicker;
    m.button().click();
    await tick();
    expect(showPicker).toHaveBeenCalledTimes(1);
    expect(m.native().type).toBe("date");
    m.destroy();
  });

  it("a day picked in the platform picker is sent as change", async () => {
    const m = mount(DateInput, null);
    await tick();
    m.native().value = "2026-11-01";
    m.native().dispatchEvent(new Event("change"));
    expect(m.changes[0]?.getDate()).toBe(1);
    expect(m.changes[0]?.getMonth()).toBe(10);
    m.destroy();
  });

  it("reports blur once focus leaves the field, after the draft committed", async () => {
    const m = mount(DateInput, null);
    await tick();
    type(m.text(), "1.11.2026");
    m.text().dispatchEvent(new FocusEvent("blur"));
    m.text().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await tick();
    await tick();
    expect(m.changes).toHaveLength(1);
    expect(m.blurs()).toBe(1);
    m.destroy();
  });
});

describe("DateInput — a refused draft keeps the stored date (C5)", () => {
  it("32.10 + Enter sends nothing and marks the field", async () => {
    const m = mount(DateInput, new Date(2026, 9, 14));
    await tick();
    type(m.text(), "32.10");
    key(m.text(), "Enter");
    await tick();
    expect(m.changes).toEqual([]);
    expect(m.text().getAttribute("aria-invalid")).toBe("true");
    m.destroy();
  });

  it("Escape restores the text the field had", async () => {
    const m = mount(DateInput, new Date(2026, 9, 14));
    await tick();
    type(m.text(), "1.1");
    key(m.text(), "Escape");
    await tick();
    expect(m.text().value).toBe("14.10.2026");
    expect(m.changes).toEqual([]);
    m.destroy();
  });

  it("Enter during an IME composition does not commit", async () => {
    const m = mount(DateInput, null);
    await tick();
    type(m.text(), "14.10.2026");
    m.text().dispatchEvent(new CompositionEvent("compositionstart"));
    key(m.text(), "Enter", { isComposing: true } as KeyboardEventInit);
    await tick();
    expect(m.changes).toEqual([]);
    m.destroy();
  });
});

describe("DatetimeInput — date and time", () => {
  it("shows and takes «DD.MM.YYYY HH:MM»; a typed day keeps the time", async () => {
    const m = mount(DatetimeInput, new Date(2026, 9, 14, 9, 30));
    await tick();
    expect(m.text().value).toBe("14.10.2026 09:30");
    expect(m.native().type).toBe("datetime-local");
    type(m.text(), "15.10.2026");
    key(m.text(), "Enter");
    await tick();
    const d = m.changes[0]!;
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([15, 9, 30]);
    m.destroy();
  });
});
