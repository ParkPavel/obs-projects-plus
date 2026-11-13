import "@testing-library/jest-dom";
import { render, cleanup, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { optionRows, tap } from "src/ui/components/fields/__tests__/support/comboKit";
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store"); return { i18n: writable({ t: (key: string) => key }) };
});
jest.mock("dayjs", () => ({ __esModule: true, default: jest.requireActual("dayjs") }));
jest.mock("obsidian-svelte", () => ({ ...jest.requireActual("obsidian-svelte"), Tag: require("./TagSlot.mock.svelte").default }));
// Preserve the actual component through the TS re-export in this Jest transform.
jest.mock("src/ui/components/TagList", () => ({ TagList: jest.requireActual("../TagList.svelte").default }));
const TagList = require("../TagList.svelte").default;
const FieldControl = require("src/ui/components/FieldControl/FieldControl.svelte").default;
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);
async function open(target: HTMLElement) {
  await fireEvent.click(target.querySelector('[aria-label="common.add-item"]')!); await flush();
  return target.querySelector<HTMLInputElement>(".tag-list-add input")!;
}

test("a late suggestion revision keeps the original list input, draft, selection and focus", async () => {
  const onChange = jest.fn(), view = render(TagList, { props: { values: ["a"], edit: true, suggestions: [], onChange } });
  const input = await open(view.container); await fireEvent.input(input, { target: { value: "draft" } }); input.setSelectionRange(2, 4);
  view.component.$set({ suggestions: ["drafted"] }); await flush();
  expect(view.container.querySelector(".tag-list-add input")).toBe(input);
  expect(input.value).toBe("draft"); expect([input.selectionStart, input.selectionEnd]).toEqual([2, 4]);
  expect(document.activeElement).toBe(input); expect(onChange).not.toHaveBeenCalled();
});

test.each(["pointer", "arrows", "exact typed match"])("%s preserves an existing raw list value's spaces and wikilink", async mode => {
  const raw = " [[People/A|A]] ", onChange = jest.fn();
  const view = render(TagList, { props: { values: ["a"], edit: true, suggestions: [raw], onChange } });
  const input = await open(view.container);
  if (mode === "pointer") tap(optionRows()[0]!);
  else {
    if (mode === "arrows") input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    else { input.value = raw; input.dispatchEvent(new Event("input", { bubbles: true })); await flush(); }
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }
  await flush();
  expect(onChange).toHaveBeenCalledTimes(1); expect(onChange).toHaveBeenCalledWith(["a", raw]);
});

test("deleting a displayed string preserves the other typed members of a mixed list", async () => {
  const onChange = jest.fn(), view = render(TagList, { props: { values: [10, "a", false], edit: true, onChange } });
  await fireEvent.click(view.container.querySelector('[aria-label="common.remove: a"]')!);
  expect(onChange).toHaveBeenCalledWith([10, false]);
});

test("retiring a focused suggestion input never commits its unfinished item", async () => {
  const onChange = jest.fn(), view = render(TagList, { props: { values: ["a"], edit: true, suggestions: ["b"], onChange } });
  const input = await open(view.container); await fireEvent.input(input, { target: { value: "pending" } });
  view.unmount(); expect(onChange).not.toHaveBeenCalled();
});

test("changing the field owner retires an unfinished list interaction without writing", async () => {
  const onChange = jest.fn(), base = { name: "one", type: "multitext", repeated: true, derived: false, identifier: false };
  const view = render(FieldControl, { props: { field: base, value: ["a"], suggestions: ["b"], onChange } });
  const input = await open(view.container); await fireEvent.input(input, { target: { value: "pending" } });
  view.component.$set({ field: { ...base, name: "two" }, value: ["x"] }); await flush();
  expect(view.container.querySelector(".tag-list-add input")).toBeNull(); expect(onChange).not.toHaveBeenCalled();
});

test.each([
  ["number", "3", 3],
  ["boolean", "false", false],
  ["date", "05.11.2026", new Date(2026, 10, 5)],
])("a repeated %s field appends a typed value without changing existing members", async (type, draft, expected) => {
  const onChange = jest.fn(), values = [0, false, null, "0"];
  const field = { name: "values", type, repeated: true, derived: false, identifier: false };
  const view = render(FieldControl, { props: { field, value: values, onChange } });
  const input = await open(view.container);
  expect(input).not.toBeNull();
  await fireEvent.input(input, { target: { value: draft } });
  await fireEvent.keyDown(input, { key: "Enter" }); await flush();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith([...values, expected]);
});

test("every primitive member is removable by its original position, including false and null", async () => {
  const onChange = jest.fn(), values = [0, false, null, "0"];
  const view = render(TagList, { props: { values, edit: true, onChange } });
  const buttons = view.container.querySelectorAll('.edit [role="button"]');
  expect(buttons).toHaveLength(5); // four members and Add
  await fireEvent.click(buttons[2]!);
  expect(onChange).toHaveBeenCalledWith([0, false, "0"]);
});

test("two accepted additions before a parent render build on the accepted list", async () => {
  const onChange = jest.fn(), view = render(TagList, { props: { values: [0], type: "number", edit: true, onChange } });
  const input = await open(view.container);
  await fireEvent.input(input, { target: { value: "3" } }); await fireEvent.keyDown(input, { key: "Enter" }); await flush();
  await fireEvent.input(input, { target: { value: "4" } }); await fireEvent.keyDown(input, { key: "Enter" }); await flush();
  expect(onChange.mock.calls.map(call => call[0])).toEqual([[0, 3], [0, 3, 4]]);
  view.component.$set({ values: [0, 3] }); await flush();
  await fireEvent.input(input, { target: { value: "5" } }); await fireEvent.keyDown(input, { key: "Enter" }); await flush();
  expect(onChange).toHaveBeenLastCalledWith([0, 3, 4, 5]);
  view.component.$set({ values: [7] }); await flush();
  await fireEvent.input(input, { target: { value: "8" } }); await fireEvent.keyDown(input, { key: "Enter" }); await flush();
  expect(onChange).toHaveBeenLastCalledWith([7, 8]);
});

test.each(["number", "date"])("an invalid repeated %s draft survives blur without writing and Escape cancels it", async type => {
  const onChange = jest.fn(), field = { name: "values", type, repeated: true, derived: false, identifier: false };
  const view = render(FieldControl, { props: { field, value: [0], onChange } });
  const input = await open(view.container); await fireEvent.input(input, { target: { value: "wrong" } });
  input.blur(); await flush(); expect(input.isConnected).toBe(true); expect(input.value).toBe("wrong");
  expect(input).toHaveAttribute("aria-invalid", "true"); expect(onChange).not.toHaveBeenCalled();
  input.focus(); await fireEvent.keyDown(input, { key: "Escape" }); await flush();
  expect(view.container.querySelector(".tag-list-add")).toBeNull(); expect(onChange).not.toHaveBeenCalled();
});

test.each(["number", "date", "boolean"])("an unfinished repeated %s composition is retired without committing after readonly", async type => {
  const onChange = jest.fn(), field = { name: "values", type, repeated: true, derived: false, identifier: false };
  const view = render(FieldControl, { props: { field, value: [], onChange } });
  const input = await open(view.container); await fireEvent.compositionStart(input); await fireEvent.input(input, { target: { value: "3" } });
  await fireEvent.keyDown(input, { key: "Enter", isComposing: true }); input.blur(); await flush();
  expect(input.isConnected).toBe(true); expect(onChange).not.toHaveBeenCalled();
  view.component.$set({ readonly: true }); await flush(); await fireEvent.compositionEnd(input);
  expect(input.isConnected).toBe(false); expect(onChange).not.toHaveBeenCalled();
});

test("a repeated date selects valid project dates on its original typed input", async () => {
  const onChange = jest.fn(), field = { name: "days", type: "date", repeated: true, derived: false, identifier: false };
  const view = render(FieldControl, { props: { field, value: [], suggestions: ["2026-11-05", "wrong"], onChange } });
  const input = await open(view.container); expect(input).toHaveAttribute("role", "combobox");
  const rows = optionRows(); expect(rows).toHaveLength(1); expect(rows[0]!.textContent).toBe("05.11.2026");
  tap(rows[0]!); await flush(); expect(onChange).toHaveBeenCalledWith([new Date(2026, 10, 5)]);
  expect(view.container.querySelector(".tag-list-add input")).toBe(input);
});
