import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import FormulaBar from "../FormulaBar.svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
import { formulaWouldCycle } from "../formulaPreview";
import { validateVersionedFormula } from "src/lib/formula/version";

jest.mock("../formulaPreview", () => {
  const actual = jest.requireActual("../formulaPreview");
  return { ...actual, formulaWouldCycle: jest.fn(actual.formulaWouldCycle) };
});
jest.mock("src/lib/formula/version", () => {
  const actual = jest.requireActual("src/lib/formula/version");
  return { ...actual, validateVersionedFormula: jest.fn(actual.validateVersionedFormula) };
});

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
  expect(applied).toHaveBeenCalledWith(expect.objectContaining({ detail: { name: "Profit", expression: "amount + 1", draft: { formulaVersion: "unified-v1" } } }));
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
    expect((container.querySelector(".ppp-btn--primary") as HTMLButtonElement).disabled).toBe(true);
    jest.advanceTimersByTime(550); await tick();
    expect((container.querySelector(".ppp-btn--primary") as HTMLButtonElement).disabled).toBe(false);
  } finally { jest.useRealTimers(); }
});
test("saved calculated fields can be deleted without selecting or applying them", async () => {
  const { container, component } = render(FormulaBar, {
    formulaFields: [{ name: "Total", expression: "SUM(@amount)" }],
  });
  const removed = jest.fn();
  const applied = jest.fn();
  component.$on("remove", removed);
  component.$on("apply", applied);
  await fireEvent.click(container.querySelector(".ppp-formula-saved-remove")!);
  expect(removed).toHaveBeenCalledWith(expect.objectContaining({ detail: "Total" }));
  expect(applied).not.toHaveBeenCalled();
});
test("Escape outside the suggestion list closes the formula editor without applying", async () => {
  const { container, component } = render(FormulaBar, { fields: [] });
  const cancelled = jest.fn(); const applied = jest.fn();
  component.$on("cancel", cancelled); component.$on("apply", applied);
  await fireEvent.keyDown(container.querySelector("textarea")!, { key: "Escape" });
  expect(cancelled).toHaveBeenCalledTimes(1);
  expect(applied).not.toHaveBeenCalled();
});

test("a saved definition survives a copied field name and keeps the one rule set", async () => {
  jest.useFakeTimers();
  try {
    const { container, component } = render(FormulaBar, { fields: ["amount", "Answer"], previewFrame: frame,
      formulaFields: [{ name: "Answer", expression: '"2" < "10"', formulaVersion: "unified-v1" }] });
    expect(container.querySelector(".ppp-formula-mode")).toBeNull();
    const applied: unknown[] = [];
    component.$on("apply", event => applied.push(event.detail));
    await fireEvent.click(container.querySelector(".ppp-formula-saved button")!);
    jest.advanceTimersByTime(150); await tick();
    expect(container.querySelector(".ppp-formula-preview-value")?.textContent).toBe("false");
    await fireEvent.input(container.querySelector("input")!, { target: { value: "Copy" } });
    await fireEvent.keyDown(container.querySelector("textarea")!, { key: "Enter", ctrlKey: true });
    expect(applied.at(-1)).toEqual({ name: "Copy", expression: '"2" < "10"', draft: { formulaVersion: "unified-v1" } });
  } finally { jest.useRealTimers(); }
});

test("an existing unversioned definition keeps its preview and saved semantics on Apply", async () => {
  jest.useFakeTimers();
  try {
    const { container, component } = render(FormulaBar, { fields: ["amount", "Total"], previewFrame: frame,
      formulaFields: [{ name: "Total", expression: '"2" < "10"' }] });
    const applied: unknown[] = [];
    component.$on("apply", event => applied.push(event.detail));
    await fireEvent.click(container.querySelector(".ppp-formula-saved button")!);
    jest.advanceTimersByTime(700); await tick();
    await fireEvent.keyDown(container.querySelector("textarea")!, { key: "Enter", ctrlKey: true });
    expect(container.querySelector(".ppp-formula-preview-value")?.textContent).toBe("true");
    expect(applied.at(-1)).toEqual({ name: "Total", expression: '"2" < "10"', draft: {} });
  } finally { jest.useRealTimers(); }
});

test("a future formula is read-only and cannot be overwritten by typing its name", async () => {
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

test("burst typing defers graph and wrapper validation; keyboard commit uses the current checked draft", async () => {
  jest.useFakeTimers();
  try {
    const { container, component } = render(FormulaBar, { expression: "1 + 1", previewRecord: frame.records[0] });
    const applied = jest.fn(); component.$on("apply", applied);
    await fireEvent.input(container.querySelector("input")!, { target: { value: "Answer" } });
    jest.mocked(formulaWouldCycle).mockClear();
    jest.mocked(validateVersionedFormula).mockClear();
    const textarea = container.querySelector("textarea")!;
    for (const value of ["1 + 2", "1 + 23", "1 + 234"]) {
      await fireEvent.input(textarea, { target: { value } });
    }
    expect(formulaWouldCycle).not.toHaveBeenCalled();
    expect(validateVersionedFormula).not.toHaveBeenCalled();
    const apply = container.querySelector<HTMLButtonElement>(".ppp-btn--primary")!;
    expect(apply.disabled).toBe(true);
    jest.advanceTimersByTime(150); await tick();
    expect(formulaWouldCycle).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".ppp-formula-preview-value")?.textContent).toBe("235");
    expect(apply.disabled).toBe(true);
    jest.advanceTimersByTime(550); await tick();
    expect(apply.disabled).toBe(false);
    await fireEvent.input(textarea, { target: { value: "3 + 4" } });
    expect(apply.disabled).toBe(true);
    jest.mocked(formulaWouldCycle).mockClear();
    jest.mocked(validateVersionedFormula).mockClear();
    await fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(applied).toHaveBeenCalledWith(expect.objectContaining({ detail: { name: "Answer", expression: "3 + 4", draft: { formulaVersion: "unified-v1" } } }));
    expect(formulaWouldCycle).toHaveBeenCalledTimes(1);
    expect(validateVersionedFormula).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});

test("changed definitions invalidate cycle approval and immediate commit checks the new graph", async () => {
  jest.useFakeTimers();
  try {
    const { container, component, rerender } = render(FormulaBar, { expression: "Other + 1", fields: ["Other"], formulaFields: [{ name: "Other", expression: "1" }] });
    const applied = jest.fn(); component.$on("apply", applied);
    await fireEvent.input(container.querySelector("input")!, { target: { value: "Answer" } });
    jest.advanceTimersByTime(700); await tick();
    const apply = container.querySelector<HTMLButtonElement>(".ppp-btn--primary")!;
    expect(apply.disabled).toBe(false);
    await rerender({ formulaFields: [{ name: "Other", expression: "Answer" }] });
    expect(apply.disabled).toBe(true);
    await fireEvent.keyDown(container.querySelector("textarea")!, { key: "Enter", ctrlKey: true });
    expect(applied).not.toHaveBeenCalled();
    jest.advanceTimersByTime(150); await tick();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await rerender({ formulaFields: [] });
    expect(apply.disabled).toBe(true);
    jest.advanceTimersByTime(150); await tick();
    expect(apply.disabled).toBe(false);
    await fireEvent.click(apply);
    expect(applied).toHaveBeenCalledWith(expect.objectContaining({ detail: { name: "Answer", expression: "Other + 1", draft: { formulaVersion: "unified-v1" } } }));
  } finally { jest.useRealTimers(); }
});
