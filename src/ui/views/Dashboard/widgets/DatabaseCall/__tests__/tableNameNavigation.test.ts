import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import TableRow from "../TableRow.svelte";

type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;

const field: DataField = { name: "name", type: DataFieldType.String, identifier: true, repeated: false, derived: false, typeConfig: {} };
const record: DataRecord = { id: "Projects/Alpha.md", values: { name: "Alpha" } };

it.each([
  { readonly: false, altKey: false },
  { readonly: false, altKey: true },
  { readonly: true, altKey: false },
])("the record name opens the note and preserves modifiers (%j)", async ({ readonly, altKey }) => {
  const { container, component } = render(TableRow, { props: {
    columns: [{ field, widthRem: 17, isPrimary: true }], record, readonly, api: {} as never,
    frame: { fields: [field], records: [record] },
  } });
  const open = jest.fn();
  component.$on("openRecord", open);
  await tick();
  const name = container.querySelector<HTMLElement>(".ppp-t2-name");
  if (!name) throw new Error("record name not rendered");
  name.dispatchEvent(new MouseEvent("click", { bubbles: true, altKey }));
  expect(open).toHaveBeenCalledTimes(1);
  const detail = open.mock.calls[0]?.[0].detail as { record: DataRecord; event: MouseEvent };
  expect(detail.record).toBe(record);
  expect(detail.event.altKey).toBe(altKey);
  // A real button keeps keyboard activation native; no bespoke Enter handler.
  expect(name.tagName).toBe("BUTTON");
  expect(name).toHaveAttribute("type", "button");
});
