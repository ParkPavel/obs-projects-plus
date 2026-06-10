/**
 * FieldPreset helper tests (Phase 2b).
 *
 * Verifies:
 *  - snapshotFromTable copies exactly the presettable keys and deep-clones
 *    nested arrays/objects so the snapshot is independent of the source.
 *  - applyPresetToTable produces an *exact* layout (keys absent in the
 *    preset are cleared in the result).
 *  - Non-presettable DataTableConfig fields (aggregations,
 *    conditionalFormats, defaultValues, hintDismissed, legacy
 *    sortField/sortAsc) are preserved untouched across apply.
 *  - Round-trip snapshot -> apply is idempotent for presettable keys.
 */
import {
  snapshotFromTable,
  applyPresetToTable,
  PRESETTABLE_KEYS,
} from "src/archive/dashboard-v1/DataTable/fieldPreset";
import type {
  DataTableConfig,
  FieldPreset,
} from "../types";

const fullTable = {
  fieldConfig: {
    status: { width: 120, pinned: true },
    estimate: { width: 80 },
  },
  orderFields: ["status", "estimate"],
  sortCriteria: [{ field: "status", order: "asc" as const }],
  freezeUpTo: "status",
  groupBy: {
    field: "status",
    sortOrder: "asc" as const,
    hiddenGroups: [],
    collapsedGroups: [],
    showEmptyGroups: false,
  },
  rowHeight: "compact" as const,
  wrapText: true,
  // ── non-presettable keys below ──
  aggregations: { estimate: "sum" as const },
  conditionalFormats: [],
  defaultValues: { status: "new" },
  hintDismissed: true,
  sortField: "status",
  sortAsc: false,
} as unknown as DataTableConfig;

describe("fieldPreset — snapshotFromTable", () => {
  test("copies exactly the presettable keys", () => {
    const snap = snapshotFromTable(fullTable);
    const keys = Object.keys(snap).sort();
    expect(keys).toEqual([...PRESETTABLE_KEYS].sort());
  });

  test("deep-clones nested arrays and objects (source immutable)", () => {
    const snap = snapshotFromTable(fullTable);
    // Mutate the snapshot — source must remain intact. Cast through
    // `unknown` because `DataTableSortCriteria.field` is declared
    // readonly on the public type but the clone is a fresh object.
    (snap.sortCriteria as unknown as { field: string }[])[0]!.field = "mutated";
    (snap.orderFields as string[])[0] = "mutated";
    expect(fullTable.sortCriteria?.[0]?.field).toBe("status");
    expect(fullTable.orderFields?.[0]).toBe("status");
  });

  test("omits absent presettable keys rather than emitting undefined", () => {
    const minimal: DataTableConfig = { rowHeight: "default" };
    const snap = snapshotFromTable(minimal);
    expect(Object.keys(snap)).toEqual(["rowHeight"]);
    expect("fieldConfig" in snap).toBe(false);
  });
});

describe("fieldPreset — applyPresetToTable", () => {
  test("exact-layout semantics: keys absent in preset are cleared", () => {
    const preset: FieldPreset = {
      id: "p1",
      label: "Narrow",
      orderFields: ["status"],
      rowHeight: "compact",
    };
    const result = applyPresetToTable(fullTable, preset);
    // Present in preset.
    expect(result.orderFields).toEqual(["status"]);
    expect(result.rowHeight).toBe("compact");
    // Absent in preset ⇒ cleared.
    expect(result.fieldConfig).toBeUndefined();
    expect(result.sortCriteria).toBeUndefined();
    expect(result.freezeUpTo).toBeUndefined();
    expect(result.groupBy).toBeUndefined();
    expect(result.wrapText).toBeUndefined();
  });

  test("preserves non-presettable fields untouched", () => {
    const preset: FieldPreset = { id: "p1", label: "Empty" };
    const result = applyPresetToTable(fullTable, preset);
    expect(result.aggregations).toEqual(fullTable.aggregations);
    expect(result.conditionalFormats).toEqual(fullTable.conditionalFormats);
    expect(result.defaultValues).toEqual(fullTable.defaultValues);
    expect(result.hintDismissed).toBe(true);
    expect(result.sortField).toBe("status");
    expect(result.sortAsc).toBe(false);
  });

  test("round-trip snapshot → apply reproduces presettable state", () => {
    const preset: FieldPreset = {
      id: "rt",
      label: "RoundTrip",
      ...snapshotFromTable(fullTable),
    };
    const result = applyPresetToTable(fullTable, preset);
    for (const key of PRESETTABLE_KEYS) {
      expect(result[key as keyof DataTableConfig]).toEqual(
        fullTable[key as keyof DataTableConfig],
      );
    }
  });

  test("returned config is a new object (immutability)", () => {
    const preset: FieldPreset = { id: "p1", label: "L" };
    const result = applyPresetToTable(fullTable, preset);
    expect(result).not.toBe(fullTable);
  });
});
