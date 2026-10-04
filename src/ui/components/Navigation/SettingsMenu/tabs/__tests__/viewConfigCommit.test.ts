import "@testing-library/jest-dom";
import { tick } from "svelte";

/**
 * settings-binds — every view setting keeps what the user typed or picked
 * across a Svelte flush until it commits, then emits the same partial update
 * as before.
 *
 * Reproduced in the real host (2026-10-04): typing "cov" into the board cover
 * picker logged `input=cov`, and the very next keydown already saw "". The
 * controls were bound two-way to reactive declarations derived from the view
 * (`$: coverField = view.config.coverField ?? ""`); in Svelte 3 the binding
 * re-runs such a declaration on the next flush, which writes the saved value
 * back. A real browser flushes between a keystroke and the Enter, blur or
 * datalist pick that commits; the older tests dispatched `input` and `change`
 * back to back, so they never let it. Every test here puts `await tick()` —
 * the flush that used to reset the field — between the edit and the commit.
 */

type Mounted = {
  $destroy(): void;
  $set(props: Record<string, unknown>): void;
  $on(event: string, handler: (e: CustomEvent<Record<string, unknown>>) => void): () => void;
};
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const ViewConfigTab = require("../ViewConfigTab.svelte").default as ComponentClass;

const FIELDS = [
  { name: "status", type: "string" },
  { name: "cover", type: "string" },
  { name: "rank", type: "number" },
  { name: "due", type: "date" },
];

function viewOf(type: string, config: Record<string, unknown> = {}) {
  return {
    name: type,
    id: `view-${type}`,
    type,
    config,
    filter: { conjunction: "and", conditions: [] },
    colors: { conditions: [] },
    sort: { criteria: [] },
  };
}

function mount(type: string, config: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new ViewConfigTab({ target, props: { view: viewOf(type, config), fields: FIELDS } });
  const updates: Record<string, unknown>[] = [];
  component.$on("update", (e) => updates.push(e.detail));
  const q = <T extends Element>(selector: string) => target.querySelector<T>(selector) as T;
  return {
    target,
    component,
    updates,
    q,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

/** One keystroke's worth of editing, then the flush a real browser runs before the next key. */
async function edit(input: HTMLInputElement, value: string, inputType = "insertText"): Promise<void> {
  if (document.activeElement !== input) input.focus();
  input.value = value;
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType }));
  await tick();
}

const change = (el: HTMLElement) => el.dispatchEvent(new Event("change", { bubbles: true }));
const enter = (el: HTMLElement) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("settings-binds — a field picker (board cover field)", () => {
  const cover = (m: ReturnType<typeof mount>) => m.q<HTMLInputElement>("#fieldlist-cover-board-input");

  it("typed text survives each flush; blur's change commits it once", async () => {
    const m = mount("board");
    await edit(cover(m), "c");
    await edit(cover(m), "co");
    await edit(cover(m), "cov");
    expect(cover(m).value).toBe("cov");
    expect(m.updates).toEqual([]);
    await edit(cover(m), "cover");
    expect(cover(m).value).toBe("cover");
    change(cover(m));
    cover(m).blur();
    await tick();
    expect(m.updates).toEqual([{ coverField: "cover" }]);
    expect(cover(m).value).toBe("cover");
    m.destroy();
  });

  it("Enter commits a typed name after a flush", async () => {
    const m = mount("board");
    await edit(cover(m), "brand-new");
    enter(cover(m));
    await tick();
    expect(m.updates).toEqual([{ coverField: "brand-new" }]);
    expect(cover(m).value).toBe("brand-new");
    m.destroy();
  });

  it("a datalist pick commits at once and is still shown after the flush", async () => {
    const m = mount("board");
    await edit(cover(m), "cover", "insertReplacementText");
    expect(m.updates).toEqual([{ coverField: "cover" }]);
    expect(cover(m).value).toBe("cover");
    // The blur's change after the pick writes nothing more.
    change(cover(m));
    expect(m.updates).toEqual([{ coverField: "cover" }]);
    m.destroy();
  });

  it("clearing the field emits undefined, as before", async () => {
    const m = mount("board", { coverField: "cover" });
    await edit(cover(m), "");
    expect(cover(m).value).toBe("");
    change(cover(m));
    expect(m.updates).toEqual([{ coverField: undefined }]);
    m.destroy();
  });

  it("the saved value, once the parent passes it down, and a later reset both reach the field", async () => {
    const m = mount("board");
    await edit(cover(m), "cover", "insertReplacementText");
    cover(m).blur();
    m.component.$set({ view: viewOf("board", { coverField: "cover" }) });
    await tick();
    expect(cover(m).value).toBe("cover");
    m.component.$set({ view: viewOf("board", {}) });
    await tick();
    expect(cover(m).value).toBe("");
    m.destroy();
  });
});

describe("settings-binds — a number field (board column width)", () => {
  const width = (m: ReturnType<typeof mount>) => m.q<HTMLInputElement>('input[data-board-option="column-width"]');

  it("a typed width survives the flush and commits on change as a number", async () => {
    const m = mount("board");
    expect(width(m).value).toBe("270");
    await edit(width(m), "3");
    await edit(width(m), "32");
    await edit(width(m), "320");
    expect(width(m).value).toBe("320");
    expect(m.updates).toEqual([]);
    change(width(m));
    await tick();
    expect(m.updates).toEqual([{ columnWidth: 320 }]);
    expect(width(m).value).toBe("320");
    m.destroy();
  });

  it("an emptied width resets to the default; a non-positive one writes nothing", async () => {
    const m = mount("board", { columnWidth: 300 });
    await edit(width(m), "");
    change(width(m));
    expect(m.updates).toEqual([{ columnWidth: undefined }]);
    await edit(width(m), "0");
    change(width(m));
    await edit(width(m), "-5");
    change(width(m));
    expect(m.updates).toEqual([{ columnWidth: undefined }]);
    m.destroy();
  });
});

describe("settings-binds — a text field (calendar timezone)", () => {
  const timezone = (m: ReturnType<typeof mount>) => m.q<HTMLInputElement>('input[data-calendar-option="timezone"]');

  it("typed text survives the flush and commits on change", async () => {
    const m = mount("calendar");
    expect(timezone(m).value).toBe("local");
    await edit(timezone(m), "Europe/Ber");
    expect(timezone(m).value).toBe("Europe/Ber");
    await edit(timezone(m), "Europe/Berlin");
    change(timezone(m));
    await tick();
    expect(m.updates).toEqual([{ timezone: "Europe/Berlin" }]);
    expect(timezone(m).value).toBe("Europe/Berlin");
    m.destroy();
  });
});

describe("settings-binds — a select (calendar interval) and the hour selects", () => {
  const interval = (m: ReturnType<typeof mount>) => m.q<HTMLSelectElement>('select[data-calendar-option="interval"]');

  it("the chosen option stays chosen across flushes and commits its value", async () => {
    const m = mount("calendar");
    expect(interval(m).value).toBe("month");
    interval(m).value = "year";
    interval(m).dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    expect(interval(m).value).toBe("year");
    change(interval(m));
    await tick();
    expect(m.updates).toEqual([{ interval: "year" }]);
    expect(interval(m).value).toBe("year");
    m.destroy();
  });

  it("the hour selects still write numbers", async () => {
    const m = mount("calendar", { interval: "week" });
    const timeline = m.q<HTMLButtonElement>(".settings-section-header");
    timeline.click();
    await tick();
    const [start, end] = Array.from(m.target.querySelectorAll<HTMLSelectElement>(".settings-section-body select"));
    expect(start?.value).toBe("0");
    expect(end?.value).toBe("24");
    (start as HTMLSelectElement).value = "8";
    change(start as HTMLSelectElement);
    (end as HTMLSelectElement).value = "18";
    change(end as HTMLSelectElement);
    await tick();
    expect(m.updates).toEqual([{ startHour: 8 }, { endHour: 18 }]);
    expect(start?.value).toBe("8");
    expect(end?.value).toBe("18");
    m.destroy();
  });
});

describe("settings-binds — a checkbox (board freeze columns) and the table toggles", () => {
  const freeze = (m: ReturnType<typeof mount>) => m.q<HTMLInputElement>('input[data-board-option="freeze-columns"]');

  it("the new state stays across flushes and commits both keys", async () => {
    const m = mount("board");
    expect(freeze(m).checked).toBe(false);
    freeze(m).checked = true;
    freeze(m).dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    expect(freeze(m).checked).toBe(true);
    change(freeze(m));
    await tick();
    expect(m.updates).toEqual([{ freezeAll: true, freezeColumns: true }]);
    expect(freeze(m).checked).toBe(true);
    m.destroy();
  });

  it("a legacy table writes the key itself; a database view nests it under `table`", async () => {
    const legacy = mount("table");
    const legacyBoxes = legacy.target.querySelectorAll<HTMLInputElement>("label.checkbox input");
    (legacyBoxes[0] as HTMLInputElement).click();
    await tick();
    expect(legacy.updates).toEqual([{ wrapText: true }]);
    expect((legacyBoxes[0] as HTMLInputElement).checked).toBe(true);
    legacy.destroy();

    const database = mount("database", { table: { rowHeight: "compact" } });
    const boxes = database.target.querySelectorAll<HTMLInputElement>("label.checkbox input");
    (boxes[1] as HTMLInputElement).click();
    await tick();
    expect(database.updates).toEqual([{ table: { rowHeight: "compact", showAggregationRow: true } }]);
    database.destroy();
  });

  it("the table row height select commits through the table update", async () => {
    const m = mount("database", {});
    const select = m.q<HTMLSelectElement>("select");
    expect(select.value).toBe("default");
    select.value = "expanded";
    change(select);
    await tick();
    expect(m.updates).toEqual([{ table: { rowHeight: "expanded" } }]);
    expect(select.value).toBe("expanded");
    m.destroy();
  });
});

describe("settings-binds — the calendar field mapping keeps its value shapes", () => {
  it("a mapping field emits the text itself (an empty one too), the icon field clears to undefined", async () => {
    const m = mount("calendar", { dateField: "due", iconField: "status" });
    const date = m.q<HTMLInputElement>("#fieldlist-date-input");
    const icon = m.q<HTMLInputElement>("#fieldlist-icon-calendar-input");
    expect(date.value).toBe("due");
    await edit(date, "");
    change(date);
    date.blur();
    await edit(icon, "");
    change(icon);
    expect(m.updates).toEqual([{ dateField: "" }, { iconField: undefined }]);
    m.destroy();
  });
});
