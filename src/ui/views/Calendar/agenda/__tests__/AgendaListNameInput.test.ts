import "@testing-library/jest-dom";
import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
jest.mock("dayjs", () => ({ __esModule: true, default: jest.requireActual("dayjs") }));
jest.mock("src/lib/stores/ui", () => { const { writable } = require("svelte/store"); return { isMobile: writable(false) }; });
const Editor = require("../AgendaListEditor.svelte").default;
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);
test("the list name uses the common original TextField and IME cannot save the form early", async () => {
  const view = render(Editor, { props: { initialName: "Список", fields: [], records: [], existingLists: [] } });
  const saves: Array<{ name: string }> = []; view.component.$on("save", (event: CustomEvent<{ name: string }>) => saves.push(event.detail));
  const input = view.container.querySelector<HTMLInputElement>("#list-name")!;
  expect(input).toHaveClass("ppp-text-field");
  input.focus(); input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  input.value = "Новый список"; input.dispatchEvent(new Event("input", { bubbles: true })); await flush();
  view.container.querySelector<HTMLButtonElement>(".header-save")!.click(); await flush(); expect(saves).toEqual([]);
  input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })); await flush();
  view.container.querySelector<HTMLButtonElement>(".header-save")!.click(); await flush();
  expect(saves).toEqual([expect.objectContaining({ name: "Новый список" })]);
  expect(view.container.querySelector("#list-name")).toBe(input);
});
test("the original list-name control blocks save during IME even with an already valid name", async () => {
  const view = render(Editor, { props: { initialName: "Список", fields: [], records: [], existingLists: [] } });
  const save = jest.fn(); view.component.$on("save", save);
  const input = view.container.querySelector<HTMLInputElement>("#list-name")!;
  input.focus(); input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  view.container.querySelector<HTMLButtonElement>(".header-save")!.click(); await flush(); expect(save).not.toHaveBeenCalled();
});
