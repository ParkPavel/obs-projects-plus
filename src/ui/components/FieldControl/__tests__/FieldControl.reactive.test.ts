/**
 * REFACTOR-304 — FieldControl reactive sync regression.
 *
 * Pins the contract that when the parent updates the `value` prop
 * after mount, the internal `cachedValue` (used by date inputs to
 * stage the next `onChange` call) re-derives from the new value.
 *
 * Pre-fix: `let cachedValue = isDate(value) ? value : null;` ran
 * once at construction, so a parent-side change left `cachedValue`
 * stale and an `on:blur` that didn't go through `on:input` first
 * (e.g. user opens picker, immediately blurs) would push the
 * obsolete date back through `onChange`.
 *
 * Post-fix: `$: cachedValue = isDate(value) ? value : null;` keeps
 * the cache in lockstep with the prop.
 */

jest.mock(
  "obsidian-svelte",
  () => ({
    Autocomplete: class { $set() {} $destroy() {} },
    NumberInput: class { $set() {} $destroy() {} },
    Switch: class { $set() {} $destroy() {} },
    Icon: class { $set() {} $destroy() {} },
  }),
  { virtual: true },
);

jest.mock(
  "src/ui/components/ColorPicker",
  () => ({ ColorPicker: class { $set() {} $destroy() {} } }),
  { virtual: true },
);

jest.mock(
  "src/ui/components/ImagePreview",
  () => ({ ImagePreview: class { $set() {} $destroy() {} } }),
  { virtual: true },
);

jest.mock(
  "src/ui/components/TagList",
  () => ({ TagList: class { $set() {} $destroy() {} } }),
  { virtual: true },
);

jest.mock(
  "src/ui/components/DateInput.svelte",
  () => require("./mocks/DateInput.mock.svelte"),
);

jest.mock(
  "src/ui/components/DatetimeInput.svelte",
  () => require("./mocks/DatetimeInput.mock.svelte"),
);

import { DataFieldType } from "src/lib/dataframe/dataframe";
const FieldControl = require("../FieldControl.svelte").default;

describe("FieldControl / reactive sync (REFACTOR-304)", () => {
  function mount(value: Date | null) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const onChange = jest.fn();
    const component = new FieldControl({
      target,
      props: {
        field: {
          name: "due",
          type: DataFieldType.Date,
          typeConfig: { time: true },
          repeated: false,
          identifier: false,
          derived: false,
        },
        value,
        onChange,
      },
    });
    return { component, target, onChange, destroy: () => { component.$destroy(); target.remove(); } };
  }

  it("re-derives cachedValue when parent updates value prop", async () => {
    const initial = new Date(2026, 0, 15);
    const next = new Date(2026, 4, 5);
    const { component, target, onChange, destroy } = mount(initial);

    // Parent updates the value prop after mount.
    component.$set({ value: next });
    await Promise.resolve();

    // Trigger blur without an intermediate input event (the regression
    // scenario). The mocked DateInput exposes a button that dispatches
    // `blur` directly so the on:blur handler calls onChange with the
    // currently-cached value.
    const btn = target.querySelector<HTMLButtonElement>("[data-testid='blur-only']");
    if (!btn) throw new Error("DateInput mock missing blur trigger");
    btn.click();

    expect(onChange).toHaveBeenCalledTimes(1);
    const passed = onChange.mock.calls[0]![0] as Date;
    expect(passed.getTime()).toBe(next.getTime());

    destroy();
  });

  it("falls back to null when parent updates to a non-date value", async () => {
    const { component, target, onChange, destroy } = mount(new Date(2026, 0, 15));
    component.$set({ value: null });
    await Promise.resolve();
    const btn = target.querySelector<HTMLButtonElement>("[data-testid='blur-only']");
    if (!btn) throw new Error("DateInput mock missing blur trigger");
    btn.click();
    expect(onChange).toHaveBeenCalledWith(null);
    destroy();
  });
});
