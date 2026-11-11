import "@testing-library/jest-dom";
import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
jest.mock("dayjs", () => ({ __esModule: true, default: jest.requireActual("dayjs") }));
jest.mock("src/lib/stores/ui", () => { const { writable } = require("svelte/store"); return { isMobile: writable(false) }; });
const Editor = require("../AgendaListEditor.svelte").default;
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);

test.each([null, "future-v2", "", 0, false])("ordinary Save retains unsupported formula marker %p", async formulaVersion => {
  const list = { id: "unsupported", name: "Saved", icon: { type: "lucide", value: "list" },
    filterMode: "advanced", filterFormula: "true", formulaVersion, order: 0 };
  const view = render(Editor, { props: { list, fields: [], records: [], existingLists: [] } });
  const saves: Array<{ formulaVersion: unknown; filterFormula: string }> = [];
  view.component.$on("save", (event: CustomEvent<{ formulaVersion: unknown; filterFormula: string }>) => saves.push(event.detail));
  await flush();
  expect(view.container.querySelector("textarea")?.readOnly).toBe(true);
  view.container.querySelector<HTMLButtonElement>(".header-save")!.click(); await flush();
  expect(saves).toEqual([expect.objectContaining({ formulaVersion, filterFormula: "true" })]);
});
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

test("Escape restores both the visible name and the name submitted by explicit Save", async () => {
  const view = render(Editor, { props: { initialName: "Список", fields: [], records: [], existingLists: [] } });
  const saves: Array<{ name: string }> = []; view.component.$on("save", (event: CustomEvent<{ name: string }>) => saves.push(event.detail));
  const input = view.container.querySelector<HTMLInputElement>("#list-name")!;
  input.focus(); input.value = "Новое"; input.dispatchEvent(new Event("input", { bubbles: true })); await flush();
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await flush();
  expect(input.value).toBe("Список"); expect(saves).toEqual([]);
  view.container.querySelector<HTMLButtonElement>(".header-save")!.click(); await flush();
  expect(saves).toEqual([expect.objectContaining({ name: "Список" })]);
});

test("Enter advances the name baseline for a later Escape in the same focused input", async () => {
  const view = render(Editor, { props: { initialName: "Список", fields: [], records: [], existingLists: [] } });
  const save = jest.fn(); view.component.$on("save", save);
  const input = view.container.querySelector<HTMLInputElement>("#list-name")!; input.focus();
  input.value = "Принято"; input.dispatchEvent(new Event("input", { bubbles: true })); await flush();
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await flush();
  input.value = "Отменено"; input.dispatchEvent(new Event("input", { bubbles: true })); await flush();
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await flush();
  expect(input.value).toBe("Принято"); expect(save).not.toHaveBeenCalled();
  view.container.querySelector<HTMLButtonElement>(".header-save")!.click(); await flush();
  expect(save.mock.calls[0][0].detail.name).toBe("Принято");
});
