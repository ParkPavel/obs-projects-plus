import { render, fireEvent, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import ViewNameDraft from "../ViewNameDraft.svelte";

afterEach(cleanup);
function setup(existingNames: string[] = []) {
  const onCommit = jest.fn();
  const onCancel = jest.fn();
  const view = render(ViewNameDraft, { initialName: "Board", existingNames, onCommit, onCancel });
  return { ...view, onCommit, onCancel, input: view.container.querySelector("input")! };
}
test("the new tab selects its proposed name; Return creates once, blur cannot create twice", async () => {
  const { input, onCommit } = setup();
  expect(document.activeElement).toBe(input);
  expect(input.selectionEnd).toBe(5);
  await fireEvent.input(input, { target: { value: "  Sprint  " } });
  await fireEvent.keyDown(input, { key: "Enter" });
  await fireEvent.blur(input);
  expect(onCommit).toHaveBeenCalledTimes(1);
  expect(onCommit).toHaveBeenCalledWith("Sprint");
});
test("Escape cancels without creating a placeholder view", async () => {
  const { input, onCommit, onCancel } = setup();
  await fireEvent.input(input, { target: { value: "Draft" } });
  await fireEvent.keyDown(input, { key: "Escape" });
  await fireEvent.blur(input);
  expect(onCommit).not.toHaveBeenCalled();
  expect(onCancel).toHaveBeenCalledTimes(1);
});
test("blank or duplicate names cannot create; a corrected name can", async () => {
  const { input, onCommit } = setup(["Taken"]);
  for (const value of [" ", " Taken "]) {
    await fireEvent.input(input, { target: { value } });
    await fireEvent.keyDown(input, { key: "Enter" });
  }
  expect(onCommit).not.toHaveBeenCalled();
  expect(input.getAttribute("aria-invalid")).toBe("true");
  await fireEvent.input(input, { target: { value: "Available" } });
  await fireEvent.keyDown(input, { key: "Enter" });
  expect(onCommit).toHaveBeenCalledWith("Available");
});
test("IME Return does not create a view; the next explicit Return does", async () => {
  const { input, onCommit } = setup();
  await fireEvent.compositionStart(input);
  await fireEvent.input(input, { target: { value: "計画" } });
  await fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(onCommit).not.toHaveBeenCalled();
  await fireEvent.compositionEnd(input);
  await fireEvent.keyDown(input, { key: "Enter" });
  expect(onCommit).toHaveBeenCalledWith("計画");
});
test("the cancel tool owns its press and does not blur-commit en route", async () => {
  const { container, input, onCommit, onCancel } = setup();
  await fireEvent.input(input, { target: { value: "Draft" } });
  const cancel = container.querySelectorAll("button")[1]!;
  const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  cancel.dispatchEvent(press);
  expect(press.defaultPrevented).toBe(true);
  await fireEvent.click(cancel);
  await tick();
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onCommit).not.toHaveBeenCalled();
});
