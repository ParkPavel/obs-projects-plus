import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import FormulaBar from "../FormulaBar.svelte";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";

const frame: DataFrame = {
  fields: [{ name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false }],
  records: [{ id: "a", values: { amount: 2 } }, { id: "b", values: { amount: 7 } }],
};
afterEach(cleanup);
test("keyboard Apply requires a valid expression and a non-colliding name", async () => {
  const { container, component } = render(FormulaBar, { fields: ["amount"], expression: "amount + 1" });
  const applied = jest.fn(); component.$on("apply", applied);
  const textarea = container.querySelector("textarea")!;
  const name = container.querySelector("input")!;
  await fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
  expect(applied).not.toHaveBeenCalled();
  await fireEvent.input(name, { target: { value: "amount" } });
  await fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
  expect(applied).not.toHaveBeenCalled();
  await fireEvent.input(name, { target: { value: "Profit" } });
  await fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
  expect(applied).toHaveBeenCalledWith(expect.objectContaining({ detail: { name: "Profit", expression: "amount + 1", draft: {} } }));
});
test("a saved definition can be edited and its aggregate preview uses the actual dataset", async () => {
  jest.useFakeTimers();
  try {
    const { container } = render(FormulaBar, {
      fields: ["amount", "Total"], previewFrame: frame, formulaFields: [{ name: "Total", expression: "SUM(@amount)" }],
    });
    await fireEvent.click(container.querySelector(".ppp-formula-saved button")!);
    jest.advanceTimersByTime(150); await tick();
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("Total");
    expect(container.querySelector(".ppp-formula-preview-value")?.textContent).toBe("9");
    expect((container.querySelector(".ppp-btn--primary") as HTMLButtonElement).disabled).toBe(false);
  } finally { jest.useRealTimers(); }
});
test("Escape outside the suggestion list closes the formula editor without applying", async () => {
  const { container, component } = render(FormulaBar, { fields: [] });
  const cancelled = jest.fn(); const applied = jest.fn();
  component.$on("cancel", cancelled); component.$on("apply", applied);
  await fireEvent.keyDown(container.querySelector("textarea")!, { key: "Escape" });
  expect(cancelled).toHaveBeenCalledTimes(1);
  expect(applied).not.toHaveBeenCalled();
});

test("saved rules survive a copied field name; an explicit mode choice changes preview and apply together", async () => {
  jest.useFakeTimers();
  try {
    const { container, component } = render(FormulaBar, { fields: ["amount", "Answer"], previewFrame: frame,
      formulaFields: [{ name: "Answer", expression: '"2" < "10"', formulaVersion: "unified-v1" }] });
    const applied: unknown[] = [];
    component.$on("apply", event => applied.push(event.detail));
    await fireEvent.click(container.querySelector(".ppp-formula-saved button")!);
    jest.advanceTimersByTime(150); await tick();
    expect(container.querySelector(".ppp-formula-preview-value")?.textContent).toBe("false");
    await fireEvent.input(container.querySelector("input")!, { target: { value: "Copy" } });
    await fireEvent.keyDown(container.querySelector("textarea")!, { key: "Enter", ctrlKey: true });
    expect(applied.at(-1)).toEqual({ name: "Copy", expression: '"2" < "10"', draft: { formulaVersion: "unified-v1" } });
    await fireEvent.click(container.querySelectorAll(".ppp-formula-mode button")[0]!);
    jest.advanceTimersByTime(150); await tick();
    expect(container.querySelector(".ppp-formula-preview-value")?.textContent).toBe("true");
    await fireEvent.keyDown(container.querySelector("textarea")!, { key: "Enter", ctrlKey: true });
    expect(applied.at(-1)).toEqual({ name: "Copy", expression: '"2" < "10"', draft: {} });
  } finally { jest.useRealTimers(); }
});

test("a future formula is read-only until an explicit supported choice; typing its name cannot overwrite it", async () => {
  const { container, component } = render(FormulaBar, { fields: ["Answer"], previewFrame: frame,
    formulaFields: [{ name: "Answer", expression: "1+1", formulaVersion: "future-v9" }] });
  const applied = jest.fn(); component.$on("apply", applied);
  await fireEvent.input(container.querySelector("input")!, { target: { value: "Answer" } });
  await fireEvent.input(container.querySelector("textarea")!, { target: { value: "1 + 1" } });
  await fireEvent.keyDown(container.querySelector("textarea")!, { key: "Enter", ctrlKey: true });
  expect(applied).not.toHaveBeenCalled();
  await fireEvent.click(container.querySelector(".ppp-formula-saved button")!);
  expect((container.querySelector("textarea") as HTMLTextAreaElement).readOnly).toBe(true);
  expect((container.querySelector(".ppp-btn--primary") as HTMLButtonElement).disabled).toBe(true);
  await fireEvent.click(container.querySelectorAll(".ppp-formula-mode button")[1]!);
  expect((container.querySelector("textarea") as HTMLTextAreaElement).readOnly).toBe(false);
  await fireEvent.keyDown(container.querySelector("textarea")!, { key: "Enter", ctrlKey: true });
  expect(applied.mock.calls[0][0].detail.draft).toEqual({ formulaVersion: "unified-v1" });
});

test("versioned record-only fallback reports a missing dataset for @columns", async () => {
  jest.useFakeTimers();
  try {
    const { container } = render(FormulaBar, { fields: ["amount", "Answer"], previewRecord: frame.records[0],
      formulaFields: [{ name: "Answer", expression: "SUM(@amount)", formulaVersion: "unified-v1" }] });
    await fireEvent.click(container.querySelector(".ppp-formula-saved button")!);
    jest.advanceTimersByTime(150); await tick();
    expect(container.querySelector(".ppp-formula-debug")).not.toBeNull();
    expect(container.querySelector(".ppp-formula-preview-value")).toBeNull();
  } finally { jest.useRealTimers(); }
});
