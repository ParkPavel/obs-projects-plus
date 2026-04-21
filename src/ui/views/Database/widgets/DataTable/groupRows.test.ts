// src/ui/views/Database/widgets/DataTable/groupRows.test.ts

import { groupRecords } from "./groupRows";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { GroupConfig } from "../../types";

const records: DataRecord[] = [
  { id: "1", values: { status: "active", priority: 5 } },
  { id: "2", values: { status: "done", priority: 3 } },
  { id: "3", values: { status: "active", priority: 8 } },
  { id: "4", values: { status: "done", priority: 1 } },
  { id: "5", values: { status: null, priority: 2 } },
];

function makeConfig(overrides: Partial<GroupConfig> = {}): GroupConfig {
  return {
    field: "status",
    sortOrder: "asc",
    hiddenGroups: [],
    collapsedGroups: [],
    showEmptyGroups: false,
    ...overrides,
  };
}

describe("groupRecords", () => {
  test("groups by field value", () => {
    const groups = groupRecords(records, makeConfig());
    expect(groups).toHaveLength(3);
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("active");
    expect(keys).toContain("done");
    expect(keys).toContain(""); // null → empty string
  });

  test("sorts groups ascending", () => {
    const groups = groupRecords(records, makeConfig({ sortOrder: "asc" }));
    expect(groups[0]!.key).toBe("");
    expect(groups[1]!.key).toBe("active");
    expect(groups[2]!.key).toBe("done");
  });

  test("sorts groups descending", () => {
    const groups = groupRecords(records, makeConfig({ sortOrder: "desc" }));
    expect(groups[0]!.key).toBe("done");
    expect(groups[1]!.key).toBe("active");
    expect(groups[2]!.key).toBe("");
  });

  test("hides specified groups", () => {
    const groups = groupRecords(
      records,
      makeConfig({ hiddenGroups: ["done"] })
    );
    const keys = groups.map((g) => g.key);
    expect(keys).not.toContain("done");
    expect(keys).toContain("active");
  });

  test("each group contains correct records", () => {
    const groups = groupRecords(records, makeConfig());
    const active = groups.find((g) => g.key === "active");
    expect(active!.records).toHaveLength(2);
    expect(active!.records.map((r) => r.id)).toEqual(["1", "3"]);
  });

  test("handles all records in one group", () => {
    const sameRecords = records.map((r) => ({
      ...r,
      values: { ...r.values, status: "same" },
    }));
    const groups = groupRecords(sameRecords, makeConfig());
    expect(groups).toHaveLength(1);
    expect(groups[0]!.records).toHaveLength(5);
  });

  test("2-level sub-grouping: splits groups by subGroupField", () => {
    const data: DataRecord[] = [
      { id: "1", values: { status: "active", team: "frontend" } },
      { id: "2", values: { status: "active", team: "backend" } },
      { id: "3", values: { status: "done", team: "frontend" } },
      { id: "4", values: { status: "done", team: "frontend" } },
    ];
    const groups = groupRecords(data, makeConfig({ subGroupField: "team" }));
    expect(groups).toHaveLength(2); // active, done

    const active = groups.find((g) => g.key === "active")!;
    expect(active.subGroups).toBeDefined();
    expect(active.subGroups).toHaveLength(2);
    expect(active.subGroups!.map((s) => s.key).sort()).toEqual(["backend", "frontend"]);

    const done = groups.find((g) => g.key === "done")!;
    expect(done.subGroups).toHaveLength(1);
    expect(done.subGroups![0]!.key).toBe("frontend");
    expect(done.subGroups![0]!.records).toHaveLength(2);
  });

  test("sub-groups respect subGroupSortOrder", () => {
    const data: DataRecord[] = [
      { id: "1", values: { status: "active", team: "C" } },
      { id: "2", values: { status: "active", team: "A" } },
      { id: "3", values: { status: "active", team: "B" } },
    ];
    const groups = groupRecords(data, makeConfig({ subGroupField: "team", subGroupSortOrder: "desc" }));
    const sub = groups[0]!.subGroups!;
    expect(sub.map((s) => s.key)).toEqual(["C", "B", "A"]);
  });
});
