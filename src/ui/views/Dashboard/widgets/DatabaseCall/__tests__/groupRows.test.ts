// src/ui/views/Dashboard/widgets/DataTable/groupRows.test.ts

import { groupRecords } from "../groupRows";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { GroupConfig } from "src/ui/views/Dashboard/types";

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

// ─── #045.6 — semantic mode (3-tier bucket overlay) ────────────────────

describe("groupRecords — semantic mode (#045.6)", () => {
  const SG = {
    todo: ["Backlog", "Todo"],
    inProgress: ["In Progress", "Blocked"],
    complete: ["Done", "Cancelled"],
  };
  const data: DataRecord[] = [
    { id: "r1", values: { status: "Todo" } },
    { id: "r2", values: { status: "In Progress" } },
    { id: "r3", values: { status: "Done" } },
    { id: "r4", values: { status: "Blocked" } },
    { id: "r5", values: { status: "Backlog" } },
    { id: "r6", values: { status: null } },
    { id: "r7", values: { status: "Unknown" } },
  ];

  test("produces 4 columns in canonical order when 'no-status' is non-empty", () => {
    const groups = groupRecords(
      data,
      makeConfig({ mode: "semantic", statusGroups: SG })
    );
    expect(groups.map((g) => g.key)).toEqual([
      "To Do",
      "In Progress",
      "Done",
      "No Status",
    ]);
  });

  test("routes records to the correct semantic bucket", () => {
    const groups = groupRecords(
      data,
      makeConfig({ mode: "semantic", statusGroups: SG })
    );
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.records]));
    expect(byKey["To Do"]?.map((r) => r.id).sort()).toEqual(["r1", "r5"]);
    expect(byKey["In Progress"]?.map((r) => r.id).sort()).toEqual(["r2", "r4"]);
    expect(byKey["Done"]?.map((r) => r.id)).toEqual(["r3"]);
    expect(byKey["No Status"]?.map((r) => r.id).sort()).toEqual(["r6", "r7"]);
  });

  test("omits 'No Status' bucket when every record matches a group", () => {
    const clean: DataRecord[] = [
      { id: "a", values: { status: "Todo" } },
      { id: "b", values: { status: "Done" } },
    ];
    const groups = groupRecords(
      clean,
      makeConfig({ mode: "semantic", statusGroups: SG })
    );
    expect(groups.map((g) => g.key)).toEqual(["To Do", "In Progress", "Done"]);
  });

  test("keeps empty top-tier buckets so users can drop into them", () => {
    const onlyDone: DataRecord[] = [{ id: "x", values: { status: "Done" } }];
    const groups = groupRecords(
      onlyDone,
      makeConfig({ mode: "semantic", statusGroups: SG })
    );
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("To Do");
    expect(keys).toContain("In Progress");
    expect(keys).toContain("Done");
    expect(keys).not.toContain("No Status");
  });

  test("honours localised semanticLabels", () => {
    const groups = groupRecords(
      data,
      makeConfig({
        mode: "semantic",
        statusGroups: SG,
        semanticLabels: {
          todo: "К выполнению",
          inProgress: "В работе",
          complete: "Готово",
          none: "Без статуса",
        },
      })
    );
    expect(groups.map((g) => g.key)).toEqual([
      "К выполнению",
      "В работе",
      "Готово",
      "Без статуса",
    ]);
  });

  test("falls back to value mode when statusGroups omitted", () => {
    const groups = groupRecords(
      data,
      makeConfig({ mode: "semantic" }) // no statusGroups
    );
    // Value mode → one column per distinct value.
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("Todo");
    expect(keys).toContain("Blocked");
    expect(keys).toContain("Backlog");
    expect(keys.length).toBeGreaterThan(4);
  });

  test("ignores sortOrder in semantic mode (canonical order is fixed)", () => {
    const groups = groupRecords(
      data,
      makeConfig({ mode: "semantic", statusGroups: SG, sortOrder: "desc" })
    );
    expect(groups.map((g) => g.key)).toEqual([
      "To Do",
      "In Progress",
      "Done",
      "No Status",
    ]);
  });

  test("hidden buckets are filtered in semantic mode", () => {
    const groups = groupRecords(
      data,
      makeConfig({
        mode: "semantic",
        statusGroups: SG,
        hiddenGroups: ["Done"],
      })
    );
    const keys = groups.map((g) => g.key);
    expect(keys).not.toContain("Done");
    expect(keys).toContain("To Do");
    expect(keys).toContain("In Progress");
  });

  test("composes with sub-grouping", () => {
    const dataWithTeam: DataRecord[] = [
      { id: "1", values: { status: "Todo", team: "A" } },
      { id: "2", values: { status: "Todo", team: "B" } },
      { id: "3", values: { status: "Done", team: "A" } },
    ];
    const groups = groupRecords(
      dataWithTeam,
      makeConfig({
        mode: "semantic",
        statusGroups: SG,
        subGroupField: "team",
      })
    );
    const todo = groups.find((g) => g.key === "To Do")!;
    expect(todo.subGroups).toBeDefined();
    expect(todo.subGroups!.map((s) => s.key).sort()).toEqual(["A", "B"]);
    const done = groups.find((g) => g.key === "Done")!;
    expect(done.subGroups!.map((s) => s.key)).toEqual(["A"]);
  });

  test("non-string/number values fall into 'No Status'", () => {
    // Cast through unknown — Status is normally string/number, but
    // groupRecords must defensively bucket exotic DataValue shapes too.
    const oddData = [
      { id: "arr", values: { status: ["Todo"] } },
      { id: "date", values: { status: new Date("2024-01-01") } },
      { id: "todo", values: { status: "Todo" } },
    ] as unknown as DataRecord[];
    const groups = groupRecords(
      oddData,
      makeConfig({ mode: "semantic", statusGroups: SG })
    );
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.records]));
    expect(byKey["To Do"]?.map((r) => r.id)).toEqual(["todo"]);
    expect(byKey["No Status"]?.map((r) => r.id).sort()).toEqual(
      ["arr", "date"].sort()
    );
  });

  test("back-compat: mode=undefined still uses value mode (#045.6 zero-impact)", () => {
    const groups = groupRecords(data, makeConfig());
    // mode defaults to undefined/values — should NOT produce semantic buckets.
    const keys = groups.map((g) => g.key);
    expect(keys).not.toContain("To Do");
    expect(keys).toContain("Todo");
  });
});
