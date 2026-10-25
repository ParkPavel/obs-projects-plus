/**
 * w4-p01 (audit F05, F06) — a value read from a note is not lost on the way in.
 *
 * F05: Dataview's `standardizeValues` dropped every falsy value, so a zero
 * balance, an unticked checkbox and an empty text vanished before any filter,
 * aggregate or view saw them (probe: `{paid: 0, done: false}` gave nothing).
 * F06: a Date in a field read as String kept only its day (`14:35:27` lost).
 *
 * Expectations use LOCAL components, so they hold in any process timezone.
 */
import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import { standardizeValues } from "../dataview/standardize";
import { parseRecords } from "../helpers";
import { parseStoredDate } from "src/lib/helpers/dateShape";
import { detectSchema } from "../dataview/schema";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import { aggregate } from "src/lib/engine/aggregate";

/** A Luxon DateTime as Dataview hands it over: only `ts` matters here. */
const luxon = (date: Date) => ({ ts: date.getTime() });

describe("standardizeValues — Dataview values keep what they are", () => {
  it("keeps 0, false and an empty string (old code: all three dropped)", () => {
    expect(standardizeValues({ paid: 0, done: false, note: "", n: 1 })).toEqual({
      paid: 0,
      done: false,
      note: "",
      n: 1,
    });
  });

  it("keeps an empty property as null and drops only an absent one", () => {
    const res = standardizeValues({ empty: null, absent: undefined });
    expect(res).toHaveProperty("empty", null);
    expect(res).not.toHaveProperty("absent");
  });

  it("keeps zeros and false inside a list", () => {
    expect(standardizeValues({ marks: [0, false, ""] })).toEqual({ marks: [0, false, ""] });
  });

  it("keeps the seconds of a date and time (old code: minutes only)", () => {
    const res = standardizeValues({ at: luxon(new Date(2026, 9, 24, 14, 35, 27)) });
    expect(res["at"]).toBe("2026-10-24T14:35:27");
  });

  it("writes a date and time without seconds as hours and minutes", () => {
    const res = standardizeValues({ at: luxon(new Date(2026, 9, 24, 9, 5)) });
    expect(res["at"]).toBe("2026-10-24T09:05");
  });

  it("writes a midnight value as its day", () => {
    const res = standardizeValues({ on: luxon(new Date(2026, 9, 24)) });
    expect(res["on"]).toBe("2026-10-24");
  });
});

describe("a Dataview zero and false reach the filter and the total", () => {
  const rows: Record<string, unknown>[] = [
    { paid: 0, done: false },
    { paid: 1500, done: true },
  ];

  function frame() {
    const records = rows.map((row, i) => ({ id: `${i}.md`, values: standardizeValues(row) })) as DataRecord[];
    const fields = detectSchema(records);
    return { fields, records: parseRecords(records, fields) };
  }

  it("types both fields from their values, zero and false included", () => {
    const types = Object.fromEntries(frame().fields.map((f) => [f.name, f.type]));
    expect(types).toEqual({ paid: DataFieldType.Number, done: DataFieldType.Boolean });
  });

  it("keeps the zero row under 'is not empty' (old code: filtered out)", () => {
    const kept = applyFilter(frame(), {
      conjunction: "and",
      conditions: [{ field: "paid", operator: "is-not-empty", enabled: true }],
    });
    expect(kept.records.map((r) => r.id)).toEqual(["0.md", "1.md"]);
  });

  it("counts the zero and the false as values", () => {
    const records = frame().records;
    const cfg = { relationField: "", targetField: "", function: "count_values" as const };
    expect(aggregate(records.map((r) => r.values["paid"]), cfg).value).toBe(2);
    expect(aggregate(records.map((r) => r.values["done"]), cfg).value).toBe(2);
  });
});

describe("parseRecords — a Date read as a String field keeps its time", () => {
  const textField: DataField = {
    name: "at",
    type: DataFieldType.String,
    identifier: false,
    derived: false,
    repeated: false,
    typeConfig: {},
  };

  function asText(value: unknown): unknown {
    const records = [{ id: "A.md", values: { at: value } }] as DataRecord[];
    return parseRecords(records, [textField])[0]?.values["at"];
  }

  it("keeps hours, minutes and seconds (old code: 2026-10-24)", () => {
    expect(asText(new Date(2026, 9, 24, 14, 35, 27))).toBe("2026-10-24T14:35:27");
  });

  it("keeps a midnight value as its day", () => {
    expect(asText(new Date(2026, 9, 24))).toBe("2026-10-24");
  });

  it("keeps the spelling a date was stored in", () => {
    const stored = parseStoredDate("24.10.2026T14:35", "DD.MM.YYYY");
    expect(stored).toBeInstanceOf(Date);
    expect(asText(stored)).toBe("24.10.2026T14:35");
  });

  it("does not shift the day of a late-evening time", () => {
    expect(asText(new Date(2026, 9, 24, 23, 59))).toBe("2026-10-24T23:59");
  });
});
