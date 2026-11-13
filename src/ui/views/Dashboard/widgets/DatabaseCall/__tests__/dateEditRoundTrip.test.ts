import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
const { DataFieldType } = require("src/lib/dataframe/dataframe");
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataValue = import("src/lib/dataframe/dataframe").DataValue;
import { FolderDataSource } from "src/lib/datasources/folder/datasource";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import { DataApi } from "src/lib/dataApi";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import TableRow from "../TableRow.svelte";
import DataTableContent from "../DataTableContent.svelte";
import { settings } from "src/lib/stores/settings";
import { get } from "svelte/store";
import { cellDraftText, parseCellDraft } from "../typedCellDraft";
import { parseStoredDate, dateAsText } from "src/lib/helpers/dateShape";

type DateFormatConfig = import("src/settings/v3/settings").DateFormatConfig;

jest.mock("yaml", () => jest.requireActual(process.cwd() + "/node_modules/yaml/dist/index.js"));

const field: DataField = {
  name: "since", type: DataFieldType.Date, identifier: false,
  derived: false, repeated: false, typeConfig: {},
};

// Exercise the real ingestion and persistence boundaries, not a raw-string
// editor fixture: the datasource hands the row a Date, not the YAML spelling.
it.each<[string, string, string, DateFormatConfig]>([
  ["15.01.2024", "2024-03-05", "05.03.2024", { writeFormat: "DD.MM.YYYY" }],
  ["10/04/2026", "2026-04-11", "11/04/2026", { writeFormat: "DD/MM/YYYY", preset: "uk" }],
  ["04/10/2026", "2026-04-11", "04/11/2026", { writeFormat: "MM/DD/YYYY", preset: "us" }],
  ["2024年01月15日", "2024-03-05", "2024年03月05日", { writeFormat: "YYYY年MM月DD日" }],
  ["5.1.2024 09:30:15", "2024-03-05", "5.3.2024 09:30:15", { writeFormat: "DD.MM.YYYY" }],
])("read → edit → write → reload keeps the spelling of %s", async (raw, next, expected, dateFormat) => {
  const body = "\nBody stays unchanged.\n";
  const fs = new InMemFileSystem({});
  await fs.create("A.md", `---\nsince: "${raw}"\nother: untouched\n---${body}`);
  const project = { ...DEFAULT_PROJECT, id: "dates", name: "Dates", dateFormat };
  const source = new FolderDataSource(fs, project, DEFAULT_SETTINGS.preferences);
  const files = fs.getAllFiles();
  const frame = await source.queryFiles(files, [field]);
  const record = frame.records[0];
  if (!record) throw new Error("missing ingested record");
  expect(record.values["since"]).toBeInstanceOf(Date);
  const { container, component } = render(TableRow, {
    props: {
      columns: [{ field, widthRem: 10, isPrimary: false }],
      record, frame, api: {} as never, readonly: false, editingField: "since", dateFormat,
    },
  });
  let committed: DataValue | null | undefined;
  component.$on("commitEdit", (e: CustomEvent<{ value: DataValue | null | undefined }>) => { committed = e.detail.value; });
  await tick();
  const input = container.querySelector<HTMLInputElement>("input.ppp-t2-editor--date");
  if (!input) throw new Error("missing date editor");
  // Both slash formats must show April 10, never October 4.
  expect(input.value).toBe(raw.includes("2026") ? "10.04.2026" : raw.startsWith("5.") ? "05.01.2024" : "15.01.2024");
  input.value = next;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  expect(committed).toBe(expected);
  const writer = new DataApi(fs);
  expect(await writer.updateRecord(frame.fields, { ...record, values: { ...record.values, since: committed } }, ["since"])).toBe(true);
  const content = await files[0]?.read();
  expect(content).toContain("other: untouched");
  expect(content?.endsWith(body)).toBe(true);
  const reloaded = await source.queryFiles(files, [field]);
  const date = reloaded.records[0]?.values["since"];
  expect(date).toBeInstanceOf(Date);
  expect((date as Date).getFullYear()).toBe(Number(next.slice(0, 4)));
  expect((date as Date).getMonth() + 1).toBe(Number(next.slice(5, 7)));
  expect((date as Date).getDate()).toBe(Number(next.slice(8, 10)));
});

it.each([false, true])("a new table date uses the actual source project's format (linked=%s)", async linked => {
  const originalSettings = get(settings);
  const host = { ...DEFAULT_PROJECT, id: "host", name: "Host", dateFormat: { writeFormat: "DD.MM.YYYY" } };
  const source = { ...DEFAULT_PROJECT, id: "source", name: "Source", dateFormat: { writeFormat: "DD/MM/YYYY" } };
  settings.set({ ...originalSettings, projects: [host, source] });
  try {
    const nameField = { ...field, name: "name", type: DataFieldType.String, identifier: true };
    const frame = { fields: [nameField, field], records: [{ id: "A.md", values: { name: "A", since: null } }] };
    const updateRecord = jest.fn();
    const { container } = render(DataTableContent, {
      props: {
        frame, fields: frame.fields, api: { updateRecord } as never,
        readonly: false, config: undefined, getRecordColor: () => null,
        project: host, sourceProjectId: linked ? source.id : undefined,
      },
    });
    await tick();
    const cell = container.querySelectorAll<HTMLElement>(".ppp-t2-row [role=gridcell]")[1];
    if (!cell) throw new Error("Missing editable date cell");
    cell.click();
    await tick();
    const input = container.querySelector<HTMLInputElement>("input.ppp-t2-editor--date");
    if (!input) throw new Error("Missing editor in actual table");
    input.value = "2026-04-11";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(updateRecord).toHaveBeenCalledWith(expect.objectContaining({
      values: { name: "A", since: linked ? "11/04/2026" : "11.04.2026" },
    }), frame.fields);
  } finally {
    settings.set(originalSettings);
  }
});

it.each<[string, string, string, DateFormatConfig | undefined]>([
  ["2026-11-05T15:45", "07.11.2026 09:30", "2026-11-07T09:30", undefined],
  ["2026-11-05T15:45", "07.11.2026 00:00", "2026-11-07T00:00", undefined],
  ["05/11/2026 15:45", "07.11.2026 09:30", "07/11/2026 09:30", { writeFormat: "DD/MM/YYYY" }],
])("datetime read → original input → writer → reload changes the explicit clock of %s", async (raw, draft, expected, dateFormat) => {
  const fs = new InMemFileSystem({}); await fs.create("A.md", `---\nsince: "${raw}"\nother: untouched\n---\nKeep body`);
  const datetime = { ...field, typeConfig: { time: true } };
  const source = new FolderDataSource(fs, { ...DEFAULT_PROJECT, id: "datetime", name: "Datetime", ...(dateFormat ? { dateFormat } : {}) }, DEFAULT_SETTINGS.preferences);
  const frame = await source.queryFiles(fs.getAllFiles(), [datetime]), record = frame.records[0]!;
  const view = render(TableRow, { props: { columns: [{ field: datetime, widthRem: 15, isPrimary: false }], record,
    frame, api: {} as never, readonly: false, editingField: "since", dateFormat } });
  let committed: DataValue | null | undefined;
  view.component.$on("commitEdit", (e: CustomEvent<{ value: DataValue | null | undefined }>) => { committed = e.detail.value; });
  await tick();
  const input = view.container.querySelector<HTMLInputElement>("input.ppp-t2-editor--date")!;
  expect(input.value).toBe("05.11.2026 15:45");
  input.value = draft; input.dispatchEvent(new Event("input", { bubbles: true })); await tick();
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  expect(committed).toBe(expected);
  await new DataApi(fs).updateRecord(frame.fields, { ...record, values: { ...record.values, since: committed } }, ["since"]);
  expect((await fs.getFile("A.md")!.readValues())["since"]).toBe(expected);
  expect(await fs.getFile("A.md")!.read()).toContain("Keep body");
  const reloaded = (await source.queryFiles(fs.getAllFiles(), [datetime])).records[0]?.values["since"] as Date;
  expect(reloaded.getHours()).toBe(draft.includes("00:00") ? 0 : 9); expect(reloaded.getMinutes()).toBe(draft.includes("00:00") ? 0 : 30);
});

it("an unchanged datetime preserves its offset and seconds; a typed day keeps the original clock", () => {
  const datetime = { ...field, typeConfig: { time: true } }, raw = "2026-11-05T15:45:27+03:00";
  const stored = parseStoredDate(raw)!;
  expect(stored).toBeInstanceOf(Date);
  const unchanged = parseCellDraft(datetime, stored, cellDraftText(datetime, stored));
  expect(unchanged).toEqual({ ok: true, value: stored });
  if (unchanged.ok) expect(unchanged.value).toBe(stored);
  expect(dateAsText(stored)).toBe(raw);
  expect(parseCellDraft(datetime, stored, "07.11.2026")).toEqual({ ok: true, value: "2026-11-07T15:45:27+03:00" });
  expect(parseCellDraft(datetime, stored, "07.11.2026 25:61")).toEqual({ ok: false });
  expect(parseCellDraft(datetime, stored, "")).toEqual({ ok: true, value: null });
});
