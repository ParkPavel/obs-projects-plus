import { tick } from "svelte";
// The Jest Svelte transformer wraps barrel re-exports; retain the actual components.
jest.mock("src/ui/components/TagsInput/Tag", () => ({ Tag: require("./Tag/Tag.svelte").default }));
jest.mock("src/ui/components/TagsInput/TagInput", () => ({ TagInput: require("./TagInput/TagInput.svelte").default }));
jest.mock("obsidian-svelte", () => ({
  ...jest.requireActual("src/__mocks__/obsidian-svelte.js"),
  useClickOutside: () => ({ destroy() {} }),
}));
const TagsInput = require("./TagsInput.svelte").default;
const mounted: Array<() => void> = [];
function mount() {
  const target = document.createElement("div"); document.body.appendChild(target);
  const component = new TagsInput({ target, props: { value: ["before"] } });
  const changes: string[] = [];
  component.$on("change", (e: CustomEvent<string>) => changes.push(e.detail));
  mounted.push(() => { component.$destroy(); target.remove(); });
  return { target, changes };
}
async function type(input: HTMLInputElement, value: string) {
  input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
}
const key = (el: HTMLElement, name: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
afterEach(() => mounted.splice(0).forEach(destroy => destroy()));

test("adding preserves a comma as one canonical list item and keeps the original input", async () => {
  const m = mount(), input = m.target.querySelector("input")!;
  input.focus(); await type(input, 'one,two "quoted"'); key(input, "Enter"); await tick();
  input.blur(); await tick();
  expect(m.changes.map(value => JSON.parse(value))).toEqual([["before", 'one,two "quoted"']]);
  expect(m.target.querySelector("input")).toBe(input);
});

test("editing and deleting a tag use the component focus API without duplicate writes", async () => {
  const m = mount(), tag = m.target.querySelector<HTMLElement>(".tag")!;
  tag.click(); await tick(); key(tag, "Enter"); await tick();
  const edit = m.target.querySelector("input")!;
  expect(document.activeElement).toBe(edit);
  expect(edit.selectionStart).toBe(0); expect(edit.selectionEnd).toBe("before".length);
  await type(edit, "after"); key(edit, "Enter"); await tick();
  expect(m.changes.map(value => JSON.parse(value))).toEqual([["after"]]);
  const updated = m.target.querySelector<HTMLElement>(".tag")!;
  updated.click(); await tick(); key(updated, "Delete"); await tick();
  expect(m.changes.map(value => JSON.parse(value))).toEqual([["after"], []]);
  expect(document.activeElement).toBe(m.target.querySelector("input"));
});
