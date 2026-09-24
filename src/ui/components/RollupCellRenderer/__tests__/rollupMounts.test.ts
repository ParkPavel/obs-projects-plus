/**
 * d13 step 3 — rollup values are shown by RollupCellRenderer (#045.4) where
 * users meet them: the dashboard table cell and the board/gallery card
 * metadata. Both printed the raw value as text, so a percent rollup was a bare
 * number and a "show" rollup a comma-joined string.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { DataFieldType, type DataField, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
import EditableCell from "src/ui/views/Dashboard/widgets/DatabaseCall/EditableCell.svelte";
import CardMetadata from "src/ui/components/CardMetadata/CardMetadata.svelte";

function rollupField(fn: string, mode?: string): DataField {
  return {
    name: "progress",
    type: DataFieldType.Rollup,
    repeated: false,
    identifier: false,
    derived: true,
    typeConfig: { rollup: { relationField: "tasks", targetField: "done", function: fn, ...(mode ? { mode } : {}) } },
  } as unknown as DataField;
}

function cell(field: DataField, value: Optional<DataValue>) {
  return render(EditableCell, {
    props: { field, value, readonly: false, editing: false, api: {} as never, frame: { fields: [field], records: [] } },
  }).container;
}

function card(field: DataField, value: Optional<DataValue>) {
  return render(CardMetadata, {
    props: { fields: [field], record: { id: "r.md", values: { [field.name]: value } } },
  }).container;
}

describe("rollup values in the dashboard table", () => {
  test("a percent rollup is a progress bar", () => {
    const c = cell(rollupField("percent_true"), 42);
    expect(c.querySelector("[data-rollup-group='percent']")).not.toBeNull();
    expect(c.querySelector("[data-testid='ppp-rollup-bar']")?.getAttribute("style")).toContain("width: 42%");
  });

  test("a show rollup is a strip of chips", () => {
    const c = cell(rollupField("show_original", "show_original"), "Alpha, Beta");
    expect(c.querySelector("[data-rollup-group='show']")).not.toBeNull();
    expect(c.querySelectorAll(".ppp-rollup-chip").length).toBe(2);
  });

  test("a rollup cell stays read-only", () => {
    const c = cell(rollupField("sum"), 7);
    expect(c.querySelector("input.ppp-t2-editor")).toBeNull();
    expect(c.querySelector("[data-rollup-group]")).not.toBeNull();
  });
});

// In the product a rollup column keeps the type detected from its values (a
// sum is a Number) and is recognised by its typeConfig.rollup, merged from the
// project's fieldConfig, and by being derived (applyRollupColumns).
function productRollupField(fn: string, type: DataFieldType): DataField {
  return { ...rollupField(fn), type } as DataField;
}

describe("rollup columns as the product builds them", () => {
  test("a numeric rollup column is rendered by the renderer and stays read-only", () => {
    const c = cell(productRollupField("sum", DataFieldType.Number), 14000);
    expect(c.querySelector("[data-rollup-group]")).not.toBeNull();
    expect(c.querySelector(".ppp-t2-cell--editable")).toBeNull();
  });

  test("a percent rollup column typed Number is still a progress bar", () => {
    const c = cell(productRollupField("percent_not_empty", DataFieldType.Number), 100);
    expect(c.querySelector("[data-testid='ppp-rollup-bar']")).not.toBeNull();
  });

  test("on a card too", () => {
    const c = card(productRollupField("show_original", DataFieldType.String), "planning");
    expect(c.querySelector("[data-rollup-group]")).not.toBeNull();
  });
});

describe("rollup values on board and gallery cards", () => {
  test("a percent rollup is a progress bar", () => {
    const c = card(rollupField("percent_true"), 42);
    expect(c.querySelector("[data-rollup-group='percent']")).not.toBeNull();
  });

  test("a formula keeps its own rendering", () => {
    const formula = { name: "f", type: DataFieldType.Formula, repeated: false, identifier: false, derived: true } as DataField;
    const c = card(formula, 3);
    expect(c.querySelector("[data-rollup-group]")).toBeNull();
  });
});
