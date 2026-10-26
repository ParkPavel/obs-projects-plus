/**
 * w4-input2: a list value's «+» opened a window with a separate name line
 * («Add list item», untranslated). The item is now typed at the end of the
 * values themselves.
 */
import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (key: string) => key }) };
});
const TagList = require("../TagList.svelte").default;
const settle = async () => { await tick(); await tick(); await Promise.resolve(); await tick(); };

function mount(values: string[]) {
  const onChange = jest.fn();
  const view = render(TagList, { props: { values, edit: true, onChange } });
  return { view, onChange };
}

async function open(view: { container: HTMLElement }) {
  await fireEvent.click(view.container.querySelector('[aria-label="common.add-item"]')!);
  await settle();
  return view.container.querySelector<HTMLInputElement>(".tag-list-add input")!;
}

afterEach(() => { document.body.innerHTML = ""; });

test("«+» opens a field among the values, focused; no window", async () => {
  const { view } = mount(["a"]);
  const input = await open(view);
  expect(input).not.toBeNull();
  expect(document.activeElement).toBe(input);
  expect(document.querySelector(".modal")).toBeNull();
  const src = require("fs").readFileSync(require("path").join(__dirname, "../TagList.svelte"), "utf8");
  expect(src).not.toMatch(/InputDialogModal/);
});

test("Enter adds the item and leaves the field empty for the next one", async () => {
  const { view, onChange } = mount(["a"]);
  const input = await open(view);
  await fireEvent.input(input, { target: { value: " b " } });
  await fireEvent.keyDown(input, { key: "Enter" }); await settle();
  expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
  expect(input.value).toBe("");
  expect(view.container.querySelector(".tag-list-add")).not.toBeNull();
});

test("leaving the field adds what is typed and closes it; an empty one just closes", async () => {
  const { view, onChange } = mount([]);
  let input = await open(view);
  await fireEvent.input(input, { target: { value: "c" } });
  input.blur(); await settle();
  expect(onChange).toHaveBeenCalledWith(["c"]);
  expect(view.container.querySelector(".tag-list-add")).toBeNull();

  onChange.mockClear();
  input = await open(view);
  input.blur(); await settle();
  expect(onChange).not.toHaveBeenCalled();
  expect(view.container.querySelector(".tag-list-add")).toBeNull();
});

test("Escape closes the field without adding", async () => {
  const { view, onChange } = mount([]);
  const input = await open(view);
  await fireEvent.input(input, { target: { value: "d" } });
  await fireEvent.keyDown(input, { key: "Escape" }); await settle();
  expect(onChange).not.toHaveBeenCalled();
  expect(view.container.querySelector(".tag-list-add")).toBeNull();
});
