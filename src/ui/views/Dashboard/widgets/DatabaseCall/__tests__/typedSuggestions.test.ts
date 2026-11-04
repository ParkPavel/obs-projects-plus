import "@testing-library/jest-dom";
import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { optionPools } from "../tableHeaderOps";
import { parseRecords } from "src/lib/datasources/helpers";
const EditableCell = require("../EditableCell.svelte").default;
afterEach(cleanup);
const field = (type: DataFieldType) => ({ name: "value", type, repeated: false, identifier: false, derived: false });

test("a real parsed local Date suggestion keeps its written day when picked into another cell", async () => {
  const schema = field(DataFieldType.Date);
  const records = parseRecords([{ id: "a.md", values: { value: "2026-11-04" } }], [schema]);
  const options = optionPools([schema], records).get("value") ?? [];
  expect(options).toEqual(["2026-11-04"]);
  const m = render(EditableCell, { props: { field: schema, value: "", readonly: false, editing: true, options, api: {}, frame: { fields: [schema], records } } });
  const commits: unknown[] = []; m.component.$on("commit", (e: CustomEvent<unknown>) => commits.push(e.detail));
  await tick(); await tick(); await tick();
  const row = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(option => option.textContent === "04.11.2026");
  expect(row).toBeDefined(); row!.click(); await tick();
  expect(commits).toEqual(["2026-11-04"]);
});

test.each([DataFieldType.Number, DataFieldType.Date])("the actual %s cell opens suggestions in the original field and commits its typed value", async type => {
  const schema = field(type), value = type === DataFieldType.Number ? 5 : "2026-11-04";
  const next = type === DataFieldType.Number ? 12 : "2026-11-05";
  const records = [{ id: "a.md", values: { value } }, { id: "b.md", values: { value: next } }];
  const pool = optionPools([schema], records).get("value") ?? [];
  expect(pool).toHaveLength(2);
  const m = render(EditableCell, { props: { field: schema, value, readonly: false, editing: true, options: pool, api: {}, frame: { fields: [schema], records } } });
  const commits: unknown[] = []; m.component.$on("commit", (e: CustomEvent<unknown>) => commits.push(e.detail));
  await tick(); await tick(); await tick();
  const input = m.container.querySelector("input")!;
  expect(input).toHaveAttribute("role", "combobox");
  const labels = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
  expect(labels.length).toBeGreaterThan(0);
  const chosen = labels.find(row => row.textContent === (type === DataFieldType.Number ? "12" : "05.11.2026"));
  expect(chosen).toBeDefined(); chosen!.click(); await tick(); input.blur();
  expect(commits).toEqual([next]); expect(m.container.querySelector("input")).toBe(input);
});
