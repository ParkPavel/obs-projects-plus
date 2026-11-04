import { tick } from "svelte";
jest.mock("obsidian-svelte", () => ({
  ...jest.requireActual("src/__mocks__/obsidian-svelte.js"),
  TextInput: require("./LegacyText.mock.svelte").default,
  Button: require("src/ui/modals/components/__tests__/mocks/Button.mock.svelte").default,
}));
jest.mock("svelte-dnd-action", () => ({
  TRIGGERS: { DRAG_STARTED: "dragStarted", DRAG_STOPPED: "dragStopped" },
  SHADOW_ITEM_MARKER_PROPERTY_NAME: "isDndShadowItem",
  SHADOW_PLACEHOLDER_ITEM_ID: "id:dnd-shadow-placeholder-0000",
  dndzone: (node: HTMLElement, options: unknown) => {
    (node as any).zoneOptions = options;
    return { update(next: unknown) { (node as any).zoneOptions = next; }, destroy() {} };
  },
}));
const MultiTextInput = require("../MultiTextInput.svelte").default;
const activeDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "activeDocument");
beforeAll(() => Object.defineProperty(globalThis, "activeDocument", { configurable: true, get: () => document }));
afterAll(() => {
  if (activeDocumentDescriptor) Object.defineProperty(globalThis, "activeDocument", activeDocumentDescriptor);
  else Reflect.deleteProperty(globalThis, "activeDocument");
});
const mounted: Array<() => void> = [];
function mount(options = ["first", "second"]) {
  const target = document.createElement("div"); document.body.appendChild(target);
  const changes: string[][] = [];
  let component: any;
  const onChange = jest.fn((next: string[]) => { changes.push([...next]); component.$set({ options: next }); });
  component = new MultiTextInput({ target, props: { options, onChange } });
  mounted.push(() => { component.$destroy(); target.remove(); });
  const zone = target.querySelector(".multi-text-list") as HTMLElement & { zoneOptions: { items: Array<{id: number; value: string}>; type: string } };
  return { target, component, changes, onChange, zone };
}
async function type(input: HTMLInputElement, text: string) {
  input.value = text; input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
}
const key = (input: HTMLElement, name: string, extra: KeyboardEventInit = {}) => input.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...extra }));
afterEach(() => mounted.splice(0).forEach(destroy => destroy()));

test("Enter commits the edited option before adding a row, keeping its original input", async () => {
  const m = mount(), input = m.target.querySelector("input")!;
  input.focus(); await type(input, "edited"); key(input, "Enter"); await tick();
  expect(m.changes.at(-1)).toEqual(["edited", "second", ""]);
  expect(m.target.querySelector("input")).toBe(input);
});

test("composition Enter never adds a new option", async () => {
  const m = mount(), input = m.target.querySelector("input")!;
  input.focus(); input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await type(input, "候補"); key(input, "Enter", { isComposing: true }); await tick();
  key(input, "Enter"); await tick(); // Hosts may omit isComposing while composition is still active.
  expect(m.changes).toEqual([]); expect(m.target.querySelectorAll("input")).toHaveLength(2);
});

test("adding focuses only the new row of this editor", async () => {
  const m = mount(), neighbor = mount(["neighbor"]);
  m.target.querySelector("button")!.click(); await tick(); await tick();
  const ownInputs = m.target.querySelectorAll("input");
  expect(document.activeElement).toBe(ownInputs[ownInputs.length - 1]);
  expect(neighbor.changes).toEqual([]);
});

test("changing owner drops the draft and prevents a late blur from writing to the new callback", async () => {
  const m = mount(), input = m.target.querySelector("input")!;
  input.focus(); await type(input, "private old draft");
  const otherWriter = jest.fn(); m.component.$set({ contextKey: "another-field", onChange: otherWriter }); await tick();
  input.dispatchEvent(new FocusEvent("blur")); await tick();
  expect(otherWriter).not.toHaveBeenCalled(); expect(m.target.querySelector("input")!.value).toBe("first");
});

test("different editors do not share a drag type", () => {
  const m = mount(), other = mount(); expect(m.zone.zoneOptions.type).not.toBe(other.zone.zoneOptions.type);
});

test("a finalize belonging to the previous owner is ignored", async () => {
  const m = mount(), before = [...m.zone.zoneOptions.items];
  m.component.$set({ contextKey: "another-field" }); await tick();
  m.zone.dispatchEvent(new CustomEvent("finalize", { detail: { items: before.reverse() } })); await tick();
  expect(m.changes).toEqual([]);
});

test("foreign or duplicate row identities cannot replace this list", async () => {
  const m = mount(), items = m.zone.zoneOptions.items;
  for (const invalid of [[items[0], items[0]], [{ id: 99999, value: "foreign" }, items[1]]]) {
    m.zone.dispatchEvent(new CustomEvent("finalize", { detail: { items: invalid } })); await tick();
  }
  expect(m.changes).toEqual([]);
});

test("reordering uses the current canonical values and preserves row identities", async () => {
  const m = mount(), before = [...m.zone.zoneOptions.items];
  const input = m.target.querySelector("input")!; input.focus(); await type(input, "edited"); input.blur(); await tick();
  m.zone.dispatchEvent(new CustomEvent("finalize", { detail: { items: before.reverse() } })); await tick();
  expect(m.changes.at(-1)).toEqual(["second", "edited"]);
  expect(m.zone.zoneOptions.items.map(item => item.id)).toEqual(before.map(item => item.id));
});

test("a real pointer placeholder is considered without persisting its synthetic identity", async () => {
  const m = mount(), before = [...m.zone.zoneOptions.items];
  const first = before[0]; if (!first) throw new Error("Expected an initial option");
  const shadow = { ...first, id: "id:dnd-shadow-placeholder-0000", isDndShadowItem: true };
  m.zone.dispatchEvent(new CustomEvent("consider", { detail: { items: [shadow, before[1]], info: { id: first.id, trigger: "dragStarted", source: "pointer" } } })); await tick();
  expect(m.zone.zoneOptions.items[0]?.id).toBe(shadow.id); expect(m.changes).toEqual([]);
  m.zone.dispatchEvent(new CustomEvent("finalize", { detail: { items: [...before].reverse() } })); await tick();
  expect(m.changes).toEqual([["second", "first"]]);
});

test("Escape cancels a draft, and locking cannot revive it on unlock", async () => {
  const m = mount(); let input = m.target.querySelector("input")!;
  input.focus(); await type(input, "cancelled"); key(input, "Escape"); input.blur(); await tick();
  expect(m.changes).toEqual([]);
  input.focus(); await type(input, "locked draft"); m.component.$set({ disabled: true }); await tick();
  m.component.$set({ disabled: false }); await tick(); input = m.target.querySelector("input")!;
  input.focus(); key(input, "Enter"); await tick();
  expect(m.changes).toEqual([["first", "second", ""]]);
});

test("an external replacement removes the old input and blocks its late commit", async () => {
  const m = mount(), input = m.target.querySelector("input")!;
  input.focus(); await type(input, "old draft"); m.component.$set({ options: ["replacement"] }); await tick();
  input.dispatchEvent(new FocusEvent("blur")); key(input, "Enter"); await tick();
  expect(m.changes).toEqual([]); expect(m.target.querySelector("input")!.value).toBe("replacement");
});
