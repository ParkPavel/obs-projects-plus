/**
 * stab-input — FormulaEditor keeps the typed formula across a flush and still
 * adopts `expression` from its parent when that really changes.
 *
 * It bound FormulaConstructor to `inputValue` while
 * `$: if (expression !== lastExpression) { inputValue = expression; … }`
 * assigned it — the statement form of the Svelte 3 binding trap (R0.34) that
 * reset typed text in the 3.7.0 table cells. Here the guard happened to hold,
 * so the reset did not show; the assignment now lives in a function the `$:`
 * calls, and these cases pin the behaviour either way: typed text survives a
 * flush, a real parent change is adopted while the user is not typing, and a
 * change that arrives mid-typing does not overwrite the text.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";

import FormulaEditor from "../FormulaEditor.svelte";

const textarea = (container: HTMLElement): HTMLTextAreaElement => {
  const el = container.querySelector<HTMLTextAreaElement>(".ppp-fc-textarea");
  if (!el) throw new Error("no formula textarea rendered");
  return el;
};

async function typeInto(el: HTMLTextAreaElement, text: string): Promise<void> {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}

function mount(expression: string) {
  const result = render(FormulaEditor, { props: { expression, fields: [], validate: () => [] } });
  const changes: string[] = [];
  const commits: string[] = [];
  result.component.$on("change", (e: CustomEvent<string>) => changes.push(e.detail));
  result.component.$on("commit", (e: CustomEvent<string>) => commits.push(e.detail));
  return { ...result, changes, commits };
}

describe("FormulaEditor — the typed formula", () => {
  it("survives a flush and is what change and commit carry", async () => {
    const { container, changes, commits } = mount("1");
    const el = textarea(container);
    expect(el.value).toBe("1");

    el.focus();
    await typeInto(el, "1 + 2");
    await tick();
    expect(el.value).toBe("1 + 2");
    expect(changes).toEqual(["1 + 2"]);

    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    expect(commits).toEqual(["1 + 2"]);
  });

  it("survives the parent echoing it back as `expression`", async () => {
    const { container, component } = mount("1");
    const el = textarea(container);
    el.focus();
    await typeInto(el, "1 + 2");
    await component.$set({ expression: "1 + 2" });
    await tick();
    await typeInto(el, "1 + 2 + 3");
    await tick();
    expect(el.value).toBe("1 + 2 + 3");
  });
});

describe("FormulaEditor — a parent change", () => {
  it("is adopted while the user is not typing", async () => {
    const { container, component } = mount("1");
    await component.$set({ expression: "2 * 3" });
    await tick();
    expect(textarea(container).value).toBe("2 * 3");
  });

  it("is adopted after typing, once focus has left", async () => {
    const { container, component } = mount("1");
    const el = textarea(container);
    el.focus();
    await typeInto(el, "1 + 2");
    el.blur();
    await component.$set({ expression: "40" });
    await tick();
    expect(el.value).toBe("40");
  });

  it("does not overwrite text the user is typing", async () => {
    const { container, component } = mount("1");
    const el = textarea(container);
    el.focus();
    await typeInto(el, "1 + 2");
    await component.$set({ expression: "99" });
    await tick();
    expect(el.value).toBe("1 + 2");
  });
});
