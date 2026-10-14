/**
 * 3.7.2 B1b — FieldControl's text, image, colour and time entries moved from
 * raw inputs onto TextField. What each one did before must still hold: a
 * debounced live save while typing, a final save on leaving the field (once),
 * a canonical hex for a colour; and the new kit rules: Escape restores the
 * text AND undoes a debounced write, a time is typed as HH:MM.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

jest.mock(
  "src/ui/components/ColorPicker",
  () => ({ ColorPicker: class { constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; } $set() {} $on() { return () => {}; } $destroy() {} } }),
  { virtual: true },
);

jest.mock(
  "src/ui/components/ImagePreview",
  () => ({ ImagePreview: class { constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; } $set() {} $on() { return () => {}; } $destroy() {} } }),
  { virtual: true },
);

jest.mock("dayjs", () => {
  const real = jest.requireActual("dayjs");
  return { __esModule: true, default: real };
});

jest.mock(
  "src/ui/components/DateInput.svelte",
  () => require("./mocks/EchoDateInput.mock.svelte"),
);

jest.mock(
  "src/ui/components/TagList",
  () => ({ TagList: class { constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; } $set() {} $on() { return () => {}; } $destroy() {} } }),
  { virtual: true },
);

jest.mock(
  "obsidian-svelte",
  () => {
    const Noop = class {
      constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; }
      $set() {}
      $on() { return () => {}; }
      $destroy() {}
    };
    return { Icon: Noop, NumberInput: Noop, Switch: Noop };
  },
  { virtual: true },
);

import { DataFieldType } from "src/lib/dataframe/dataframe";
type DataField = import("src/lib/dataframe/dataframe").DataField;
const FieldControl = require("../FieldControl.svelte").default;

const fieldNamed = (name: string): DataField =>
  ({ name, type: DataFieldType.String, repeated: false, identifier: false, derived: false, typeConfig: {} }) as DataField;

function mount(name: string, value: string) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onChange = jest.fn();
  const component = new FieldControl({ target, props: { field: fieldNamed(name), value, onChange } });
  const input = target.querySelector("input") as HTMLInputElement;
  return { target, component, onChange, input };
}

async function type(el: HTMLInputElement, text: string): Promise<void> {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}
const key = (el: HTMLElement, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = "";
});

describe("FieldControl text entry on TextField", () => {
  it("saves 500 ms after typing stops, and the blur after it writes nothing more", async () => {
    const m = mount("title", "a");
    expect(m.input).toHaveClass("ppp-text-field");
    m.input.focus();
    await type(m.input, "ab");
    expect(m.onChange).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(m.onChange).toHaveBeenCalledWith("ab");
    m.component.$set({ value: "ab" });
    await tick();
    m.input.blur();
    expect(m.onChange).toHaveBeenCalledTimes(1);
  });

  it("a blur before the debounce saves once", async () => {
    const m = mount("title", "a");
    m.input.focus();
    await type(m.input, "abc");
    m.input.blur();
    jest.advanceTimersByTime(1000);
    expect(m.onChange).toHaveBeenCalledTimes(1);
    expect(m.onChange).toHaveBeenCalledWith("abc");
  });

  it("Escape restores the text and undoes a debounced write", async () => {
    const m = mount("title", "a");
    m.input.focus();
    await type(m.input, "xyz");
    jest.advanceTimersByTime(500);
    m.component.$set({ value: "xyz" });
    await tick();
    key(m.input, "Escape");
    await tick();
    expect(m.input.value).toBe("a");
    expect(m.onChange).toHaveBeenLastCalledWith("a");
  });

  it("a colour is stored canonical", async () => {
    const m = mount("color", "#000000");
    expect(m.input).toHaveClass("color-hex-input");
    m.input.focus();
    await type(m.input, "#ABC");
    key(m.input, "Enter");
    expect(m.onChange).toHaveBeenCalledWith("#aabbcc");
  });

  it("a time is typed as HH:MM; other text is refused", async () => {
    const m = mount("startTime", "09:00");
    expect(m.input).toHaveAttribute("type", "text");
    m.input.focus();
    await type(m.input, "25:00");
    key(m.input, "Enter");
    expect(m.onChange).not.toHaveBeenCalled();
    await type(m.input, "7:30");
    key(m.input, "Enter");
    expect(m.onChange).toHaveBeenCalledWith("07:30");
  });
});
