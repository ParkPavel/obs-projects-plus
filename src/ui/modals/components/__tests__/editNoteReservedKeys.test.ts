/**
 * editNoteReservedKeys.test.ts — M03 (S05, C07): the record editor offered the
 * structured `pp_overlay` key as an ordinary text field. The reader turns the
 * nested map into a JSON string (datasources/helpers.ts), so anything typed
 * there would replace the overlay object in the note's frontmatter with text.
 *
 * Only the exact reserved key is withheld: other `pp_*` keys may be user data.
 */

jest.mock("src/ui/components/FieldControl", () => ({
  FieldControl: require("src/ui/components/FieldControl/FieldControl.svelte").default,
}));

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
      NumberInput: require("./mocks/EchoNumberInput.mock.svelte").default,
      Button: require("./mocks/Button.mock.svelte").default,
      ModalButtonGroup: require("./mocks/ModalButtonGroup.mock.svelte").default,
      ModalContent: require("./mocks/Passthrough.mock.svelte").default,
      ModalLayout: require("./mocks/Passthrough.mock.svelte").default,
      SettingItem: require("./mocks/NamedSettingItem.mock.svelte").default,
    };
  },
  { virtual: true },
);

import { DataFieldType } from "src/lib/dataframe/dataframe";
import { changedKeys } from "src/lib/recordDiff";
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;
const EditNote = require("../EditNote.svelte").default;

const field = (name: string, type: DataField["type"]): DataField =>
  ({ name, type, repeated: false, identifier: false, derived: false });

// What the frontmatter reader hands over for a note with an overlay: the map
// arrives as a String field holding its JSON (datasources/helpers.ts).
const overlayJson = JSON.stringify({ hidden: ["secret"], pinned: ["status"], order: ["score"], future: { keep: 1 } });
const fields = [
  field("score", DataFieldType.Number),
  field("pp_overlay", DataFieldType.String),
  field("pp_budget", DataFieldType.String),
  field("status", DataFieldType.String),
];
const record = (): DataRecord => ({
  id: "a.md",
  values: { score: 6, pp_overlay: overlayJson, pp_budget: "12", status: "open" },
});

function mount() {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onSave = jest.fn();
  const component = new EditNote({ target, props: { fields, record: record(), onSave, autosave: true } });
  return { target, onSave, destroy: () => { component.$destroy(); target.remove(); } };
}

const offered = (target: HTMLElement) =>
  Array.from(target.querySelectorAll<HTMLElement>("[data-testid='setting-item']")).map((el) => el.dataset["name"]);

describe("EditNote — reserved pp_overlay is not an editable field (M03 C3)", () => {
  it("does not offer pp_overlay, but keeps other pp_* and ordinary fields", () => {
    const { target, destroy } = mount();
    const names = offered(target);
    expect(names).not.toContain("pp_overlay");
    expect(names).toEqual(expect.arrayContaining(["score", "pp_budget", "status"]));
    expect(target.querySelector("input[placeholder='pp_overlay']")).toBeNull();
    destroy();
  });
});

describe("EditNote — saving another field leaves pp_overlay untouched (M03 C4)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("the saved record carries the overlay as read, and only the edited key changes", async () => {
    const { target, onSave, destroy } = mount();
    const input = target.querySelector<HTMLInputElement>("[data-testid='number-input']");
    if (!input) throw new Error("number input not found");
    input.value = "8";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await jest.advanceTimersByTimeAsync(300);

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved: DataRecord = onSave.mock.calls[0][0];
    expect(saved.values["pp_overlay"]).toBe(overlayJson);
    expect(JSON.parse(saved.values["pp_overlay"] as string)).toEqual({ hidden: ["secret"], pinned: ["status"], order: ["score"], future: { keep: 1 } });
    // viewApi writes only the keys that differ from the stored record.
    expect(changedKeys(record(), saved)).toEqual(["score"]);
    destroy();
  });
});
