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
  await fireEvent.click(view.container.querySelector('.edit [role="button"]')!);
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
