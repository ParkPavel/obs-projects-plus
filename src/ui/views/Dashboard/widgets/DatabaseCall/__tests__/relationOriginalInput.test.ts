import "@testing-library/jest-dom";
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import EditableCell from "../EditableCell.svelte";
type DataField = import("src/lib/dataframe/dataframe").DataField;
jest.mock("src/lib/stores/ui", () => ({ isMobile: require("svelte/store").writable(true), isMobileDevice: require("svelte/store").writable(true) }));
jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }) }));
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);
function mount(repeated = false) {
  const field: DataField = { name: "links", type: DataFieldType.Relation, repeated, derived: false, identifier: false, typeConfig: {} };
  return render(EditableCell, { props: { field, value: null, editing: true, readonly: false, api: {} as never,
    frame: { fields: [field], records: [{ id: "Source.md", values: { links: ["[[Alpha]]", "[[Beta]]"] } }] } } });
}
it("keeps the only search input inside the original cell and anchors suggestions above it on mobile", async () => {
  const view = mount(); await flush();
  const input = view.container.querySelector<HTMLInputElement>("input")!;
  expect(input).not.toBeNull(); expect(document.querySelectorAll("input.ppp-rel-picker-search")).toHaveLength(1);
  expect(document.querySelector(".ppp-popup--bottom-sheet")).toBeNull();
  expect(document.querySelector(".ppp-popup input")).toBeNull();
  expect(input).toHaveAttribute("role", "combobox"); expect(input.ownerDocument.activeElement).toBe(input);
});
it("does not commit an IME candidate through Enter or the multiple-selection Done action", async () => {
  const view = mount(true), commit = jest.fn(); view.component.$on("commit", event => commit(event.detail)); await flush();
  const input = document.querySelector<HTMLInputElement>("input.ppp-rel-picker-search")!;
  input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await flush();
  document.querySelector<HTMLButtonElement>(".ppp-rel-picker-done")!.click(); await flush();
  expect(commit).not.toHaveBeenCalled();
  input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  document.querySelector<HTMLButtonElement>(".ppp-rel-picker-done")!.click(); await flush();
  expect(commit).toHaveBeenCalledTimes(1); expect(commit.mock.calls[0]![0]).toBeNull();
});
it("keeps that original query, focus and selection read-only while persistence is pending", async () => {
  const view = mount(), commit = jest.fn(); view.component.$on("commit", event => commit(event.detail)); await flush();
  const input = document.querySelector<HTMLInputElement>("input.ppp-rel-picker-search")!;
  input.value = "Al"; input.dispatchEvent(new Event("input", { bubbles: true })); input.focus(); input.setSelectionRange(0, 1); await flush();
  view.component.$set({ saving: true }); await flush();
  expect(input.readOnly).toBe(true); expect(input.disabled).toBe(false); expect(input.value).toBe("Al");
  expect(input.ownerDocument.activeElement).toBe(input); expect([input.selectionStart, input.selectionEnd]).toEqual([0, 1]);
  expect(view.container.contains(input)).toBe(true); expect(commit).not.toHaveBeenCalled();
});

it("the actual keyboard ✓ uses the same multi-selection and IME guard without replacing the input", async () => {
  const keyboardHeight = document.documentElement.style.getPropertyValue("--keyboard-height");
  const virtualKeyboardHeight = 300;
  document.body.classList.add("is-mobile"); document.documentElement.style.setProperty("--keyboard-height", `${virtualKeyboardHeight}px`);
  const view = mount(true), commit = jest.fn(); view.component.$on("commit", event => commit(event.detail));
  try {
    await flush(); const input = view.container.querySelector<HTMLInputElement>("input")!;
    const confirm = document.querySelector<HTMLElement>(".ppp-keyboard-confirm")!; expect(confirm).not.toBeNull();
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); confirm.click(); expect(commit).not.toHaveBeenCalled();
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })); confirm.click(); await flush();
    expect(commit).toHaveBeenCalledTimes(1); expect(commit.mock.calls[0]![0]).toBeNull();
    expect(view.container.querySelector("input")).toBe(input); expect(input.ownerDocument.activeElement).toBe(input);
    view.component.$set({ saving: true }); await flush(); confirm.click(); expect(commit).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount(); document.body.classList.remove("is-mobile");
    if (keyboardHeight) document.documentElement.style.setProperty("--keyboard-height", keyboardHeight);
    else document.documentElement.style.removeProperty("--keyboard-height");
  }
});

it("bounds its list above the actual input, keeps the caret on resize, and clears inside the same interaction", async () => {
  const view = mount(), cancel = jest.fn(), commit = jest.fn(); view.component.$on("cancel", cancel); view.component.$on("commit", commit); await flush();
  const input = view.container.querySelector<HTMLInputElement>("input")!;
  jest.spyOn(input, "getBoundingClientRect").mockReturnValue({ top: 300, bottom: 328, left: 60, right: 260, width: 200, height: 28 } as DOMRect);
  const popup = document.querySelector<HTMLElement>(".ppp-popup--floating")!;
  Object.defineProperty(popup, "scrollHeight", { configurable: true, value: 400 });
  jest.spyOn(popup, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 200, left: 0, right: 320, width: 320, height: 200 } as DOMRect);
  input.value = "Al"; input.dispatchEvent(new Event("input", { bubbles: true })); input.setSelectionRange(0, 1);
  window.dispatchEvent(new Event("resize")); await flush();
  expect(input).toHaveAttribute("aria-expanded", "true");
  expect(parseFloat(popup.style.top) * 16 + parseFloat(popup.style.maxHeight) * 16).toBeLessThanOrEqual(296);
  expect(view.container.querySelector("input")).toBe(input); expect([input.selectionStart, input.selectionEnd]).toEqual([0, 1]);
  const clear = view.container.querySelector<HTMLButtonElement>(".ppp-search-field-clear")!;
  clear.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); clear.click(); await flush();
  expect(input.value).toBe(""); expect(input.ownerDocument.activeElement).toBe(input);
  expect(cancel).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
});
