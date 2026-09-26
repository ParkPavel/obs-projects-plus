/**
 * peekResolution.test.ts — F1 (#158 L2/L3): the peek is resolved by identity,
 * not carried as a copy. Fails on main because `peekResolution.ts` does not
 * exist yet.
 */

import { resolvePeek } from "../peekResolution";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";

function frame(records: DataFrame["records"], fields: DataFrame["fields"] = []): DataFrame {
  return { records, fields };
}

const numberField = {
  name: "x",
  type: DataFieldType.Number,
  repeated: false,
  identifier: false,
  derived: false,
};

const stringField = {
  name: "y",
  type: DataFieldType.String,
  repeated: false,
  identifier: false,
  derived: false,
};

describe("resolvePeek — own record", () => {
  it("resolves from the frame passed in now, so updated values show", () => {
    const own = frame([{ id: "a.md", values: { x: 2 } }], [numberField]);
    const result = resolvePeek(
      { id: "a.md" },
      { viewReadonly: false, ownFrame: own, dataSourceIncludes: () => true }
    );
    expect(result).toEqual({
      kind: "ready",
      record: own.records[0],
      fields: own.fields,
      writable: true,
    });
  });

  it("is absent when the id is not in the own frame", () => {
    const result = resolvePeek(
      { id: "missing.md" },
      { viewReadonly: false, ownFrame: frame([]), dataSourceIncludes: () => true }
    );
    expect(result).toEqual({ kind: "absent" });
  });

  it("writable: false when the own id is not something dataSource includes", () => {
    const own = frame([{ id: "a.md", values: {} }]);
    const result = resolvePeek(
      { id: "a.md" },
      { viewReadonly: false, ownFrame: own, dataSourceIncludes: () => false }
    );
    expect(result).toEqual({
      kind: "ready",
      record: own.records[0],
      fields: own.fields,
      writable: false,
    });
  });

  it("writable: false when the hosting view is read-only", () => {
    const own = frame([{ id: "a.md", values: {} }]);
    const result = resolvePeek(
      { id: "a.md" },
      { viewReadonly: true, ownFrame: own, dataSourceIncludes: () => true }
    );
    expect(result).toEqual({
      kind: "ready",
      record: own.records[0],
      fields: own.fields,
      writable: false,
    });
  });

  it("writable: false when the target itself was opened as read-only", () => {
    const own = frame([{ id: "a.md", values: {} }]);
    const result = resolvePeek(
      { id: "a.md", readonly: true },
      { viewReadonly: false, ownFrame: own, dataSourceIncludes: () => true }
    );
    expect(result).toEqual({
      kind: "ready",
      record: own.records[0],
      fields: own.fields,
      writable: false,
    });
  });
});

describe("resolvePeek — external record", () => {
  it("is loading when the external frame has not resolved yet", () => {
    const result = resolvePeek(
      { id: "b.md", projectId: "P" },
      {
        viewReadonly: false,
        ownFrame: frame([]),
        dataSourceIncludes: () => true,
        externalFrame: undefined,
      }
    );
    expect(result).toEqual({ kind: "loading" });
  });

  it("is absent when the resolved external frame has no such id", () => {
    const ext = frame([{ id: "other.md", values: {} }]);
    const result = resolvePeek(
      { id: "b.md", projectId: "P" },
      {
        viewReadonly: false,
        ownFrame: frame([]),
        dataSourceIncludes: () => true,
        externalFrame: ext,
      }
    );
    expect(result).toEqual({ kind: "absent" });
  });

  it("is absent when the resolver could not produce a frame at all", () => {
    const result = resolvePeek(
      { id: "b.md", projectId: "P" },
      {
        viewReadonly: false,
        ownFrame: frame([]),
        dataSourceIncludes: () => true,
        externalFrame: null,
      }
    );
    expect(result).toEqual({ kind: "absent" });
  });

  it("is ready with the external frame's own fields, and always writable: false — even without target.readonly", () => {
    const ext = frame([{ id: "b.md", values: { y: "hi" } }], [stringField]);
    const result = resolvePeek(
      { id: "b.md", projectId: "P" },
      {
        viewReadonly: false,
        ownFrame: frame([]),
        dataSourceIncludes: () => true,
        externalFrame: ext,
      }
    );
    expect(result).toEqual({
      kind: "ready",
      record: ext.records[0],
      fields: ext.fields,
      writable: false,
    });
  });
});
