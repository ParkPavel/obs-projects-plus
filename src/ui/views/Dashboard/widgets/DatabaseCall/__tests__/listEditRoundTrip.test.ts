import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
const { DataFieldType } = require("src/lib/dataframe/dataframe");
import { FolderDataSource } from "src/lib/datasources/folder/datasource";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import { DataApi } from "src/lib/dataApi";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { updateRecordValues } from "src/lib/datasources/helpers";
import DataTableContent from "../DataTableContent.svelte";
import { cellDisplay } from "../tableCanon";
import { get } from "svelte/store";

// The lightweight shared mock does not parse flow arrays or escape quotes.
jest.mock("yaml", () => jest.requireActual(process.cwd() + "/node_modules/yaml/dist/index.js"));

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? "" }) };
});

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});
const { isMobile } = require("src/lib/stores/ui");

type DataField = import("src/lib/dataframe/dataframe").DataField;
type FieldType = import("src/lib/dataframe/dataframe").DataFieldType;

async function mount(type: FieldType, initial: Array<string | number | null> = ["alpha, beta", "quote \"inside\"", "plain"]) {
  const body = "\nKeep the body.\n";
  const fs = new InMemFileSystem({});
  await fs.create("A.md", `---\ntags: ${JSON.stringify(initial)}\nother: untouched\n---${body}`);
  const field: DataField = { name: "tags", type, repeated: type === DataFieldType.String, identifier: false, derived: false };
  const nameField: DataField = { ...field, name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: true };
  const project = { ...DEFAULT_PROJECT, id: "lists", name: "Lists" };
  const source = new FolderDataSource(fs, project, DEFAULT_SETTINGS.preferences);
  const files = fs.getAllFiles();
  const frame = await source.queryFiles(files, [nameField, field]);
  expect(frame.records[0]?.values["tags"]).toEqual(initial);
  const writer = new DataApi(fs);
  const writes: Promise<boolean>[] = [];
  const updateRecord = jest.fn((record, fields) => { writes.push(writer.updateRecord(fields, record)); });
  const view = render(DataTableContent, { props: {
    frame, fields: [nameField, field], api: { updateRecord } as never, readonly: false,
    config: undefined, getRecordColor: () => null, project,
  } });
  await tick();
  const cell = view.container.querySelector<HTMLElement>(".ppp-t2-cell--editable");
  if (!cell) throw new Error(`Missing editable list cell: ${view.container.innerHTML}`);
  cell.click();
  await tick();
  expect(view.container.querySelector(".ppp-t2-cell--editing")).not.toBeNull();
  await tick();
  return { ...view, initial, body, fs, source, files, field, frame, updateRecord, writes };
}

function button(text: string): HTMLButtonElement {
  const el = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === text);
  if (!el) throw new Error(`Missing ${text} button`);
  return el;
}

it.each([DataFieldType.String, DataFieldType.List])("opening and applying %s unchanged does not write a scalar", async type => {
  const { container, updateRecord } = await mount(type);
  const legacy = container.querySelector<HTMLInputElement>("input.ppp-t2-editor");
  if (legacy) legacy.dispatchEvent(new FocusEvent("blur"));
  else button("Apply").click();
  await tick();
  expect(updateRecord).not.toHaveBeenCalled();
});

it.each([DataFieldType.String, DataFieldType.List])("%s item edits round-trip as an array, without splitting punctuation", async type => {
  const { initial, body, files, field, source, writes } = await mount(type);
  const input = document.querySelector<HTMLInputElement>(".ppp-t2-list-editor input");
  if (!input) throw new Error("Missing list item editor");
  input.focus();
  input.value = "new, comma \"quote\"";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  input.dispatchEvent(new FocusEvent("blur"));
  button("Apply").click();
  await tick();
  expect(writes).toHaveLength(1);
  expect(await writes[0]).toBe(true);
  const reloaded = await source.queryFiles(files, [field]);
  expect(reloaded.records[0]?.values["tags"]).toEqual(["new, comma \"quote\"", ...initial.slice(1)]);
  const text = await files[0]?.read();
  expect(text).toContain("other: untouched");
  expect(text?.endsWith(body)).toBe(true);
});

it("cancel does not mutate the source array", async () => {
  const { initial, frame, updateRecord } = await mount(DataFieldType.String);
  button("Remove item 1").click();
  button("Cancel").click();
  await tick();
  expect(frame.records[0]?.values["tags"]).toEqual(initial);
  expect(updateRecord).not.toHaveBeenCalled();
});

it("duplicates and empty items survive a no-op", async () => {
  const { updateRecord } = await mount(DataFieldType.String, ["same", "same", ""]);
  button("Apply").click();
  await tick();
  expect(updateRecord).not.toHaveBeenCalled();
});

it("removing every item writes an empty array, not null or a string", async () => {
  const { files, field, source, writes } = await mount(DataFieldType.List, ["only"]);
  button("Remove item 1").click();
  button("Apply").click();
  await tick();
  expect(writes).toHaveLength(1);
  await writes[0];
  expect((await source.queryFiles(files, [field])).records[0]?.values["tags"]).toEqual([]);
});

it("the writer tracks a list-only patch", () => {
  const patch = updateRecordValues({ id: "A.md", values: { tags: ["old"], other: "keep" } }, { tags: ["new"] });
  expect(patch.values).toEqual({ tags: ["new"], other: "keep" });
});

it.each([{}, { isComposing: true }, { keyCode: 229 }])("IME Escape does not close the list editor (%j)", async flags => {
  const { updateRecord } = await mount(DataFieldType.String);
  const input = document.querySelector<HTMLInputElement>(".ppp-t2-list-editor input");
  if (!input) throw new Error("Missing list editor");
  input.dispatchEvent(new Event("compositionstart", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, ...flags }));
  await tick();
  expect(document.querySelector(".ppp-t2-list-editor input")).not.toBeNull();
  expect(updateRecord).not.toHaveBeenCalled();
  input.dispatchEvent(new Event("compositionend", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await tick();
  expect(document.querySelector(".ppp-t2-list-editor")).toBeNull();
});

it("adds an item to an empty list and focuses its editor", async () => {
  const { files, source, field, writes } = await mount(DataFieldType.List, []);
  button("Add item").click();
  await tick();
  await tick();
  const input = document.querySelector<HTMLInputElement>(".ppp-t2-list-editor input");
  expect(document.activeElement).toBe(input);
  if (!input) throw new Error("Missing new item editor");
  input.value = "001, literal";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  button("Apply").click();
  await tick();
  await writes[0];
  expect((await source.queryFiles(files, [field])).records[0]?.values["tags"]).toEqual(["001, literal"]);
});

it("editing a mixed list does not coerce non-text items", async () => {
  const { files, source, field, writes } = await mount(DataFieldType.List, [5, null, "text"]);
  const input = document.querySelector<HTMLInputElement>(".ppp-t2-list-editor input");
  if (!input) throw new Error("Missing text item editor");
  input.value = "changed";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  button("Apply").click();
  await tick();
  await writes[0];
  expect((await source.queryFiles(files, [field])).records[0]?.values["tags"]).toEqual([5, null, "changed"]);
});

it("a List field displays item chips even without the legacy repeated flag", () => {
  const field: DataField = { name: "items", type: DataFieldType.List, repeated: false, derived: false, identifier: false };
  expect(cellDisplay(field, ["one", "two"])).toMatchObject({ kind: "pills", pills: [{ label: "one" }, { label: "two" }] });
});

it.each(["Apply", "Cancel"])("%s restores keyboard focus to the list cell", async action => {
  const { container } = await mount(DataFieldType.String);
  button(action).click();
  await tick();
  await tick();
  expect(document.activeElement).toBe(container.querySelector(".ppp-t2-cell--editable"));
});

it("portals the mobile sheet out of the containing dashboard tile", async () => {
  const before = get(isMobile);
  isMobile.set(true);
  try {
    const { component } = await mount(DataFieldType.List);
    const backdrop = document.querySelector(".ppp-popup-backdrop");
    expect(backdrop?.parentElement).toBe(document.body);
    expect(document.querySelector(".ppp-popup--bottom-sheet .ppp-t2-list-editor")).not.toBeNull();
    component.$destroy();
    expect(document.querySelector(".ppp-popup-backdrop")).toBeNull();
  } finally {
    isMobile.set(before);
  }
});
