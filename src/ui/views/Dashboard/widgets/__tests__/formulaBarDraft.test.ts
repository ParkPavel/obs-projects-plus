/**
 * stab-input — FormulaBar keeps the typed formula across a flush and still
 * adopts `expression` from its parent (a field switch) when that really
 * changes and the user is not typing.
 *
 * It bound FormulaConstructor to `inputValue` while a `$: if (…)` statement
 * assigned it — the statement form of the Svelte 3 binding trap (R0.34) that
 * reset typed text in the 3.7.0 table cells. The assignment now lives in a
 * function the `$:` calls.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";

import FormulaBar from "../FormulaBar.svelte";

const textarea = (container: HTMLElement): HTMLTextAreaElement => {
  const el = container.querySelector<HTMLTextAreaElement>(".ppp-fc-textarea");
  if (!el) throw new Error("no formula textarea rendered");
  return el;
};

async function typeInto(el: HTMLTextAreaElement | HTMLInputElement, text: string): Promise<void> {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}

describe("FormulaBar — the typed formula", () => {
  it("survives a flush and is what Apply sends", async () => {
    const { container, component } = render(FormulaBar, { props: { expression: "1", fields: [] } });
    const applied: Array<{ name: string; expression: string }> = [];
    component.$on("apply", (e: CustomEvent<{ name: string; expression: string }>) => applied.push(e.detail));

    const el = textarea(container);
    expect(el.value).toBe("1");
    el.focus();
    await typeInto(el, "1 + 2");
    await tick();
    expect(el.value).toBe("1 + 2");

    const name = container.querySelector<HTMLInputElement>("#formula-name");
    if (!name) throw new Error("no field-name input rendered");
    await typeInto(name, "total");
    await tick();
    expect(el.value).toBe("1 + 2");

    container.querySelector<HTMLButtonElement>(".ppp-btn--primary")?.click();
    expect(applied).toEqual([{ name: "total", expression: "1 + 2", draft: {} }]);
  });
});

describe("FormulaBar — a parent change", () => {
  it("is adopted while the user is not typing (a field switch)", async () => {
    const { container, component } = render(FormulaBar, { props: { expression: "1", fields: [] } });
    await component.$set({ expression: "2 * 3" });
    await tick();
    expect(textarea(container).value).toBe("2 * 3");
  });

  it("is adopted after typing, once focus has left the formula", async () => {
    const { container, component } = render(FormulaBar, { props: { expression: "1", fields: [] } });
    const el = textarea(container);
    el.focus();
    await typeInto(el, "1 + 2");
    el.blur();
    await component.$set({ expression: "40" });
    await tick();
    expect(el.value).toBe("40");
  });

  it("does not overwrite text the user is typing", async () => {
    const { container, component } = render(FormulaBar, { props: { expression: "1", fields: [] } });
    const el = textarea(container);
    el.focus();
    await typeInto(el, "1 + 2");
    await component.$set({ expression: "99" });
    await tick();
    expect(el.value).toBe("1 + 2");
  });
  it("a parent change that arrived while typing is taken on leaving if the user did not edit", async () => {
    const { container, component } = render(FormulaBar, { props: { expression: "1", fields: [] } });
    const el = textarea(container);
    el.focus();
    await component.$set({ expression: "99" });
    await tick();
    expect(el.value).toBe("1");
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    el.blur();
    await tick();
    expect(el.value).toBe("99");
  });

  it("text the user typed wins over a deferred parent change on leaving", async () => {
    const { container, component } = render(FormulaBar, { props: { expression: "1", fields: [] } });
    const el = textarea(container);
    el.focus();
    await typeInto(el, "1 + 2");
    await component.$set({ expression: "99" });
    await tick();
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    el.blur();
    await tick();
    expect(el.value).toBe("1 + 2");
  });
  it("a parent that changes and comes back while the user is in the formula leaves nothing deferred", async () => {
    const { container, component } = render(FormulaBar, { props: { expression: "1", fields: [] } });
    const el = textarea(container);
    el.focus();
    await component.$set({ expression: "99" });
    await tick();
    await component.$set({ expression: "1" });
    await tick();
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    el.blur();
    await tick();
    expect(el.value).toBe("1");
  });
});
