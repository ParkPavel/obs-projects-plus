/**
 * FieldControl.echo.test.ts — N1: a prop change is not user input.
 *
 * obsidian-svelte's inputs re-dispatch their change event on ANY change to
 * their own `value`/`checked` prop, not only on a real keystroke or click
 * (`NumberInput.svelte`, `Switch.svelte`, both `$: dispatch(...)`). Before
 * this fix, FieldControl forwarded that dispatch straight to `onChange`, so a
 * stale record pushed back into a peek/modal (#158) echoed its own stale
 * values back onto the file.
 *
 * The obsidian-svelte inputs are replaced by stand-ins that copy the ONE line
 * the defect lives in: `$: dispatch(<event>, <prop>)`. The contract: an
 * echoed prop must not reach `onChange`, and a real edit must.
 */

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

// The Svelte transform compiles `import dayjs from "dayjs"` to `.default`,
// which the CommonJS build lacks; the real dayjs, shaped as an ES module.
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
    // The stand-ins copy the one line the defect lives in,
    // `$: dispatch(<event>, <prop>)`, and expose a test id. Loading the real
    // component through a deep import worked, and then nothing could find its
    // input — deterministic stand-ins here, the real control is checked live.
    const NumberInput = require("./mocks/EchoNumberInput.mock.svelte").default;
    const Switch = require("./mocks/EchoSwitch.mock.svelte").default;
    // Svelte reads `$$.fragment` when it creates a child; null means "no DOM".
    const Noop = class {
      constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; }
      $set() {}
      $on() { return () => {}; }
      $destroy() {}
    };
    return { Autocomplete: Noop, Icon: Noop, NumberInput, Switch };
  },
  { virtual: true },
);

import { DataFieldType } from "src/lib/dataframe/dataframe";
// Local aliases, not `import type`: esbuild-jest runs babel hoisting on files with
// jest.mock, and babel refuses an imported binding that is used as a type.
type DataField = import("src/lib/dataframe/dataframe").DataField;
const FieldControl = require("../FieldControl.svelte").default;

function mount(field: DataField, value: unknown, extra: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onChange = jest.fn();
  const component = new FieldControl({
    target,
    props: { field, value, onChange, ...extra },
  });
  return {
    component,
    target,
    onChange,
    destroy: () => { component.$destroy(); target.remove(); },
  };
}

const numberField: DataField = {
  name: "score",
  type: DataFieldType.Number,
  repeated: false,
  identifier: false,
  derived: false,
};

const booleanField: DataField = {
  name: "done",
  type: DataFieldType.Boolean,
  repeated: false,
  identifier: false,
  derived: false,
};

describe("FieldControl / echo (N1) — Number", () => {
  it("ignores a prop change echoed back through NumberInput's reactive dispatch", async () => {
    const { component, onChange, destroy } = mount(numberField, 9);
    component.$set({ value: 7 });
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
    destroy();
  });

  it("commits a real DOM edit exactly once", async () => {
    const { target, onChange, destroy } = mount(numberField, 9);
    const input = target.querySelector<HTMLInputElement>("[data-testid='number-input']");
    if (!input) throw new Error("number input not found");
    input.value = "12";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(12);
    destroy();
  });

  it("commits undefined, never NaN, when the input is cleared", async () => {
    const { target, onChange, destroy } = mount(numberField, 9);
    const input = target.querySelector<HTMLInputElement>("[data-testid='number-input']");
    if (!input) throw new Error("number input not found");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(undefined);
    destroy();
  });

  it("readonly: a real DOM edit still commits nothing", async () => {
    const { target, onChange, destroy } = mount(numberField, 9, { readonly: true });
    const input = target.querySelector<HTMLInputElement>("[data-testid='number-input']");
    if (!input) throw new Error("number input not found");
    input.value = "12";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
    destroy();
  });
});

describe("FieldControl / echo (N1) — Boolean (Switch)", () => {
  it("ignores a prop change echoed back through Switch's reactive dispatch", async () => {
    const { component, onChange, destroy } = mount(booleanField, false);
    component.$set({ value: true });
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
    destroy();
  });

  it("commits a real click exactly once", async () => {
    const { target, onChange, destroy } = mount(booleanField, false);
    const btn = target.querySelector<HTMLButtonElement>("[data-testid='switch']");
    if (!btn) throw new Error("switch not found");
    btn.click();
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
    destroy();
  });
});

describe("FieldControl / echo (N1) — Date", () => {
  const dateField: DataField = {
    name: "due",
    type: DataFieldType.Date,
    repeated: false,
    identifier: false,
    derived: false,
  };

  it("a prop change plus blur with no edit commits nothing", async () => {
    const initial = new Date(2026, 0, 15);
    const next = new Date(2026, 4, 5);
    const { component, target, onChange, destroy } = mount(dateField, initial);
    component.$set({ value: next });
    await Promise.resolve();
    const input = target.querySelector<HTMLInputElement>("input[type='date']");
    if (!input) throw new Error("date input not found");
    input.dispatchEvent(new Event("blur"));
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
    destroy();
  });

  it("a real edit plus blur commits exactly once", async () => {
    const initial = new Date(2026, 0, 15);
    const { target, onChange, destroy } = mount(dateField, initial);
    const input = target.querySelector<HTMLInputElement>("input[type='date']");
    if (!input) throw new Error("date input not found");
    input.value = "2026-06-20";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur"));
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(1);
    destroy();
  });
});
