/**
 * stab-dateread (3.7.1) — ingestion reads a Date field in the order it is
 * written. Live: a note with `since: 10.04.2026` was shown as 2026-10-04.
 *
 * Expectations use LOCAL components, so they hold in any process timezone.
 */
import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import { parseRecords } from "../helpers";

const dateField: DataField = {
  name: "since",
  type: DataFieldType.Date,
  identifier: false,
  derived: false,
  repeated: false,
  typeConfig: {},
};

function read(value: unknown): unknown {
  const records = [{ id: "A.md", values: { since: value } }] as DataRecord[];
  return parseRecords(records, [dateField])[0]?.values["since"];
}

describe("parseRecords — a Date field", () => {
  it("reads 10.04.2026 as the 10th of April (old code: the 4th of October)", () => {
    expect(read("10.04.2026")).toEqual(new Date(2026, 3, 10));
  });

  it("reads 1.2.2026 as the 1st of February (old code: the 2nd of January)", () => {
    expect(read("1.2.2026")).toEqual(new Date(2026, 1, 1));
  });

  it("reads 04/10/2026 month first and 13/04/2026 day first", () => {
    expect(read("04/10/2026")).toEqual(new Date(2026, 3, 10));
    // old code: Invalid Date
    expect(read("13/04/2026")).toEqual(new Date(2026, 3, 13));
  });

  it("applies the time tail of a written-order date (old code: the wrong day)", () => {
    expect(read("10.04.2026 09:30")).toEqual(new Date(2026, 3, 10, 9, 30));
  });

  it("does not change ISO, with or without a time", () => {
    expect(read("2026-04-10")).toEqual(new Date(2026, 3, 10));
    expect(read("2026-04-10T10:30")).toEqual(new Date(2026, 3, 10, 10, 30));
    expect(read("2026-04-10T10:30:00Z")).toEqual(new Date("2026-04-10T10:30:00Z"));
  });

  it("does not roll 2024-02-30 over: the text stays (old code: the 1st of March)", () => {
    expect(read("2024-02-30")).toBe("2024-02-30");
  });

  it("falls back to dayjs for a spelling it does not know", () => {
    expect(read("April 10, 2026")).toEqual(new Date("April 10, 2026"));
  });

  it("keeps a Date from the YAML parser", () => {
    const d = new Date(2026, 3, 10);
    expect(read(d)).toBe(d);
  });
});
