/**
 * stab-input (3.7.0 P0-1) — after Enter, Escape or blur a table cell leaves
 * editing and stays out of it until the user starts a new edit.
 *
 * Seen live: Enter in a text cell wrote the value, the editor was removed, and
 * ~70 ms later a NEW editor opened on the same cell with no click and no second
 * keydown. In the browser a microtask checkpoint runs after every event listener
 * returns, so the Svelte flush that the commit scheduled (`editing` becomes false)
 * lands BETWEEN the editor's keydown listener and the bubble to the cell
 * `div`'s own Enter handler. That handler saw `!editing`, took the Enter as
 * "start editing" and dispatched `startEdit` again.
 *
 * jsdom's `dispatchEvent` from a test has no checkpoint between listeners, so
 * `flushLikeBrowser` calls Svelte's `flush` from a listener added after the
 * component's own: the same moment the host runs it. The parent (what
 * DataTableContent does with the three row events) is stood in for by the
 * harness below, with an api whose `updateRecord` updates the frame
 * synchronously, as the real store does.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { flush } from "svelte/internal";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? "" }) };
});

const { DataFieldType } = require("src/lib/dataframe/dataframe");
const TableRow = require("../TableRow.svelte").default;

type Rec = { id: string; values: Record<string, unknown> };

const textField = { name: "title", type: DataFieldType.String, repeated: false, identifier: false, derived: false, typeConfig: {} };
const columns = [{ field: textField, widthRem: 10, isPrimary: false }];

function mount() {
  let record: Rec = { id: "a.md", values: { title: "old" } };
  const frameOf = (r: Rec) => ({ fields: [textField], records: [r] });
  const { container, component } = render(TableRow, {
    props: { columns, record, readonly: false, api: {}, frame: frameOf(record), editingField: null, optionsByField: new Map() },
  });
  const writes: unknown[] = [];
  const api = {
    // The real store updates synchronously: the new record reaches the row inside this call.
    updateRecord: (next: Rec) => {
      writes.push(next.values["title"]);
      record = next;
      component.$set({ record, frame: frameOf(record) });
    },
  };
  component.$set({ api });
  // The parent's three handlers, in DataTableContent's order: leave editing, then write.
  component.$on("startEdit", (e: CustomEvent<{ recordId: string; field: string }>) => component.$set({ editingField: e.detail.field }));
  component.$on("cancelEdit", () => component.$set({ editingField: null }));
  component.$on("commitEdit", (e: CustomEvent<{ record: Rec; field: string; value: unknown }>) => {
    const { record: rec, field, value } = e.detail;
    component.$set({ editingField: null });
    if (rec.values[field] === value) return;
    api.updateRecord({ ...rec, values: { ...rec.values, [field]: value } });
  });
  return { container, writes, record: () => record };
}

const editors = (container: HTMLElement) => container.querySelectorAll("input.ppp-t2-editor");

/** Click the cell and let the editor mount and take focus. */
async function startEdit(container: HTMLElement): Promise<HTMLInputElement> {
  container.querySelector<HTMLElement>(".ppp-t2-cell")?.click();
  await tick();
  await tick();
  const el = container.querySelector<HTMLInputElement>("input.ppp-t2-editor");
  if (!el) throw new Error("click did not open an editor");
  // Added after the component's own listeners, so it runs between them and the bubble to the cell.
  const flushLikeBrowser = () => flush();
  for (const type of ["keydown", "blur"]) el.addEventListener(type, flushLikeBrowser);
  return el;
}

async function type(el: HTMLInputElement, text: string): Promise<void> {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}

const key = (el: HTMLElement, k: string): void => {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
};

/** The window the live bug needed: flushes and timers after the key, with no further input. */
async function settle(): Promise<void> {
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await tick();
}

describe("a table cell after it leaves editing", () => {
  it("Enter commits once and the cell does not reopen by itself", async () => {
    const { container, writes } = mount();
    const el = await startEdit(container);
    await type(el, "new");
    key(el, "Enter");
    await settle();
    expect(editors(container)).toHaveLength(0);
    expect(writes).toEqual(["new"]);
  });

  it("Escape cancels without a write and the cell does not reopen", async () => {
    const { container, writes } = mount();
    const el = await startEdit(container);
    await type(el, "new");
    key(el, "Escape");
    await settle();
    expect(editors(container)).toHaveLength(0);
    expect(writes).toEqual([]);
  });

  it("blur commits once and the cell does not reopen", async () => {
    const { container, writes } = mount();
    const el = await startEdit(container);
    await type(el, "new");
    el.dispatchEvent(new FocusEvent("blur"));
    await settle();
    expect(editors(container)).toHaveLength(0);
    expect(writes).toEqual(["new"]);
  });

  it("a new click after a commit still starts a new edit, seeded with the stored value", async () => {
    const { container, writes } = mount();
    const el = await startEdit(container);
    await type(el, "new");
    key(el, "Enter");
    await settle();
    const again = await startEdit(container);
    expect(again.value).toBe("new");
    key(again, "Escape");
    await settle();
    expect(editors(container)).toHaveLength(0);
    expect(writes).toEqual(["new"]);
  });
});
