/**
 * 3.7.2 B1b — FieldControl's text, image, colour and time entries moved from
 * raw inputs onto TextField. What each one did before must still hold: a
 * debounced live save while typing, a final save on leaving the field (once),
 * a canonical hex for a colour; and the new kit rules: Escape restores the
 * text AND undoes a debounced write, a time is typed as HH:MM.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";
import { optionRows, tap } from "src/ui/components/fields/__tests__/support/comboKit";
import { get } from "svelte/store";
import { app } from "src/lib/stores/obsidian";

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

describe("FieldControl text entry on shared fields", () => {
  it("image controls share the permitted vault-file source and release it without leaking paths into ordinary properties", async () => {
    const { TFile } = require("obsidian"), previous = get(app), events = new Map<string, () => void>();
    let files = [new TFile("Attachments/old.png"), new TFile("Private/note.md")];
    const owner = { vault: { getAllLoadedFiles: jest.fn(() => files), getRoot: () => ({ path: "/" }),
      on: jest.fn((name: string, callback: () => void) => { events.set(name, callback); return name; }), offref: jest.fn() } };
    app.set(owner as never); const first = mount("cover", ""), second = mount("banner", ""), ordinary = mount("category", "");
    try {
      await tick(); expect(owner.vault.getAllLoadedFiles).toHaveBeenCalledTimes(1); expect(owner.vault.on).toHaveBeenCalledTimes(3);
      first.input.focus(); await type(first.input, "draft"); first.input.setSelectionRange(1, 3);
      files = [...files, new TFile("Attachments/draft image.png")]; events.get("create")!(); jest.advanceTimersByTime(100); await tick(); await tick();
      expect(first.target.querySelector("input")).toBe(first.input); expect(first.input.value).toBe("draft");
      expect([first.input.selectionStart, first.input.selectionEnd]).toEqual([1, 3]); expect(document.activeElement).toBe(first.input);
      expect(first.onChange).not.toHaveBeenCalled(); expect(optionRows().map(row => row.textContent)).toEqual(["Attachments/draft image.png"]);
      tap(optionRows()[0]!); await tick(); expect(first.onChange).toHaveBeenCalledWith("Attachments/draft image.png");
      ordinary.input.focus(); await tick(); await tick(); expect(optionRows()).toHaveLength(0); expect(ordinary.onChange).not.toHaveBeenCalled();
      first.component.$destroy(); expect(owner.vault.offref).not.toHaveBeenCalled();
      second.component.$destroy(); expect(owner.vault.offref).toHaveBeenCalledTimes(3);
    } finally { first.component.$destroy(); second.component.$destroy(); ordinary.component.$destroy(); app.set(previous); }
  });
  it.each([
    ["cover", "Attachments/My image.png", "Attachments/My image.png"],
    ["starttime", "09:30", "09:30"],
    ["color", "#ABC", "#aabbcc"],
  ])("%s selects a semantic suggestion on its original input", async (name, suggestion, stored) => {
    const m = mount(name, "");
    try {
      m.component.$set({ suggestions: [suggestion] }); await tick(); m.input.focus(); await tick(); await tick();
      expect(m.input).toHaveAttribute("role", "combobox"); const option = optionRows().find(row => row.textContent === suggestion);
      expect(option).toBeDefined(); tap(option!); await tick();
      expect(m.onChange).toHaveBeenCalledTimes(1); expect(m.onChange).toHaveBeenCalledWith(stored);
      expect(m.target.querySelector("input")).toBe(m.input); expect(document.activeElement).toBe(m.input);
    } finally { m.component.$destroy(); }
  });
  it("accepting an untouched external value on blur cannot queue a live save or overwrite its successor", async () => {
    const m = mount("title", "a");
    try {
      m.input.focus(); m.component.$set({ value: "b" }); await tick();
      expect(m.input.value).toBe("a"); m.input.blur(); await tick(); expect(m.input.value).toBe("b");
      m.component.$set({ value: "c" }); await tick(); jest.advanceTimersByTime(1000);
      expect(m.input.value).toBe("c"); expect(m.onChange).not.toHaveBeenCalled();
    } finally { m.component.$destroy(); }
  });

  it("late suggestions preserve the original scalar input, draft, caret and focus", async () => {
    const m = mount("title", "a");
    try {
      m.input.focus(); await type(m.input, "private draft"); m.input.setSelectionRange(1, 5);
      m.component.$set({ suggestions: ["private draft", "another"] }); await tick();
      expect(m.target.querySelector("input")).toBe(m.input); expect(m.input.value).toBe("private draft");
      expect([m.input.selectionStart, m.input.selectionEnd]).toEqual([1, 5]); expect(document.activeElement).toBe(m.input);
      expect(m.onChange).not.toHaveBeenCalled();
    } finally { m.component.$destroy(); }
  });

  it("suggestion-backed text remains commit-only and late options retire the old live timer", async () => {
    const m = mount("title", "a");
    try {
      m.input.focus(); await type(m.input, "private draft");
      m.component.$set({ suggestions: ["private draft"] }); await tick(); jest.advanceTimersByTime(1000);
      expect(m.onChange).not.toHaveBeenCalled(); expect(m.target.querySelector("input")).toBe(m.input);
      await type(m.input, "typed with source"); jest.advanceTimersByTime(1000); expect(m.onChange).not.toHaveBeenCalled();
      key(m.input, "Enter"); await tick(); expect(m.onChange).toHaveBeenCalledTimes(1); expect(m.onChange).toHaveBeenCalledWith("typed with source");
    } finally { m.component.$destroy(); }
  });

  it("changing the scalar owner retires its input and cannot commit the previous draft to the new field", async () => {
    const m = mount("title", "a");
    try {
      m.input.focus(); await type(m.input, "private draft");
      m.component.$set({ field: fieldNamed("other"), value: "b" }); await tick();
      expect(m.target.querySelector("input")).not.toBe(m.input); expect(m.target.querySelector("input")?.value).toBe("b");
      key(m.input, "Enter"); m.input.dispatchEvent(new Event("blur")); jest.advanceTimersByTime(1000);
      expect(m.onChange).not.toHaveBeenCalled();
    } finally { m.component.$destroy(); }
  });

  it("a retired scalar's keyboard callback cannot submit its draft after the field name changes", async () => {
    const m = mount("title", "a");
    try {
      m.input.focus(); await type(m.input, "private draft");
      m.component.$set({ field: fieldNamed("other"), value: "b" }); await tick();
      key(m.input, "Enter"); m.input.dispatchEvent(new Event("blur")); jest.advanceTimersByTime(1000);
      expect(m.onChange).not.toHaveBeenCalled();
    } finally { m.component.$destroy(); }
  });

  it("locking and unlocking a field cancels its pending live save", async () => {
    const m = mount("title", "a"); m.input.focus(); await type(m.input, "old draft");
    m.component.$set({ readonly: true }); await tick(); m.component.$set({ readonly: false }); await tick();
    jest.advanceTimersByTime(1000); expect(m.onChange).not.toHaveBeenCalled(); m.component.$destroy();
  });
  it("locking a field before the debounce never writes through its callback", async () => {
    const m = mount("title", "a"); m.input.focus(); await type(m.input, "old draft");
    m.component.$set({ readonly: true }); await tick(); jest.advanceTimersByTime(1000);
    expect(m.onChange).not.toHaveBeenCalled(); m.component.$destroy();
  });
  it.each([fieldNamed("other"), { ...fieldNamed("title"), type: DataFieldType.Date }])("a schema change cancels the previous text field's pending live save: %p", async field => {
    const m = mount("title", "a"); m.input.focus(); await type(m.input, "old draft");
    m.component.$set({ field, value: null }); await tick(); jest.advanceTimersByTime(1000);
    expect(m.onChange).not.toHaveBeenCalled(); m.component.$destroy();
  });
  it("saves 500 ms after typing stops, and the blur after it writes nothing more", async () => {
    const m = mount("title", "a");
    expect(m.input).toHaveAttribute("role", "combobox");
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
