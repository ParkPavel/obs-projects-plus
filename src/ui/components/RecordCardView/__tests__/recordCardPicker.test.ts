/**
 * stab-input — the RecordCardView icon picker keeps the typed icon across a
 * flush, is seeded from the record's icon when it opens, and is shut when the
 * panel closes.
 *
 * The picker input was bound to `pickerInput` while
 * `$: if (!open) { pickerOpen = false; pickerInput = ""; }` assigned it — the statement form of the Svelte 3
 * binding trap (R0.34) that reset typed text in the 3.7.0 table cells. The
 * reset now lives in a function the `$:` calls.
 *
 * EditNote is replaced by an inert stand-in: the picker is the subject, and the
 * editor needs a vault this test does not build.
 */

jest.mock("src/ui/modals/components/EditNote.svelte", () => {
  // Svelte reads `$$.fragment` when it creates a child; null means "no DOM".
  const Noop = class {
    constructor() {
      (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] };
    }
    $set() {}
    $on() {
      return () => {};
    }
    $destroy() {}
  };
  return { __esModule: true, default: Noop };
});

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";

import { DataFieldType } from "src/lib/dataframe/dataframe";
// Local aliases, not `import type`: esbuild-jest runs babel hoisting on files with
// jest.mock, and babel refuses an imported binding that is used as a type.
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;
const RecordCardView = require("../RecordCardView.svelte").default;

const iconField: DataField = {
  name: "icon",
  type: DataFieldType.String,
  repeated: false,
  identifier: false,
  derived: false,
};

const recordWith = (icon: string): DataRecord => ({ id: "Notes/a.md", values: { icon } });

function mount(record: DataRecord) {
  const saved: DataRecord[] = [];
  const result = render(RecordCardView, {
    props: { open: true, fields: [iconField], record, onSave: (r: DataRecord) => void saved.push(r) },
  });
  return { ...result, saved };
}

const pickerButton = (): HTMLButtonElement => {
  const el = document.querySelector<HTMLButtonElement>(".ppp-rcv-icon-btn");
  if (!el) throw new Error("no icon button rendered");
  return el;
};

const pickerInput = (): HTMLInputElement | null => document.querySelector<HTMLInputElement>(".ppp-rcv-icon-input");

async function openPicker(): Promise<HTMLInputElement> {
  pickerButton().click();
  await tick();
  const el = pickerInput();
  if (!el) throw new Error("the picker did not open");
  return el;
}

describe("RecordCardView — icon picker", () => {
  it("is seeded with the record's icon and keeps the typed one across a flush", async () => {
    const { saved } = mount(recordWith("🔥"));
    await tick();
    const el = await openPicker();
    expect(el.value).toBe("🔥");

    el.value = "star";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    await tick();
    expect(el.value).toBe("star");

    document.querySelector<HTMLButtonElement>(".ppp-rcv-icon-confirm")?.click();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.values["icon"]).toBe("star");
  });

  it("is seeded from the record's current icon when it changed while the picker was shut", async () => {
    const { component } = mount(recordWith("🔥"));
    await tick();
    await component.$set({ record: recordWith("🌙") });
    await tick();
    const el = await openPicker();
    expect(el.value).toBe("🌙");
  });

  it("is shut when the panel closes, and reopens from the record rather than the half-typed text", async () => {
    const { component } = mount(recordWith("🔥"));
    await tick();
    const el = await openPicker();
    el.value = "half typed";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();

    await component.$set({ open: false });
    await tick();
    expect(pickerInput()).toBeNull();

    await component.$set({ open: true });
    await tick();
    expect(pickerInput()).toBeNull();
    const reopened = await openPicker();
    expect(reopened.value).toBe("🔥");
  });
});
