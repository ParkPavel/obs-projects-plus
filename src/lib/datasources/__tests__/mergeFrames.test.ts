import { mergeDataFrames } from "../mergeFrames";
import type { DataFrame, DataField, DataRecord, DataValue, Optional } from "../../dataframe/dataframe";
import { DataFieldType } from "../../dataframe/dataframe";

function makeField(name: string, type = DataFieldType.String): DataField {
  return { name, type, repeated: false, identifier: false, derived: false };
}

function makeRecord(id: string, values: Record<string, Optional<DataValue>> = {}): DataRecord {
  return { id, values };
}

function makeFrame(fields: DataField[], records: DataRecord[]): DataFrame {
  return { fields, records };
}

describe("mergeDataFrames", () => {
  it("returns empty frame for empty input", () => {
    const result = mergeDataFrames([]);
    expect(result.fields).toEqual([]);
    expect(result.records).toEqual([]);
  });

  it("returns the single frame unchanged", () => {
    const frame = makeFrame(
      [makeField("name")],
      [makeRecord("a", { name: "Alice" })]
    );
    const result = mergeDataFrames([frame]);
    expect(result).toBe(frame);
  });

  it("unions fields by name, first occurrence wins type", () => {
    const f1 = makeFrame(
      [makeField("name", DataFieldType.String), makeField("age", DataFieldType.Number)],
      []
    );
    const f2 = makeFrame(
      [makeField("age", DataFieldType.String), makeField("email", DataFieldType.String)],
      []
    );
    const result = mergeDataFrames([f1, f2]);
    expect(result.fields).toHaveLength(3);
    expect(result.fields.map(f => f.name)).toEqual(["name", "age", "email"]);
    // age type should be Number (from f1, first occurrence)
    expect(result.fields[1]!.type).toBe(DataFieldType.Number);
  });

  it("concatenates records from multiple frames", () => {
    const f1 = makeFrame([], [makeRecord("a"), makeRecord("b")]);
    const f2 = makeFrame([], [makeRecord("c"), makeRecord("d")]);
    const result = mergeDataFrames([f1, f2]);
    expect(result.records).toHaveLength(4);
    expect(result.records.map(r => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("deduplicates records by id, first occurrence wins", () => {
    const f1 = makeFrame([], [makeRecord("a", { x: 1 })]);
    const f2 = makeFrame([], [makeRecord("a", { x: 2 }), makeRecord("b")]);
    const result = mergeDataFrames([f1, f2]);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]!.values).toEqual({ x: 1 });
  });

  it("merges three frames correctly", () => {
    const f1 = makeFrame([makeField("a")], [makeRecord("1")]);
    const f2 = makeFrame([makeField("b")], [makeRecord("2")]);
    const f3 = makeFrame([makeField("c")], [makeRecord("3"), makeRecord("1")]);
    const result = mergeDataFrames([f1, f2, f3]);
    expect(result.fields).toHaveLength(3);
    expect(result.records).toHaveLength(3); // "1" deduplicated
  });

  it("handles frames with no fields", () => {
    const f1 = makeFrame([], [makeRecord("a")]);
    const f2 = makeFrame([], [makeRecord("b")]);
    const result = mergeDataFrames([f1, f2]);
    expect(result.fields).toHaveLength(0);
    expect(result.records).toHaveLength(2);
  });

  it("handles frames with no records", () => {
    const f1 = makeFrame([makeField("x")], []);
    const f2 = makeFrame([makeField("y")], []);
    const result = mergeDataFrames([f1, f2]);
    expect(result.fields).toHaveLength(2);
    expect(result.records).toHaveLength(0);
  });
});
