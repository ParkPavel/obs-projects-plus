/**
 * tableCanon.test.ts — F2.1 (#074, TABLE_V2_CANON) pure table model.
 */

import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import {
  buildColumns,
  gridTemplate,
  activeSortCriteria,
  applySort,
  applySearch,
  cellDisplay,
  MAX_VISIBLE_PILLS,
} from "../tableCanon";

function field(name: string, type: DataFieldType, extra: Partial<DataField> = {}): DataField {
  return { name, type, repeated: false, identifier: false, derived: false, ...extra } as DataField;
}

function record(id: string, values: Record<string, unknown>): DataRecord {
  return { id, values } as DataRecord;
}

const FIELDS: DataField[] = [
  field("name", DataFieldType.String, { identifier: true }),
  field("status", DataFieldType.Select),
  field("mrr", DataFieldType.Number),
];

describe("buildColumns (canon §0/§1)", () => {
  it("puts the primary identity column first and never hides it", () => {
    const cols = buildColumns(FIELDS, {
      orderFields: ["mrr", "status", "name"],
      fieldConfig: { name: { hide: true } },
    } as never);
    expect(cols[0]?.field.name).toBe("name");
    expect(cols[0]?.isPrimary).toBe(true);
  });

  it("respects orderFields and hide flags for non-primary columns", () => {
    const cols = buildColumns(FIELDS, {
      orderFields: ["status", "mrr"],
      fieldConfig: { mrr: { hide: true } },
    } as never);
    expect(cols.map((c) => c.field.name)).toEqual(["name", "status"]);
  });

  it("migrates legacy px width to rem on read", () => {
    const cols = buildColumns(FIELDS, { fieldConfig: { mrr: { width: 160 } } } as never);
    expect(cols.find((c) => c.field.name === "mrr")?.widthRem).toBe(10);
  });

  it("produces one shared grid template", () => {
    const cols = buildColumns(FIELDS, undefined);
    expect(gridTemplate(cols).split(" ").filter((s) => s.startsWith("minmax"))).toHaveLength(3);
  });
});

describe("sorting (multi-criteria + legacy)", () => {
  const records = [
    record("b", { name: "B", mrr: 10 }),
    record("a", { name: "A", mrr: 30 }),
    record("c", { name: "C", mrr: 10 }),
  ];

  it("maps legacy sortField/sortAsc to criteria", () => {
    expect(activeSortCriteria({ sortField: "mrr", sortAsc: false } as never)).toEqual([
      { field: "mrr", order: "desc" },
    ]);
  });

  it("sorts by multiple criteria with empty values last", () => {
    const sorted = applySort(
      [...records, record("d", { name: "D" })],
      { sortCriteria: [{ field: "mrr", order: "asc" }, { field: "name", order: "desc" }] } as never
    );
    expect(sorted.map((r) => r.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("returns input order without criteria", () => {
    expect(applySort(records, undefined).map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});

describe("search", () => {
  const records = [
    record("alpha", { name: "Alpha", note: "Helix Labs" }),
    record("beta", { name: "Beta", note: "Acme" }),
  ];

  it("matches values case-insensitively", () => {
    expect(applySearch(records, "helix").map((r) => r.id)).toEqual(["alpha"]);
  });

  it("returns all on empty query", () => {
    expect(applySearch(records, "  ")).toHaveLength(2);
  });
});

describe("cellDisplay (canon §2)", () => {
  it("renders empty for null/undefined/empty-string", () => {
    expect(cellDisplay(field("x", DataFieldType.String), "")).toEqual({ kind: "empty" });
    expect(cellDisplay(field("x", DataFieldType.Number), null)).toEqual({ kind: "empty" });
  });

  it("formats numbers with locale separators, right-alignable", () => {
    const cell = cellDisplay(field("mrr", DataFieldType.Number), 42000);
    expect(cell.kind).toBe("number");
    expect((cell as { text: string }).text).toBe((42000).toLocaleString());
  });

  it("renders booleans as checks", () => {
    expect(cellDisplay(field("done", DataFieldType.Boolean), true)).toEqual({ kind: "check", checked: true });
  });

  it("renders Select as a pill and Status with a dot marker", () => {
    const sel = cellDisplay(field("stage", DataFieldType.Select), "active");
    expect(sel.kind).toBe("pills");
    expect((sel as { status: boolean }).status).toBe(false);
    const st = cellDisplay(field("status", DataFieldType.Status), "doing");
    expect((st as { status: boolean }).status).toBe(true);
  });

  it("parses relation wikilinks into labeled pills", () => {
    const cell = cellDisplay(field("client", DataFieldType.Relation), "[[Acme Studio]]");
    expect(cell.kind).toBe("pills");
    expect((cell as { pills: { label: string }[] }).pills[0]?.label).toBe("Acme Studio");
  });

  it("collapses long lists into +N overflow", () => {
    const value = ["a", "b", "c", "d", "e"];
    const cell = cellDisplay(field("tags", DataFieldType.List, { repeated: true }), value);
    expect(cell.kind).toBe("pills");
    const pills = cell as { pills: unknown[]; overflow: number };
    expect(pills.pills).toHaveLength(MAX_VISIBLE_PILLS);
    expect(pills.overflow).toBe(value.length - MAX_VISIBLE_PILLS);
  });

  it("formats Date instances as ISO dates", () => {
    const cell = cellDisplay(field("d", DataFieldType.Date), new Date("2026-06-11T10:00:00Z"));
    expect(cell).toEqual({ kind: "text", text: "2026-06-11" });
  });
});
