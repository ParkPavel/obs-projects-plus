import "@testing-library/jest-dom";
import { render, cleanup, fireEvent } from "@testing-library/svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
const EditableCell = require("../EditableCell.svelte").default;
afterEach(cleanup);

test.each([DataFieldType.AutoTime, DataFieldType.UniqueId, DataFieldType.Unknown])("%s cannot be manually edited even if a stale schema omitted derived", async type => {
  const field = { name: "value", type, repeated: false, identifier: false, derived: false };
  const view = render(EditableCell, { props: { field, value: "T-7", readonly: false, editing: false, api: {}, frame: { fields: [field], records: [] } } });
  const start = jest.fn(), commit = jest.fn(); view.component.$on("startEdit", start); view.component.$on("commit", commit);
  const cell = view.container.querySelector<HTMLElement>('[role="gridcell"]')!;
  expect(cell).toHaveAttribute("aria-readonly", "true"); await fireEvent.click(cell);
  expect(start).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
  view.component.$set({ editing: true });
  await fireEvent.keyDown(cell, { key: "Enter" });
  expect(view.container.querySelector('input:not([disabled]),textarea')).toBeNull(); expect(commit).not.toHaveBeenCalled();
});
