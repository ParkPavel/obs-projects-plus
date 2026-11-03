import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import DataTableContent from "../DataTableContent.svelte";

const settle = async () => { await tick(); await tick(); await tick(); };
beforeEach(() => {
  document.body.classList.add("is-mobile");
  const read = CSSStyleDeclaration.prototype.getPropertyValue;
  jest.spyOn(CSSStyleDeclaration.prototype, "getPropertyValue").mockImplementation(function (this: CSSStyleDeclaration, name: string) {
    return name === "--keyboard-height" ? "300px" : read.call(this, name);
  });
});
afterEach(() => {
  document.body.classList.remove("is-mobile");
  jest.restoreAllMocks();
});
function deferred() {
  let resolve!: (value: boolean) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<boolean>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

it.each([
  [DataFieldType.String, "new text", "new text", [], false],
  [DataFieldType.Number, "0", 0, [], false],
  [DataFieldType.String, "", "", [], false],
  [DataFieldType.Date, "03.11.2026", "2026-11-03", [], false],
  [DataFieldType.Select, "new choice", "new choice", ["old choice"], false],
  [DataFieldType.Number, "2", 2, [], true],
])("keeps the same type %s editor until the write succeeds, with a retry after failure", async (type, text, expected, options, rejects) => {
  const field = { name: "f", type, repeated: false, identifier: false, derived: false, typeConfig: { options } };
  const name = { ...field, name: "name", type: DataFieldType.String, identifier: true };
  const record = { id: "A.md", values: { name: "A", f: type === DataFieldType.Number ? 1 : "old choice" } };
  const frame = { fields: [name, field], records: [record] };
  const first = deferred();
  const second = deferred();
  const updateRecord = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const view = render(DataTableContent, { props: {
    frame, fields: frame.fields, api: { updateRecord } as never,
    readonly: false, config: undefined, getRecordColor: () => null,
  } });
  await settle();
  view.container.querySelector<HTMLElement>(".ppp-t2-cell--editable")!.click();
  await settle();
  const input = view.container.querySelector<HTMLInputElement>(".ppp-t2-editor, .ppp-t2-choice-input")!;
  expect(input).not.toBeNull();
  input.value = text as string;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
  const enter = () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  const confirm = document.querySelector<HTMLElement>(".ppp-keyboard-confirm")!;
  expect(confirm).not.toBeNull();
  confirm.click();
  await settle();
  expect(updateRecord).toHaveBeenCalledTimes(1);
  expect(updateRecord.mock.calls[0]![0].values.f).toEqual(expected);
  expect(view.container.querySelector(".ppp-t2-editor, .ppp-t2-choice-input")).toBe(input);
  expect(document.activeElement).toBe(input);
  enter();
  expect(updateRecord).toHaveBeenCalledTimes(1);
  if (rejects) first.reject(new Error("write refused"));
  else first.resolve(false);
  await settle();
  expect(input.isConnected).toBe(true);
  expect(input.value).toBe(text);
  enter();
  await settle();
  expect(updateRecord).toHaveBeenCalledTimes(2);
  second.resolve(true);
  await settle();
  expect(view.container.querySelector(".ppp-t2-editor, .ppp-t2-choice-input")).toBeNull();
  view.unmount();
});

it.each(["writer", "source", "readonly", "schema"])("cancels the old draft when its %s context changes", async change => {
  const field = { name: "f", type: DataFieldType.String, repeated: false, identifier: false, derived: false, typeConfig: {} };
  const name = { ...field, name: "name", identifier: true };
  const record = { id: "A.md", values: { name: "A", f: "old" } };
  const frame = { fields: [name, field], records: [record] };
  const updateA = jest.fn().mockResolvedValue(true), updateB = jest.fn().mockResolvedValue(true);
  const view = render(DataTableContent, { props: { frame, fields: frame.fields, api: { updateRecord: updateA } as never, sourceProjectId: "source-a", readonly: false, config: undefined, getRecordColor: () => null } });
  try {
    await settle(); view.container.querySelector<HTMLElement>(".ppp-t2-cell--editable")!.click(); await settle();
    const input = view.container.querySelector<HTMLInputElement>(".ppp-t2-editor, .ppp-t2-choice-input")!;
    expect(input).not.toBeNull();
    input.value = "draft"; input.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    if (change === "writer") view.component.$set({ api: { updateRecord: updateB } as never });
    else if (change === "source") view.component.$set({ sourceProjectId: "source-b" });
    else if (change === "readonly") view.component.$set({ readonly: true });
    else view.component.$set({ fields: [name, { ...field, type: DataFieldType.Number }] });
    await settle();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await settle();
    expect(updateA).not.toHaveBeenCalled(); expect(updateB).not.toHaveBeenCalled();
    expect(view.container.querySelector(".ppp-t2-editor, .ppp-t2-choice-input")).toBeNull();
  } finally { view.unmount(); }
});
