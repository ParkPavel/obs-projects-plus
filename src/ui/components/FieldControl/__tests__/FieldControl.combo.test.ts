/**
 * stab-forms, step 5 — FieldControl's suggestion box (a text field with
 * options of its own, or with the values already used in the project) is the
 * shared ComboField instead of obsidian-svelte's Autocomplete.
 *
 * What stays from N1 (a prop change is not user input): an echoed prop reaches
 * `onChange` never, a real edit exactly once.
 *
 * Why these fail on the old code: obsidian-svelte's Autocomplete is a separate
 * control with no `role="combobox"` input of ours (the first
 * `comboInputs(...)[0]` is undefined and throws), it reported a change on every
 * `value` prop update, and Escape did not restore the entry text.
 */

import "@testing-library/jest-dom";

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
import {
  comboInputs,
  enter,
  listbox,
  optionLabels,
  optionRows,
  press,
  settle,
  tap,
  typeInto,
} from "src/ui/components/fields/__tests__/support/comboKit";
// Local alias, not `import type`: babel hoisting on files with jest.mock refuses
// an imported binding that is used as a type.
type DataField = import("src/lib/dataframe/dataframe").DataField;
const FieldControl = require("../FieldControl.svelte").default;

const optionField: DataField = {
  name: "status",
  type: DataFieldType.String,
  repeated: false,
  identifier: false,
  derived: false,
  typeConfig: { options: ["Todo", "Doing", "Done"] },
} as DataField;

function mount(extra: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onChange = jest.fn();
  const component = new FieldControl({ target, props: { field: optionField, value: "Todo", onChange, ...extra } });
  return {
    target,
    component,
    onChange,
    box: () => comboInputs(target)[0]!,
    destroy: () => {
      component.$destroy();
      target.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("FieldControl — suggestion box", () => {
  test.each([
    [DataFieldType.Select, "owner"], [DataFieldType.Status, "owner"],
    [DataFieldType.Select, "destroy"], [DataFieldType.Status, "destroy"],
  ])("%s retires an unconfirmed canonical draft on %s without writing it", async (type, retirement) => {
    const m = mount({ field: { ...optionField, type } });
    try {
      const input = m.box(); await enter(input); typeInto(input, "Done"); await settle();
      if (retirement === "destroy") m.destroy();
      else { m.component.$set({ field: { ...optionField, name: "other", type }, value: "Todo" }); await settle(); }
      press(input, "Enter"); input.dispatchEvent(new Event("blur")); await settle();
      expect(m.onChange).not.toHaveBeenCalled();
      if (retirement === "owner") { expect(m.box()).not.toBe(input); expect(m.box().value).toBe("Todo"); }
    } finally { m.destroy(); }
  });

  test.each([DataFieldType.Select, DataFieldType.Status])("configured %s neither offers nor writes undeclared observed values", async type => {
    const m = mount({ field: { ...optionField, type }, value: "Legacy", suggestions: ["Observed"] });
    await enter(m.box()); expect(optionLabels()).toEqual(["Todo", "Doing", "Done"]);
    typeInto(m.box(), "Undeclared"); press(m.box(), "Enter"); await settle(); expect(m.onChange).not.toHaveBeenCalled(); m.destroy();
  });
  test("a field with options of its own is a combobox over them", async () => {
    const m = mount();
    await enter(m.box());
    expect(optionLabels()).toEqual(["Todo", "Doing", "Done"]);
    m.destroy();
  });

  test("a field without options offers the values already used in the project", async () => {
    const plain = { ...optionField, typeConfig: {} } as DataField;
    const m = mount({ field: plain, suggestions: ["Red", "Blue"] });
    await enter(m.box());
    expect(optionLabels()).toEqual(["Red", "Blue"]);
    m.destroy();
  });

  test("Select and Status use the same typed suggestion control", async () => {
    const select = { ...optionField, type: DataFieldType.Select };
    const m = mount({ field: select });
    await enter(m.box());
    expect(optionLabels()).toEqual(["Todo", "Doing", "Done"]);
    m.destroy();
  });

  test("typing filters, a pick writes once, the blur after it adds nothing", async () => {
    const m = mount();
    await enter(m.box());
    typeInto(m.box(), "Doi");
    await settle();
    expect(optionLabels()).toEqual(["Doing"]);
    expect(m.onChange).not.toHaveBeenCalled();
    tap(optionRows()[0]!);
    m.box().blur();
    await settle();
    expect(m.onChange).toHaveBeenCalledTimes(1);
    expect(m.onChange).toHaveBeenCalledWith("Doing");
    m.destroy();
  });

  test("text outside the list is kept: Enter writes it once", async () => {
    const m = mount();
    await enter(m.box());
    typeInto(m.box(), "Blocked");
    press(m.box(), "Enter");
    m.box().blur();
    await settle();
    expect(m.onChange).toHaveBeenCalledTimes(1);
    expect(m.onChange).toHaveBeenCalledWith("Blocked");
    m.destroy();
  });

  test("Escape closes the list, then restores the entry text without writing", async () => {
    const m = mount();
    await enter(m.box());
    typeInto(m.box(), "Doi");
    await settle();
    expect(listbox()).not.toBeNull();
    press(m.box(), "Escape");
    await settle();
    expect(listbox()).toBeNull();
    press(m.box(), "Escape");
    await settle();
    expect(m.box().value).toBe("Todo");
    m.box().blur();
    await settle();
    expect(m.onChange).not.toHaveBeenCalled();
    m.destroy();
  });

  test("N1: a prop change echoed back is not user input", async () => {
    const m = mount();
    m.component.$set({ value: "Done" });
    await settle();
    expect(m.box().value).toBe("Done");
    expect(m.onChange).not.toHaveBeenCalled();
    m.destroy();
  });

  test("readonly: the box is disabled and writes nothing", async () => {
    const m = mount({ readonly: true });
    expect(m.box()).toBeDisabled();
    m.destroy();
  });

  test("computed fields render their value without an editor", () => {
    const formula = {
      name: "Total",
      type: DataFieldType.Formula,
      repeated: false,
      identifier: false,
      derived: true,
    } as DataField;
    const m = mount({ field: formula, value: 0 });
    expect(m.target.querySelector("input")).toBeNull();
    expect(m.target.textContent).toContain("0");
    expect(m.onChange).not.toHaveBeenCalled();
    m.destroy();
  });
});
