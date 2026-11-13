/**
 * i2-safety (3.7.2 iteration 2, N33/C1) — creating a property with no value
 * wrote `null` (formula, relation, rollup), `[]` (the relation a new rollup
 * reads through) or `""` (an empty text default) into EVERY note of the
 * project: 193 files at once on the phone, then one full page reload per
 * written file. The comment in CreateField promised the opposite.
 *
 * A property without a value now lives in the base's settings only; the notes
 * are written when someone fills a value in. A real default value still goes
 * to every note, as the form says.
 */
import { get } from "svelte/store";
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import { dataFrame } from "src/lib/stores/dataframe";
import { ViewApi } from "src/lib/viewApi";

const field = (over: Partial<DataField> = {}): DataField => ({
  name: "Сумма оплат",
  type: DataFieldType.String,
  repeated: false,
  derived: false,
  identifier: false,
  ...over,
});

function apiWithSpy() {
  const addField = jest.fn().mockResolvedValue({ written: 2, failed: [], missing: [] });
  const api = new ViewApi({} as never, { addField } as never);
  dataFrame.set({
    fields: [field({ name: "name", identifier: true, derived: true })],
    records: [
      { id: "a.md", values: { name: "a" } },
      { id: "b.md", values: { name: "b" } },
    ],
  });
  return { api, addField };
}

describe("i2-safety — a property without a value is not written into notes", () => {
  it.each([
    ["formula, null", field({ type: DataFieldType.Formula }), null],
    ["relation, null", field({ type: DataFieldType.Relation }), null],
    ["rollup, null", field({ type: DataFieldType.Rollup }), null],
    ["relation of a new rollup, []", field({ type: DataFieldType.Relation, repeated: true }), []],
    ["text with an empty default", field(), ""],
    ["no value at all", field(), undefined],
  ])("%s: no file is touched, the column still appears", async (_label, f, value) => {
    const { api, addField } = apiWithSpy();

    const outcome = await api.addField(f, value as never);

    expect(addField).not.toHaveBeenCalled();
    expect(outcome).toEqual({ written: 0, failed: [], missing: [] });
    expect(get(dataFrame).fields.map((x) => x.name)).toContain("Сумма оплат");
  });

  it("a real default value is still written to every note of the base", async () => {
    const { api, addField } = apiWithSpy();

    await api.addField(field(), "новый");

    expect(addField).toHaveBeenCalledTimes(1);
    expect(addField.mock.calls[0]![0]).toEqual(["a.md", "b.md"]);
  });
});
