import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import { app } from "src/lib/stores/obsidian";
import { DEFAULT_PROJECT } from "src/settings/settings";
import NoteDraft from "../NoteDraft.svelte";

const previousApp = get(app);
const project = { ...DEFAULT_PROJECT, id: "own", name: "Own", defaultName: "Draft" };
beforeEach(() => app.set({ vault: { getAbstractFileByPath: () => null } } as never));
afterEach(() => { cleanup(); app.set(previousApp); });
const flush = async () => { await tick(); await tick(); await tick(); };

it("keeps the original focused input and selection while a refused write can be retried", async () => {
  let reject!: (error: Error) => void;
  const onSave = jest.fn().mockReturnValueOnce(new Promise<void>((_, fail) => { reject = fail; })).mockResolvedValue(undefined);
  const view = render(NoteDraft, { props: { project, onSave, onCancel: jest.fn() } });
  await flush();
  const input = view.container.querySelector("input")!;
  input.setSelectionRange(1, 4);
  view.container.querySelector<HTMLButtonElement>("[data-note-save]")!.click(); await flush();
  expect(input.readOnly).toBe(true); expect(input.disabled).toBe(false);
  expect(input.ownerDocument.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
  reject(new Error("disk busy")); await flush();
  expect(view.container.querySelector("input")).toBe(input); expect(input.value).toBe("Draft");
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await flush();
  expect(onSave).toHaveBeenCalledTimes(2);
});

it("does not let the form's save button bypass an active IME composition", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const view = render(NoteDraft, { props: { project, onSave, onCancel: jest.fn() } });
  await flush();
  const input = view.container.querySelector("input")!, save = view.container.querySelector<HTMLButtonElement>("[data-note-save]")!;
  input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  input.value = "Событие"; input.dispatchEvent(new Event("input", { bubbles: true })); await flush();
  save.click(); await flush(); expect(onSave).not.toHaveBeenCalled();
  input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Событие" }));
  save.click(); await flush(); expect(onSave).toHaveBeenCalledTimes(1); expect(onSave.mock.calls[0]![0]).toBe("Событие");
});
