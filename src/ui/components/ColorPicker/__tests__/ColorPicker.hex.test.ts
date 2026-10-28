import { fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import { settings } from "src/lib/stores/settings";
import type ColorPicker from "../ColorPicker.svelte";
const Component = require("../ColorPicker.svelte").default as typeof ColorPicker;

function mount() {
  const target = document.createElement("div"); document.body.appendChild(target);
  const component = new Component({ target, props: { value: "#ff0000" } });
  const change = jest.fn(); component.$on("change", change);
  return { target, component, change, destroy() { component.$destroy(); target.remove(); } };
}

test.each(["#1234", "12345", "#12345678", "#xyz"])("invalid HEX %s cannot apply an old or truncated color", async (input) => {
  const m = mount();
  try {
    await tick();
    await fireEvent.input(m.target.querySelector("input.hex-input")!, { target: { value: input } });
    await fireEvent.click(m.target.querySelector(".hex-row .apply-btn")!);
    expect(m.change).not.toHaveBeenCalled();
    expect(m.target.querySelector(".hex-error")).not.toBeNull();
  } finally { m.destroy(); }
});

test.each([["#abc", "#aabbcc"], ["ABCDEF", "#abcdef"], [" #123456 ", "#123456"], ["#1A2b3C", "#1a2b3c"]])("typed %s stays exact in apply, preview and saved colors", async (input, expected) => {
  const original = get(settings);
  settings.set({ ...original, preferences: { ...original.preferences, colorFavorites: [] } });
  const m = mount();
  try {
    await tick();
    await fireEvent.input(m.target.querySelector("input.hex-input")!, { target: { value: input } });
    await fireEvent.click(m.target.querySelector(".hex-row .apply-btn")!);
    expect(m.change.mock.calls[0]![0].detail).toBe(expected);
    expect(m.target.querySelector<HTMLElement>(".hex-preview")!.style.getPropertyValue("--preview-color")).toBe(expected);
    await fireEvent.click(m.target.querySelector("button.star-btn")!);
    expect(get(settings).preferences.colorFavorites?.map(f => f.color)).toEqual([expected]);
    // A parent echo must not re-round the exact input through integer HSV.
    m.component.$set({ value: expected }); await tick();
    expect(m.target.querySelector<HTMLElement>(".hex-preview")!.style.getPropertyValue("--preview-color")).toBe(expected);
    const hue = m.target.querySelector<HTMLElement>(".hue-slider")!;
    // Integer event coordinates: one pixel per degree avoids a synthetic
    // subpixel being truncated by MouseEvent before it reaches the picker.
    jest.spyOn(hue, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 360, bottom: 10, width: 360, height: 10, toJSON() { return {}; } });
    await fireEvent.mouseDown(hue, { clientX: Number(hue.getAttribute("aria-valuenow")) });
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(m.change.mock.calls[m.change.mock.calls.length - 1]![0].detail).toBe(expected);
    const area = m.target.querySelector<HTMLElement>(".sat-light-picker")!;
    jest.spyOn(area, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON() { return {}; } });
    await fireEvent.mouseDown(area, { clientX: 0, clientY: 100 });
    window.dispatchEvent(new MouseEvent("mouseup"));
    expect(m.change.mock.calls[m.change.mock.calls.length - 1]![0].detail).toBe("#000000");
  } finally { m.destroy(); settings.set(original); }
});
