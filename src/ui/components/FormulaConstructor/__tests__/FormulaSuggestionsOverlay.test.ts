import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import FormulaConstructor from "../FormulaConstructor.svelte";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(true) };
});

it("the keyboard confirmation uses the same validation and IME guard as Apply", async () => {
  const read = CSSStyleDeclaration.prototype.getPropertyValue;
  const keyboard = jest.spyOn(CSSStyleDeclaration.prototype, "getPropertyValue").mockImplementation(function (this: CSSStyleDeclaration, name: string) { return name === "--keyboard-height" ? "300px" : read.call(this, name); });
  document.body.classList.add("is-mobile");
  const view = render(FormulaConstructor, { props: { fields: [] } });
  const commit = jest.fn(); view.component.$on("commit", commit);
  try {
    const input = view.container.querySelector<HTMLTextAreaElement>("textarea")!; input.focus();
    const type = async (value: string) => { input.value = value; input.setSelectionRange(value.length, value.length); input.dispatchEvent(new Event("input", { bubbles: true })); await settle(); };
    await type("1+");
    const confirm = document.querySelector<HTMLElement>(".ppp-keyboard-confirm")!;
    expect(confirm).not.toBeNull(); confirm.click(); await settle(); expect(commit).not.toHaveBeenCalled();
    await type("1+2"); input.dispatchEvent(new Event("compositionstart", { bubbles: true })); confirm.click();
    expect(commit).not.toHaveBeenCalled();
    input.dispatchEvent(new Event("compositionend", { bubbles: true })); confirm.click(); await settle();
    expect(commit).toHaveBeenCalledTimes(1); expect(view.container.querySelector("textarea")).toBe(input);
  } finally { view.unmount(); document.body.classList.remove("is-mobile"); keyboard.mockRestore(); }
});
const settle = async () => { await tick(); await tick(); await tick(); };
const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 20, right: 260, width: 240, height, x: 20, y: top, toJSON: () => ({}) });

it("keeps mobile formula suggestions above the same textarea without a sheet or another search field", async () => {
  let top = 240;
  const measured = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.tagName === "TEXTAREA" ? rect(top, 64) : rect(0, 144);
  });
  const view = render(FormulaConstructor, { props: { fields: [] } });
  try {
    const input = view.container.querySelector<HTMLTextAreaElement>("textarea")!;
    input.focus(); input.value = "SU"; input.setSelectionRange(2, 2);
    input.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "U", bubbles: true })); await settle();
    expect(document.querySelector(".ppp-popup--bottom-sheet, .ppp-popup-backdrop")).toBeNull();
    expect(document.querySelectorAll("input")).toHaveLength(0);
    const popup = document.querySelector<HTMLElement>(".ppp-popup--floating")!;
    expect(popup).not.toBeNull(); expect(popup.style.visibility).toBe("visible");
    const pixels = (value: string) => parseFloat(value) * 16;
    expect(pixels(popup.style.top) + pixels(popup.style.maxHeight)).toBeLessThan(240);
    expect(view.container.querySelector("textarea")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input).toHaveAttribute("role", "combobox"); expect(input).toHaveAttribute("aria-controls", popup.id);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); await settle();
    expect(document.getElementById(input.getAttribute("aria-activedescendant")!)).toHaveAttribute("role", "option");
    top = 0; window.dispatchEvent(new Event("resize")); await settle();
    expect(popup).toHaveAttribute("aria-hidden", "true"); expect(popup.style.visibility).toBe("hidden");
    expect(input).toHaveAttribute("aria-expanded", "false"); expect(input).not.toHaveAttribute("aria-activedescendant");
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }); input.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false); expect(input.value).toBe("SU");
    top = 240; window.dispatchEvent(new Event("resize")); await settle();
    expect(popup.style.visibility).toBe("visible"); expect(document.activeElement).toBe(input);
    const option = Array.from(document.querySelectorAll<HTMLButtonElement>(".ppp-fc-suggestion")).find(button => button.textContent?.trim() === "SUM(")!;
    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true }); option.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true); option.click(); await settle();
    expect(input.value).toBe("SUM("); expect(document.activeElement).toBe(input);
  } finally { view.unmount(); measured.mockRestore(); }
});
