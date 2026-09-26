/**
 * EditNote.echo.test.ts — N1 end-to-end: a stale record pushed back into
 * EditNote (the shape `View.svelte`'s peek used to push on every re-render,
 * #158) must not re-save, and `readonly` must block every write path.
 *
 * `ModalLayout`, `ModalContent` and `SettingItem` need stand-ins that render
 * their slots — `src/__mocks__/obsidian-svelte.js` renders none of them, so a
 * field mounted inside one would never reach the DOM. `NumberInput` is the
 * same stand-in as in `FieldControl.echo.test.ts`.
 */

// Through its index the jest Svelte transform hands back the module object
// rather than the component; every FieldControl test requires the .svelte file
// directly, and so does this one.
jest.mock("src/ui/components/FieldControl", () => ({
  FieldControl: require("src/ui/components/FieldControl/FieldControl.svelte").default,
}));

// The Svelte transform compiles `import dayjs from "dayjs"` to `.default`,
// which the CommonJS build lacks; the real dayjs, shaped as an ES module.
jest.mock("dayjs", () => {
  const real = jest.requireActual("dayjs");
  return { __esModule: true, default: real };
});

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

jest.mock(
  "src/ui/components/TagList",
  () => ({ TagList: class { constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; } $set() {} $on() { return () => {}; } $destroy() {} } }),
  { virtual: true },
);

jest.mock(
  "obsidian-svelte",
  () => {
    // A stand-in that copies the line the defect lives in; the real control is checked live.
    const NumberInput = require("./mocks/EchoNumberInput.mock.svelte").default;
    // Svelte reads `$$.fragment` when it creates a child; null means "no DOM".
    const Noop = class {
      constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; }
      $set() {}
      $on() { return () => {}; }
      $destroy() {}
    };
    return {
      Autocomplete: Noop,
      Switch: Noop,
      Icon: Noop,
      Callout: Noop,
      Typography: Noop,
      NumberInput,
      Button: require("./mocks/Button.mock.svelte").default,
      ModalButtonGroup: require("./mocks/ModalButtonGroup.mock.svelte").default,
      ModalContent: require("./mocks/Passthrough.mock.svelte").default,
      ModalLayout: require("./mocks/Passthrough.mock.svelte").default,
      SettingItem: require("./mocks/Passthrough.mock.svelte").default,
    };
  },
  { virtual: true },
);

import { DataFieldType } from "src/lib/dataframe/dataframe";
// Local aliases, not `import type`: esbuild-jest runs babel hoisting on files with
// jest.mock, and babel refuses an imported binding that is used as a type.
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;
const EditNote = require("../EditNote.svelte").default;

const scoreField: DataField = {
  name: "score",
  type: DataFieldType.Number,
  repeated: false,
  identifier: false,
  derived: false,
};

function mount(record: DataRecord, extra: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onSave = jest.fn();
  const component = new EditNote({
    target,
    props: { fields: [scoreField], record, onSave, autosave: true, ...extra },
  });
  return {
    component,
    target,
    onSave,
    destroy: () => { component.$destroy(); target.remove(); },
  };
}

function numberInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>("[data-testid='number-input']");
  if (!input) throw new Error("number input not found");
  return input;
}

describe("EditNote / echo (N1) — a stale record push does not re-save", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("types once, saves once, then a stale push of the OLD record saves nothing more", async () => {
    const { component, target, onSave, destroy } = mount({ id: "a.md", values: { score: 6 } });

    const input = numberInput(target);
    input.value = "8";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await jest.advanceTimersByTimeAsync(300);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ id: "a.md", values: { score: 8 } });

    // #158 N1: the peek used to push this exact shape back on every
    // re-render — the SAME pre-edit record, handed to EditNote again as if
    // it were fresh.
    component.$set({ record: { id: "a.md", values: { score: 6 } } });
    await jest.advanceTimersByTimeAsync(1000);

    // On main, this fires a second `onSave` with the stale `score: 6`.
    expect(onSave).toHaveBeenCalledTimes(1);

    destroy();
  });
});

describe("EditNote / echo (N1) — readonly", () => {
  it("typing never saves, and there is no Save button", async () => {
    const { target, onSave, destroy } = mount(
      { id: "a.md", values: { score: 6 } },
      { autosave: false, readonly: true }
    );

    const input = numberInput(target);
    input.value = "8";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();

    expect(onSave).not.toHaveBeenCalled();
    expect(target.querySelector("[data-testid='modal-button-group']")).toBeNull();

    destroy();
  });
});
