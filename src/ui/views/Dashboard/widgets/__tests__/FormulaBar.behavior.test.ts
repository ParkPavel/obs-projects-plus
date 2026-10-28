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
  expect(applied).toHaveBeenCalledWith(expect.objectContaining({ detail: { name: "Profit", expression: "amount + 1" } }));
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
