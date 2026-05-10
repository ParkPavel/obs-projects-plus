// NPLAN-C1 — getColumns semantic group mode tests

import { describe, expect, test } from "@jest/globals";
import { getColumns } from "./board";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";

function makeRecord(id: string, status: string | null): DataRecord {
  return { id, values: { status: status ?? undefined } };
}

function makeStatusField(statusGroups: {
  todo?: string[];
  inProgress?: string[];
  complete?: string[];
}): DataField {
  return {
    name: "status",
    type: DataFieldType.Status,
    repeated: false,
    identifier: false,
    derived: false,
    typeConfig: {
      options: [
        ...(statusGroups.todo ?? []),
        ...(statusGroups.inProgress ?? []),
        ...(statusGroups.complete ?? []),
      ],
      statusGroups,
    },
  };
}

describe("getColumns — semantic group mode (NPLAN-C1)", () => {
  const groups = {
    todo: ["Backlog", "Todo"],
    inProgress: ["In Progress", "Blocked"],
    complete: ["Done", "Cancelled"],
  };
  const field = makeStatusField(groups);
  const records: DataRecord[] = [
    makeRecord("r1", "Todo"),
    makeRecord("r2", "In Progress"),
    makeRecord("r3", "Done"),
    makeRecord("r4", "Blocked"),
    makeRecord("r5", "Backlog"),
    makeRecord("r6", null),
    makeRecord("r7", "Unknown"),
  ];

  test("produces exactly 4 semantic columns (todo, inProgress, complete, none)", () => {
    const cols = getColumns(records, {}, field, undefined, false, [], true);
    const ids = cols.map((c) => c.id);
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe("To Do");
    expect(ids[1]).toBe("In Progress");
    expect(ids[2]).toBe("Done");
    // No Status column last (key from i18n mock returns "views.board.no-status")
    expect(ids[3]).toBe("views.board.no-status");
  });

  test("routes records to correct semantic buckets", () => {
    const cols = getColumns(records, {}, field, undefined, false, [], true);
    const byId = Object.fromEntries(cols.map((c) => [c.id, c.records]));

    // Todo bucket: Todo + Backlog
    expect(byId["To Do"]?.map((r) => r.id).sort()).toEqual(["r1", "r5"].sort());
    // InProgress bucket: In Progress + Blocked
    expect(byId["In Progress"]?.map((r) => r.id).sort()).toEqual(["r2", "r4"].sort());
    // Complete bucket: Done
    expect(byId["Done"]?.map((r) => r.id).sort()).toEqual(["r3"]);
    // None bucket: null + unknown value
    expect(byId["views.board.no-status"]?.map((r) => r.id).sort()).toEqual(["r6", "r7"].sort());
  });

  test("semantic columns are marked pinned:true", () => {
    const cols = getColumns(records, {}, field, undefined, false, [], true);
    expect(cols.every((c) => c.pinned)).toBe(true);
  });

  test("none column absent when all records have known group", () => {
    const clean: DataRecord[] = [
      makeRecord("a", "Todo"),
      makeRecord("b", "Done"),
    ];
    const cols = getColumns(clean, {}, field, undefined, false, [], true);
    const ids = cols.map((c) => c.id);
    expect(ids).not.toContain("views.board.no-status");
  });

  test("falls back to value-mode when semanticGroupMode=false", () => {
    const cols = getColumns(records, {}, field, undefined, false, [], false);
    // value mode: each distinct value is its own column
    const ids = cols.map((c) => c.id);
    expect(ids).toContain("Blocked");
    expect(ids).toContain("Backlog");
    expect(ids).toContain("Todo");
    // more columns than the 3+1 produced by semantic mode
    expect(ids.length).toBeGreaterThan(4);
  });

  test("falls back to value-mode when statusGroups not set on field", () => {
    const noGroupsField: DataField = {
      name: "status",
      type: DataFieldType.Status,
      repeated: false,
      identifier: false,
      derived: false,
    };
    const cols = getColumns(records, {}, noGroupsField, undefined, false, [], true);
    const ids = cols.map((c) => c.id);
    // no semantic grouping → individual values appear as separate columns
    expect(ids).toContain("Blocked");
    expect(ids).toContain("Backlog");
  });

  test("todo/inProgress columns always present even when empty", () => {
    const onlyDone: DataRecord[] = [makeRecord("x", "Done")];
    const cols = getColumns(onlyDone, {}, field, undefined, false, [], true);
    const ids = cols.map((c) => c.id);
    expect(ids).toContain("To Do");
    expect(ids).toContain("In Progress");
    expect(ids).toContain("Done");
    expect(ids).not.toContain("views.board.no-status");
  });
});
