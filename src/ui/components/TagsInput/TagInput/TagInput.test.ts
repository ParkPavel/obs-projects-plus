import { tick } from "svelte";
const TagInput = require("./TagInput.svelte").default;
const mounted: Array<() => void> = [];
function mount(value = "") {
  const target = document.createElement("div"); document.body.appendChild(target);
  const component = new TagInput({ target, props: { value } });
  const submitted: string[] = [], inputs: string[] = [];
  const escape = jest.fn(), previous = jest.fn();
  component.$on("submit", (e: CustomEvent<string>) => submitted.push(e.detail));
  component.$on("input", (e: CustomEvent<string>) => inputs.push(e.detail));
  component.$on("escape", escape); component.$on("navigatePrev", previous);
  const input = target.querySelector("input, [contenteditable]") as HTMLElement;
  mounted.push(() => { component.$destroy(); target.remove(); });
  return { target, component, input, submitted, inputs, escape, previous };
}
async function type(input: HTMLElement, value: string) {
  if (input.tagName === "INPUT") (input as HTMLInputElement).value = value; else input.textContent = value;
  input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
}
const key = (input: HTMLElement, name: string, extra: KeyboardEventInit = {}) => input.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...extra }));
afterEach(() => { mounted.splice(0).forEach(destroy => destroy()); });

test("an IME candidate Enter does not create a tag", async () => {
  const m = mount(); m.input.focus();
  m.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await type(m.input, "тест"); key(m.input, "Enter", { isComposing: true });
  expect(m.submitted).toEqual([]);
  m.input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  key(m.input, "Enter", { keyCode: 229 }); expect(m.submitted).toEqual([]);
  key(m.input, "Enter"); m.input.blur(); await tick(); expect(m.submitted).toEqual(["тест"]);
});

test("empty composing Backspace never navigates to the previous tag", () => {
  const m = mount(); m.input.focus();
  m.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  key(m.input, "Backspace", { isComposing: true }); expect(m.previous).not.toHaveBeenCalled();
});

test("Enter then blur never submits a second empty edit of an existing tag", async () => {
  const m = mount("before"); m.input.focus(); await type(m.input, "after");
  key(m.input, "Enter"); await tick(); m.input.blur(); await tick();
  expect(m.submitted).toEqual(["after"]);
});

test("an idle parent refresh is not reported as user input", async () => {
  const m = mount("before"); m.component.$set({ value: "external" }); await tick();
  expect(m.inputs).toEqual([]); expect(m.submitted).toEqual([]);
});

test("Escape cancels an edit and a later blur cannot persist it", async () => {
  const m = mount("before"); m.input.focus(); await type(m.input, "after");
  key(m.input, "Escape"); await tick(); m.input.blur(); await tick();
  expect(m.submitted).toEqual([]); expect(m.escape).toHaveBeenCalled();
});

test("empty navigation and unchanged blur retain their tag editor semantics", async () => {
  const empty = mount(); empty.input.focus(); key(empty.input, "ArrowLeft");
  expect(empty.previous).toHaveBeenCalledTimes(1); key(empty.input, "Enter");
  empty.input.blur(); await tick(); expect(empty.submitted).toEqual([]);
  const existing = mount("same"); existing.input.focus(); existing.input.blur(); await tick();
  expect(existing.submitted).toEqual([]); expect(existing.escape).toHaveBeenCalledTimes(1);
});
