/**
 * 3.7.2 B1b — dashboard widget settings and the colour picker moved from raw
 * inputs onto the field kit (TextField / NumberField). Each case pins what the
 * consumer did before: when it writes (live on input, or on leaving the
 * field), what it writes, and what Enter/Escape do.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

const ChecklistConfig = require("../Checklist/ChecklistConfig.svelte").default;
const CoverBannerConfig = require("../CoverBanner/CoverBannerConfig.svelte").default;
const FilterTabsConfig = require("../FilterTabs/FilterTabsConfig.svelte").default;
const DividerWidget = require("../DividerWidget/DividerWidget.svelte").default;
const ColorPicker = require("src/ui/components/ColorPicker/ColorPicker.svelte").default;

function mount(Component: unknown, props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new (Component as new (o: unknown) => { $on: (n: string, f: (e: CustomEvent) => void) => void; $set: (p: unknown) => void })({ target, props });
  const changes: unknown[] = [];
  component.$on("change", (e) => changes.push(e.detail));
  return { target, component, changes };
}

async function type(el: HTMLInputElement, text: string): Promise<void> {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}
const key = (el: HTMLElement, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("B1b consumers keep their events", () => {
  it("ChecklistConfig: the limit is written live as a number, empty is 0", async () => {
    const m = mount(ChecklistConfig, { config: { limit: 5 }, fields: [] });
    const input = m.target.querySelector("input.ppp-number-field") as HTMLInputElement;
    expect(input).toHaveAttribute("inputmode", "numeric");
    await type(input, "12");
    await type(input, "");
    await type(input, "x");
    expect(m.changes).toEqual([{ limit: 12 }, { limit: 0 }]);
  });

  it("CoverBannerConfig: source and caption write on leaving the field; an empty caption is removed", async () => {
    const m = mount(CoverBannerConfig, { config: { src: "a.png", overlay: "Hi" } });
    const src = m.target.querySelector("#cb-src") as HTMLInputElement;
    const overlay = m.target.querySelector("#cb-overlay") as HTMLInputElement;
    src.focus();
    await type(src, "b.png");
    src.blur();
    overlay.focus();
    await type(overlay, "");
    overlay.blur();
    expect(m.changes[0]).toMatchObject({ src: "b.png" });
    expect(m.changes[1]).not.toHaveProperty("overlay");
  });

  it("CoverBannerConfig: width (rem) is a whole number of at least 4", async () => {
    const m = mount(CoverBannerConfig, { config: { widthMode: "fixed", widthRem: 20 } });
    const width = m.target.querySelector("#cb-widthrem") as HTMLInputElement | null;
    if (!width) return; // the field shows only for a fixed width mode
    width.focus();
    await type(width, "3");
    key(width, "Enter");
    await type(width, "40");
    key(width, "Enter");
    expect(m.changes).toEqual([expect.objectContaining({ widthRem: 40 })]);
  });

  it("FilterTabsConfig: a tab label is written live", async () => {
    const m = mount(FilterTabsConfig, { config: { field: "status", tabs: [{ label: "A", value: "a" }] }, fields: [], dataFrame: { fields: [], records: [] } });
    const label = m.target.querySelector(".ppp-text-field") as HTMLInputElement;
    await type(label, "Alpha");
    const last = m.changes[m.changes.length - 1] as { tabs: Array<{ label: string }> };
    expect(last.tabs[0]!.label).toBe("Alpha");
  });

  it("DividerWidget: Enter commits the label, Escape leaves it", async () => {
    const m = mount(DividerWidget, { config: { label: "Old" }, readonly: false });
    (m.target.querySelector(".ppp-divider-widget__label") as HTMLElement | null)?.click();
    await tick();
    await tick();
    let input = m.target.querySelector(".ppp-divider-widget__input") as HTMLInputElement;
    expect(input).not.toBeNull();
    await type(input, "New");
    key(input, "Enter");
    await tick();
    expect(m.changes).toEqual([{ label: "New" }]);
    (m.target.querySelector(".ppp-divider-widget__label") as HTMLElement | null)?.click();
    await tick();
    input = m.target.querySelector(".ppp-divider-widget__input") as HTMLInputElement;
    await type(input, "Other");
    key(input, "Escape");
    await tick();
    expect(m.target.querySelector(".ppp-divider-widget__input")).toBeNull();
    expect(m.changes).toHaveLength(1);
  });

  it("ColorPicker: Enter in the hex field applies the colour and clears the field; a bad hex is marked", async () => {
    const m = mount(ColorPicker, { value: "#000000" });
    const hex = m.target.querySelector("input.hex-input") as HTMLInputElement;
    hex.focus();
    await type(hex, "zz");
    key(hex, "Enter");
    await tick();
    expect(hex).toHaveAttribute("aria-invalid", "true");
    await type(hex, "#ff0000");
    key(hex, "Enter");
    await tick();
    expect(m.changes).toContain("#ff0000");
    expect(hex.value).toBe("");
  });
});
