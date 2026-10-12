/**
 * stab-input (3.7.0 P0-1) — a dashboard table cell keeps what the user types.
 *
 * Reproduced on the stand with real keys: typing into a text cell fired
 * `input` with "СарафанZ", and 24 ms later the same element showed "Сарафан"
 * again; a number cell reset the same way, and Enter then wrote nothing. The
 * editor was bound to `draft` while `$: if (editing) { draft = value … }`
 * seeded it, and in Svelte 3 a binding to a variable assigned inside a `$:`
 * statement re-runs that statement on the next flush (R0.34).
 *
 * What the earlier jsdom tests missed is the flush. Every case here awaits
 * `tick()` between the keystroke and the commit, which is the host's timing:
 * a Svelte flush lands between typing and Enter/blur. Without it the old
 * component passed.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";

import { DataFieldType, type DataField, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
import EditableCell from "../EditableCell.svelte";

function makeField(type: DataFieldType, typeConfig: Record<string, unknown> = {}): DataField {
  return { name: "f", type, repeated: false, identifier: false, derived: false, typeConfig } as unknown as DataField;
}

function mount(field: DataField, value: Optional<DataValue>, opts: { editing?: boolean; options?: string[] } = {}) {
  const result = render(EditableCell, {
    props: {
      field,
      value,
      readonly: false,
      editing: opts.editing ?? true,
      options: opts.options ?? [],
      api: {} as never,
      frame: { fields: [field], records: [] },
    },
  });
  const commits: unknown[] = [];
  let cancels = 0;
  result.component.$on("commit", (e: CustomEvent<unknown>) => commits.push(e.detail));
  result.component.$on("cancel", () => {
    cancels += 1;
  });
  return { ...result, commits, cancels: () => cancels };
}

const editor = (container: HTMLElement): HTMLInputElement => {
  const el = container.querySelector<HTMLInputElement>("input.ppp-t2-editor, input.ppp-t2-choice-input");
  if (!el) throw new Error("no editor input rendered");
  return el;
};

/** One keystroke's worth of input, then the flush the host runs before anything else happens. */
async function typeInto(el: HTMLInputElement, text: string): Promise<void> {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}

const key = (el: HTMLElement, k: string): void => {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
};

describe("text cell", () => {
  it("keeps the typed text across a flush and commits it on Enter", async () => {
    const { container, commits } = mount(makeField(DataFieldType.String), "Сарафан");
    await tick();
    const el = editor(container);
    expect(el.value).toBe("Сарафан");

    await typeInto(el, "СарафанZ");
    await tick();
    expect(el.value).toBe("СарафанZ");

    key(el, "Enter");
    expect(commits).toEqual(["СарафанZ"]);
  });

  it("commits the typed text on blur", async () => {
    const { container, commits } = mount(makeField(DataFieldType.String), "a");
    await tick();
    const el = editor(container);
    await typeInto(el, "ab");
    await typeInto(el, "abc");
    el.dispatchEvent(new FocusEvent("blur"));
    expect(commits).toEqual(["abc"]);
  });

  it("Escape cancels: nothing is committed, not even by the blur that follows", async () => {
    const { container, commits, cancels } = mount(makeField(DataFieldType.String), "a");
    await tick();
    const el = editor(container);
    await typeInto(el, "changed");
    key(el, "Escape");
    el.dispatchEvent(new FocusEvent("blur"));
    expect(cancels()).toBe(1);
    expect(commits).toEqual([]);
  });

  it("a value that changes while editing does not overwrite the draft", async () => {
    const { container, component } = mount(makeField(DataFieldType.String), "a");
    await tick();
    const el = editor(container);
    await typeInto(el, "mine");
    await component.$set({ value: "from elsewhere" });
    await tick();
    expect(el.value).toBe("mine");
  });

  it("is seeded on the turn into editing, each time", async () => {
    const { container, component } = mount(makeField(DataFieldType.String), "first", { editing: false });
    expect(container.querySelector("input.ppp-t2-editor")).toBeNull();
    // Each change in its own flush, as the table makes them.
    await component.$set({ editing: true });
    await tick();
    expect(editor(container).value).toBe("first");
    await component.$set({ editing: false });
    await tick();
    await component.$set({ value: "second" });
    await tick();
    await component.$set({ editing: true });
    await tick();
    expect(editor(container).value).toBe("second");
  });
});

describe("number cell", () => {
  it("keeps the typed number across a flush and commits it as a number", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Number), 12);
    await tick();
    const el = editor(container);
    expect(el.value).toBe("12");

    await typeInto(el, "42.5");
    await tick();
    expect(el.value).toBe("42.5");

    key(el, "Enter");
    expect(commits).toEqual([42.5]);
  });

  it("an emptied number commits null, through the one numeric rule", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Number), 12);
    await tick();
    const el = editor(container);
    await typeInto(el, "");
    key(el, "Enter");
    expect(commits).toEqual([null]);
  });
});

describe("select cell (CellChoiceDropdown)", () => {
  const options = ["Todo", "Doing", "Done"];

  it("keeps the typed choice across a flush and commits it on Enter", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Select), "Todo", { options });
    await tick();
    const el = editor(container);
    expect(el.value).toBe("Todo");

    await typeInto(el, "Done");
    await tick();
    expect(el.value).toBe("Done");

    key(el, "Enter");
    expect(commits).toEqual(["Done"]);
  });

  it("filters by the typed text and commits the picked option", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Select), "Todo", { options });
    await tick();
    const el = editor(container);
    await typeInto(el, "Doi");
    await tick();
    expect(el.value).toBe("Doi");
    // stab-forms: the options are the shared listbox, portalled to the body.
    const items = Array.from(document.querySelectorAll<HTMLButtonElement>(".ppp-t2-choice-item"));
    expect(items.map((b) => b.textContent)).toEqual(["Doing"]);

    items[0]?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(commits).toEqual(["Doing"]);
  });

  it("Escape cancels", async () => {
    const { container, commits, cancels } = mount(makeField(DataFieldType.Status), "Todo", { options });
    await tick();
    const el = editor(container);
    await typeInto(el, "x");
    key(el, "Escape");
    expect(cancels()).toBe(1);
    expect(commits).toEqual([]);
  });
});

describe("date cell", () => {
  it("is seeded with the stored day, not String(date) the control rejects", async () => {
    const { container } = mount(makeField(DataFieldType.Date), new Date(2024, 0, 15));
    await tick();
    expect(editor(container).value).toBe("2024-01-15");
  });

  it("keeps the picked day across a flush and writes a date-only value as date-only", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Date), new Date(2024, 0, 15));
    await tick();
    const el = editor(container);
    await typeInto(el, "2024-03-05");
    await tick();
    expect(el.value).toBe("2024-03-05");
    key(el, "Enter");
    expect(commits).toEqual(["2024-03-05"]);
  });

  it("keeps the stored time and separator", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Date), "2024-01-15 10:30");
    await tick();
    const el = editor(container);
    expect(el.value).toBe("2024-01-15");
    await typeInto(el, "2024-03-05");
    el.dispatchEvent(new FocusEvent("blur"));
    expect(commits).toEqual(["2024-03-05 10:30"]);
  });

  it("keeps a Date's own time", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Date), new Date(2024, 0, 15, 9, 45));
    await tick();
    const el = editor(container);
    await typeInto(el, "2024-03-05");
    key(el, "Enter");
    expect(commits).toEqual(["2024-03-05T09:45"]);
  });

  it("writes another recognised spelling back in that spelling", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Date), "15.01.2024");
    await tick();
    const el = editor(container);
    expect(el.value).toBe("2024-01-15");
    await typeInto(el, "2024-03-05");
    key(el, "Enter");
    expect(commits).toEqual(["05.03.2024"]);
  });

  it("a field configured with a time keeps one at midnight", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Date, { time: true }), new Date(2024, 0, 15));
    await tick();
    const el = editor(container);
    await typeInto(el, "2024-03-05");
    key(el, "Enter");
    expect(commits).toEqual(["2024-03-05T00:00"]);
  });

  it("clearing the control clears the value", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Date), "2024-01-15");
    await tick();
    const el = editor(container);
    await typeInto(el, "");
    key(el, "Enter");
    expect(commits).toEqual([null]);
  });

  it("a blur that changed nothing hands back the stored value itself", async () => {
    // The table skips the write when the committed value is the stored one.
    const stored = new Date(2024, 0, 15);
    const { container, commits } = mount(makeField(DataFieldType.Date), stored);
    await tick();
    editor(container).dispatchEvent(new FocusEvent("blur"));
    expect(commits).toHaveLength(1);
    expect(commits[0]).toBe(stored);
  });
});

describe("boolean cell", () => {
  it("still toggles instantly, without an editor", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Boolean), false, { editing: false });
    await tick();
    container.querySelector<HTMLElement>(".ppp-t2-cell")?.click();
    expect(commits).toEqual([true]);
    expect(container.querySelector("input.ppp-t2-editor")).toBeNull();
  });
});

describe("safe typed input (feedback 01)", () => {
  it.each([DataFieldType.Number, DataFieldType.Boolean, DataFieldType.Date])("never edits an array as a scalar %s", async type => {
    const { container, commits } = mount(makeField(type), [1, 2], { editing: false });
    const cell = container.querySelector<HTMLElement>(".ppp-t2-cell");
    expect(cell).not.toHaveClass("ppp-t2-cell--editable");
    cell?.click();
    await tick();
    expect(commits).toEqual([]);
    expect(container.querySelector("input.ppp-t2-editor")).toBeNull();
  });
  it("does not mistake a partially typed native date for an intentional clear", async () => {
    const { container, commits } = mount(makeField(DataFieldType.Date), "2024-01-15");
    await tick();
    const el = editor(container);
    // Chromium/Safari may expose an empty value while the date subfields are
    // incomplete, but mark badInput. That is not the explicit clear action.
    await typeInto(el, "");
    Object.defineProperty(el.validity, "badInput", { configurable: true, get: () => true });
    key(el, "Enter");
    el.dispatchEvent(new FocusEvent("blur"));
    expect(commits).toEqual([]);
    await tick();
    expect(el).toHaveAttribute("aria-invalid", "true");
    Object.defineProperty(el.validity, "badInput", { configurable: true, get: () => false });
    await typeInto(el, "2024-03-05");
    key(el, "Enter");
    expect(commits).toEqual(["2024-03-05"]);
  });

  it.each(["12abc", "1,5", "Infinity"])("does not erase the stored number when %s is entered", async (raw) => {
    const { container, commits } = mount(makeField(DataFieldType.Number), 12);
    await tick();
    const el = editor(container);
    await typeInto(el, raw);
    key(el, "Enter");
    await tick();
    expect(commits).toEqual([]);
    expect(el).toHaveAttribute("aria-invalid", "true");
    el.dispatchEvent(new FocusEvent("blur"));
    expect(commits).toEqual([]);
    await typeInto(el, "24.5");
    key(el, "Enter");
    expect(commits).toEqual([24.5]);
  });

  it.each(["Enter", "Escape"])("does not commit/cancel on IME %s before composition ends", async (k) => {
    const { container, commits, cancels } = mount(makeField(DataFieldType.String), "old");
    await tick();
    const el = editor(container);
    el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    await typeInto(el, "候補");
    key(el, k);
    expect(commits).toEqual([]);
    expect(cancels()).toBe(0);
    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    await typeInto(el, "確定");
    key(el, "Enter");
    expect(commits).toEqual(["確定"]);
  });

  it.each([{ isComposing: true }, { keyCode: 229 }])("ignores the host IME key flag %j", async (flags) => {
    const { container, commits } = mount(makeField(DataFieldType.String), "old");
    await tick();
    const el = editor(container);
    await typeInto(el, "candidate");
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...flags }));
    expect(commits).toEqual([]);
    key(el, "Enter");
    expect(commits).toEqual(["candidate"]);
  });
});
