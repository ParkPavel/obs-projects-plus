import "@testing-library/jest-dom";
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import TableSearch from "../TableSearch.svelte";

jest.mock("src/lib/stores/ui", () => ({ isMobile: require("svelte/store").writable(true), isMobileDevice: require("svelte/store").writable(true) }));
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);
async function mount(fieldNames = ["status"]) {
  const view = render(TableSearch, { props: { fieldNames, records: [{ id: "a.md", values: { status: "Ready" } }] } });
  const searches: string[] = []; view.component.$on("search", event => searches.push(event.detail));
  view.container.querySelector<HTMLButtonElement>(".ppp-t2-cb-btn")!.click(); await flush();
  const input = view.container.querySelector<HTMLInputElement>("input")!;
  let top = 300;
  jest.spyOn(input, "getBoundingClientRect").mockImplementation(() => ({ top, bottom: top + 28, left: 60, right: 260, width: 200, height: 28 } as DOMRect));
  const anchor = view.container.querySelector<HTMLElement>(".ppp-t2-cb-search")!;
  jest.spyOn(anchor, "getBoundingClientRect").mockImplementation(() => input.getBoundingClientRect());
  const popup = document.querySelector<HTMLElement>(".ppp-popup--floating")!;
  jest.spyOn(popup, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 160, left: 0, right: 240, width: 240, height: 160 } as DOMRect);
  Object.defineProperty(popup, "scrollHeight", { configurable: true, value: 160 });
  input.value = "sta"; input.dispatchEvent(new Event("input", { bubbles: true })); input.setSelectionRange(1, 2);
  window.dispatchEvent(new Event("resize")); await flush();
  return { ...view, input, popup, searches, setTop: (value: number) => { top = value; window.dispatchEvent(new Event("resize")); } };
}
const key = (input: HTMLInputElement, value: string) => input.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
it("keeps completion bounds above the original search input without moving its caret", async () => {
  const view = await mount();
  expect(parseFloat(view.popup.style.top) * 16 + parseFloat(view.popup.style.maxHeight) * 16).toBeLessThanOrEqual(296);
  expect(view.container.querySelector("input")).toBe(view.input); expect(view.popup.querySelector("input")).toBeNull();
  expect([view.input.selectionStart, view.input.selectionEnd]).toEqual([1, 2]); expect(document.activeElement).toBe(view.input);
  view.unmount();
});
it("does not choose a completion once there is no room for its list", async () => {
  const view = await mount(); key(view.input, "ArrowDown"); await flush();
  view.setTop(0); await flush(); const before = view.searches.length;
  key(view.input, "Enter"); await flush();
  expect(view.input.value).toBe("sta"); expect(view.searches).toHaveLength(before);
  expect(view.input).toHaveAttribute("aria-expanded", "false"); expect(view.input).not.toHaveAttribute("aria-activedescendant"); view.unmount();
});
it("an explicit visible completion updates that same focused input, exactly once", async () => {
  const view = await mount(); key(view.input, "ArrowDown"); await flush(); key(view.input, "Enter"); await flush();
  expect(view.container.querySelector("input")).toBe(view.input); expect(document.activeElement).toBe(view.input);
  expect(view.input.value).toBe("status:"); expect(view.searches).toEqual(["sta", "status:"]); view.unmount();
});
it.each([false, true])("Tab accepts the visible completion and leaves native navigation free (reverse=%s)", async shiftKey => {
  const view = await mount(); key(view.input, "ArrowDown"); await flush();
  const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
  view.input.dispatchEvent(event); await flush();
  expect(event.defaultPrevented).toBe(false); expect(view.input.value).toBe("status:");
  expect(document.querySelector(".ppp-popup--floating")).toBeNull(); expect(view.searches).toEqual(["sta", "status:"]); view.unmount();
});
it("does not clear or remove the source field when Escape belongs to an active IME composition", async () => {
  const view = await mount(); const before = view.searches.length;
  view.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); key(view.input, "Escape"); await flush();
  expect(view.container.querySelector("input")).toBe(view.input); expect(view.input.value).toBe("sta"); expect(view.searches).toHaveLength(before); view.unmount();
});
it("reveals the active completion by scrolling only its bounded popup", async () => {
  const view = await mount(["status", "start", "stamp"]);
  Object.defineProperties(view.popup, { clientHeight: { configurable: true, value: 40 }, offsetHeight: { configurable: true, value: 160 } });
  view.popup.scrollTop = 0;
  const rows = document.querySelectorAll<HTMLElement>(".ppp-t2-hint");
  jest.spyOn(rows[2]!, "getBoundingClientRect").mockReturnValue({ top: 60, bottom: 80, left: 0, right: 240, width: 240, height: 20 } as DOMRect);
  const outsideScroll = jest.fn(); view.input.scrollIntoView = outsideScroll;
  for (let i = 0; i < 3; i++) { key(view.input, "ArrowDown"); await flush(); }
  expect(view.popup.scrollTop).toBe(40); expect(outsideScroll).not.toHaveBeenCalled(); expect(document.activeElement).toBe(view.input); view.unmount();
});
it("the first ArrowUp chooses the last visible completion", async () => {
  const view = await mount(["status", "start", "stamp"]); key(view.input, "ArrowUp"); await flush(); key(view.input, "Enter"); await flush();
  expect(view.input.value).toBe("stamp:"); expect(view.searches).toEqual(["sta", "stamp:"]); view.unmount();
});
it("the keyboard ✓ keeps the original search and ignores an active composition", async () => {
  const keyboardHeight = document.documentElement.style.getPropertyValue("--keyboard-height"), virtualKeyboardHeight = 300;
  document.body.classList.add("is-mobile"); document.documentElement.style.setProperty("--keyboard-height", `${virtualKeyboardHeight}px`);
  const view = await mount();
  try {
    key(view.input, "ArrowDown"); await flush(); const before = view.searches.length;
    const confirm = document.querySelector<HTMLElement>(".ppp-keyboard-confirm")!; expect(confirm).not.toBeNull();
    view.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); confirm.click(); await flush();
    expect(view.searches).toHaveLength(before); expect(view.input.value).toBe("sta");
    view.input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })); confirm.click(); await flush();
    expect(view.searches).toEqual(["sta", "status:"]); expect(view.input.value).toBe("status:");
    expect(view.container.querySelector("input")).toBe(view.input); expect(document.activeElement).toBe(view.input);
  } finally {
    view.unmount(); document.body.classList.remove("is-mobile");
    if (keyboardHeight) document.documentElement.style.setProperty("--keyboard-height", keyboardHeight); else document.documentElement.style.removeProperty("--keyboard-height");
  }
});
