import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import TableNewRow from "../TableNewRow.svelte";
import DataTableContent from "../DataTableContent.svelte";
import { get } from "svelte/store";
import { app } from "src/lib/stores/obsidian";
import { DEFAULT_PROJECT } from "src/settings/settings";
import { DataApi } from "src/lib/dataApi";
import { ViewApi } from "src/lib/viewApi";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { parse } from "yaml";
jest.mock("yaml", () => jest.requireActual("../../../../../../../node_modules/yaml/dist/index.js"));

const settle = async () => { await tick(); await tick(); await tick(); };
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const enter = (input: HTMLInputElement) => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

it("retains the same name/input until create succeeds and retries a failed write once", async () => {
  const pending = deferred(), next = deferred(), save = jest.fn().mockReturnValueOnce(pending.promise).mockReturnValueOnce(next.promise);
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const view = render(TableNewRow, { props: { openSignal: 1, save } });
  const legacy = jest.fn(); view.component.$on("create", legacy);
  try {
    await settle(); const input = view.container.querySelector<HTMLInputElement>(".ppp-t2-newrow-input")!;
    input.value = "  New visit  "; input.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    input.setSelectionRange(3, 8); enter(input); await settle();
    expect(save).toHaveBeenCalledWith("New visit"); expect(legacy).not.toHaveBeenCalled();
    expect(view.container.querySelector("input")).toBe(input); expect(input.value).toBe("  New visit  ");
    expect(input.readOnly).toBe(true); expect(input.disabled).toBe(false);
    expect(document.activeElement).toBe(input); expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
    enter(input); expect(save).toHaveBeenCalledTimes(1);
    pending.reject(new Error("write refused")); await settle();
    expect(view.container.querySelector("input")).toBe(input); expect(input.value).toBe("  New visit  "); expect(input.readOnly).toBe(false);
    enter(input); await settle(); expect(save).toHaveBeenCalledTimes(2);
    next.resolve(); await settle();
    const fresh = view.container.querySelector<HTMLInputElement>("input")!;
    expect(fresh).not.toBe(input); expect(fresh.value).toBe("");
  } finally { view.unmount(); log.mockRestore(); }
});

it("a late create result cannot reopen a draft cancelled by a source change", async () => {
  const pending = deferred(), save = jest.fn().mockReturnValue(pending.promise);
  const view = render(TableNewRow, { props: { openSignal: 1, contextKey: "first", save } });
  try {
    await settle(); const input = view.container.querySelector<HTMLInputElement>("input")!;
    input.value = "Visit"; input.dispatchEvent(new Event("input", { bubbles: true })); await settle(); enter(input); await settle();
    view.component.$set({ contextKey: "second" }); await settle(); expect(view.container.querySelector("input")).toBeNull();
    pending.resolve(); await settle(); expect(view.container.querySelector("input")).toBeNull(); expect(save).toHaveBeenCalledTimes(1);
  } finally { view.unmount(); }
});

it("the actual table create writes its block defaults once into complete typed YAML", async () => {
  const previous = get(app); app.set({ vault: { getAbstractFileByPath: () => null } } as never);
  const project = { ...DEFAULT_PROJECT, id: "own", name: "Own", dataSource: { kind: "folder" as const, config: { path: "Own", recursive: true } } };
  const fields = ["name", "type", "paid", "status"].map(name => ({ name, type: name === "paid" ? DataFieldType.Boolean : DataFieldType.String, identifier: name === "name", derived: false, repeated: false }));
  const create = jest.fn(async (_path: string, _content: string) => ({} as never));
  const api = new ViewApi({ includes: () => false } as never, new DataApi({ create, getFile: () => null, getAllFiles: () => [] }));
  const view = render(DataTableContent, { props: { project, api, readonly: false, fields,
    frame: { fields, records: [{ id: "Own/Existing.md", values: { name: "Existing", type: "visit", paid: false, status: "open" } }] },
    config: undefined, getRecordColor: () => null,
    creationConditions: [{ field: "type", operator: "is", value: "visit", enabled: true }, { field: "paid", operator: "is-not-checked", enabled: true }, { field: "status", operator: "is", value: "open", enabled: true }],
  } });
  try {
    await settle(); view.container.querySelector<HTMLButtonElement>(".ppp-t2-newrow-btn")!.click(); await settle();
    const input = view.container.querySelector<HTMLInputElement>(".ppp-t2-newrow-input")!;
    input.value = "Visit"; input.dispatchEvent(new Event("input", { bubbles: true })); await settle(); enter(input); await settle(); await settle();
    expect(create).toHaveBeenCalledTimes(1); expect(create.mock.calls[0]![0]).toBe("Own/Visit.md");
    const yaml = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(create.mock.calls[0]![1])?.[1];
    expect(yaml).toBeDefined(); expect(parse(yaml!)).toMatchObject({ type: "visit", paid: false, status: "open" });
  } finally { view.unmount(); app.set(previous); }
});
