/**
 * tableCanon.test.ts — F2.1 (#074, TABLE_V2_CANON) pure table model.
 */

import fs from "fs";
import path from "path";
import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import {
  buildColumns,
  gridTemplate,
  activeSortCriteria,
  applySort,
  applySearch,
  cellDisplay,
  buildRenderRows,
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

  it("produces one shared grid template whose COLUMN tracks are fixed (#083)", () => {
    const cols = buildColumns(FIELDS, undefined);
    const tracks = gridTemplate(cols).split(" ");
    // 3 columns + the #166 filler.
    expect(tracks).toHaveLength(4);
    for (const track of tracks.slice(0, -1)) expect(track).toMatch(/^[\d.]+rem$/);
  });

  it("ends in exactly one `1fr` filler track, whatever the column count (#166)", () => {
    for (const n of [0, 1, 3]) {
      const tracks = gridTemplate(buildColumns(FIELDS.slice(0, n), undefined)).split(" ");
      expect(tracks[tracks.length - 1]).toBe("1fr");
      expect(tracks.filter((t) => t.endsWith("fr"))).toHaveLength(1);
    }
  });

  it("hides housekeeping fields (path) by default, unhides on explicit hide:false (#084)", () => {
    const withPath = [...FIELDS, field("path", DataFieldType.String)];
    expect(buildColumns(withPath, undefined).map((c) => c.field.name)).not.toContain("path");
    const cols = buildColumns(withPath, { fieldConfig: { path: { hide: false } } } as never);
    expect(cols.map((c) => c.field.name)).toContain("path");
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

  it("renders wikilinks inside plain String fields as link chips (#085)", () => {
    const cell = cellDisplay(field("project", DataFieldType.String), "[[Onboarding Flow — Acme Studio]]");
    expect(cell.kind).toBe("pills");
    expect((cell as { pills: { label: string }[] }).pills[0]?.label).toBe("Onboarding Flow — Acme Studio");
  });

  it("keeps plain text without wikilinks as text", () => {
    expect(cellDisplay(field("note", DataFieldType.String), "plain")).toEqual({ kind: "text", text: "plain" });
  });
});

describe("buildRenderRows (F2.5 grouping)", () => {
  const records = [
    record("a", { status: "doing" }),
    record("b", { status: "done" }),
    record("c", { status: "doing" }),
  ];

  it("passes records through without groupBy", () => {
    expect(buildRenderRows(records, undefined).map((r) => r.kind)).toEqual(["record", "record", "record"]);
  });

  it("emits group headers with counts and nests records under them", () => {
    const rows = buildRenderRows(records, {
      groupBy: { field: "status", sortOrder: "asc", hiddenGroups: [], collapsedGroups: [], showEmptyGroups: false },
    } as never);
    expect(rows[0]).toMatchObject({ kind: "group", key: "doing", count: 2, collapsed: false });
    expect(rows.filter((r) => r.kind === "record")).toHaveLength(3);
  });

  it("collapsed groups contribute only their header", () => {
    const rows = buildRenderRows(records, {
      groupBy: { field: "status", sortOrder: "asc", hiddenGroups: [], collapsedGroups: ["doing"], showEmptyGroups: false },
    } as never);
    expect(rows.filter((r) => r.kind === "record")).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "group", key: "doing", collapsed: true });
  });
});

/**
 * #166 — the three grids that must stay in one coordinate system.
 *
 * `gridTemplate` is the single source of the track list; header, row and
 * footer each read it through `--ppp-dt-columns`. UT-R2 #083 was caused by
 * the three disagreeing, so the invariant is checked against the shipped
 * source text rather than trusted: any consumer that appends or drops a
 * track of its own reintroduces the divergence, and the header did exactly
 * that (a trailing `2rem` action column) until the filler track replaced it.
 */
describe("one grid template, three consumers (#083/#166)", () => {
  const dir = path.join(__dirname, "..");
  const consumers = ["TableHeader.svelte", "TableRow.svelte", "TableFooter.svelte"];

  it.each(consumers)("%s consumes --ppp-dt-columns and appends no track of its own", (file) => {
    const css = fs.readFileSync(path.join(dir, file), "utf8");
    const rules = [...css.matchAll(/grid-template-columns:([^;]*);/g)].map((m) => m[1]!.trim());
    expect(rules).toEqual(["var(--ppp-dt-columns)"]);
  });

  it("DataTableContent is the only writer of --ppp-dt-columns, from gridTemplate", () => {
    const src = fs.readFileSync(path.join(dir, "DataTableContent.svelte"), "utf8");
    expect(src).toContain("style:--ppp-dt-columns={template}");
    expect(src).toMatch(/template = gridTemplate\(/);
  });
});
