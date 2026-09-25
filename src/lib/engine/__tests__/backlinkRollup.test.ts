/**
 * Reverse rollups — a record aggregates the records that link TO it.
 *
 * A client is one note. Visits live in another project, and each visit links
 * its client. The client's card must show the visit count, the average
 * wellbeing and the latest wellbeing — without the client note carrying a
 * list of its visits that someone has to keep in sync (calc-engine-map,
 * 2026-09-26: reverse aggregation needed a materialised inverse field).
 *
 * Links resolve by the same contract as forward relations (path → basename →
 * display, first level that matches, ambiguous and unmatched contribute
 * nothing), so a backlink counts exactly the visits a forward link would
 * reach.
 */

import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { computeBacklinkRollupColumn } from "src/lib/engine/crossProjectRollup";
import { aggregate } from "src/lib/engine/aggregate";
import { applyRollupColumns } from "src/ui/app/rollupColumns";
import { extractRelationTargetIds } from "src/ui/app/viewHelpers";
import type { RollupFieldConfig } from "src/settings/base/settings";

function frame(rows: Array<[string, Record<string, DataValue>]>): DataFrame {
  const names = [...new Set(rows.flatMap(([, v]) => Object.keys(v)))];
  return {
    fields: names.map((name) => ({ name, type: DataFieldType.String, repeated: false, identifier: false, derived: false })),
    records: rows.map(([id, values]) => ({ id, values })),
  } as unknown as DataFrame;
}

const clients = frame([
  ["Кабинет/Клиенты/Анна.md", { phone: "1" }],
  ["Кабинет/Клиенты/Борис.md", { phone: "2" }],
  ["Кабинет/Клиенты/Вера.md", { phone: "3" }],
]);

// Deliberately out of date order: "latest" must come from the dates.
const visits = frame([
  ["Кабинет/Визиты/v2.md", { client: "[[Анна]]", date: "2026-09-10", wellbeing: 8 }],
  ["Кабинет/Визиты/v1.md", { client: "[[Анна]]", date: "2026-09-01", wellbeing: 6 }],
  ["Кабинет/Визиты/v3.md", { client: "[[Кабинет/Клиенты/Борис]]", date: "2026-09-05", wellbeing: 5 }],
  // One visit linking the same client twice counts once.
  ["Кабинет/Визиты/v4.md", { client: ["[[Анна]]", "[[Анна]]"] as unknown as DataValue, date: "2026-09-03", wellbeing: 7 }],
  // A link that matches nobody contributes nothing.
  ["Кабинет/Визиты/v5.md", { client: "[[Григорий]]", date: "2026-09-04", wellbeing: 1 }],
]);

const backlink = (fn: RollupFieldConfig["function"], extra: Partial<RollupFieldConfig> = {}): RollupFieldConfig => ({
  relationField: "",
  targetField: "wellbeing",
  function: fn,
  backlink: { projectId: "visits", relationField: "client" },
  ...extra,
});

const valueOf = (col: ReturnType<typeof computeBacklinkRollupColumn>, id: string) => col.get(id)?.value;

describe("computeBacklinkRollupColumn — client ← visits", () => {
  test("counts the visits that link each client; a client nobody links has 0", () => {
    const col = computeBacklinkRollupColumn(clients, backlink("count_total"), visits);
    expect(valueOf(col, "Кабинет/Клиенты/Анна.md")).toBe(3);
    expect(valueOf(col, "Кабинет/Клиенты/Борис.md")).toBe(1);
    expect(valueOf(col, "Кабинет/Клиенты/Вера.md")).toBe(0);
  });

  test("averages a field of the linking records", () => {
    const col = computeBacklinkRollupColumn(clients, backlink("avg"), visits);
    expect(valueOf(col, "Кабинет/Клиенты/Анна.md")).toBeCloseTo(7, 12); // (8 + 6 + 7) / 3
    expect(valueOf(col, "Кабинет/Клиенты/Вера.md")).toBeNull();
  });

  test("the latest value by date, whatever order the files come in", () => {
    const col = computeBacklinkRollupColumn(clients, backlink("last_value", { orderBy: "date" }), visits);
    expect(valueOf(col, "Кабинет/Клиенты/Анна.md")).toBe(8);
    expect(valueOf(col, "Кабинет/Клиенты/Борис.md")).toBe(5);
    expect(valueOf(col, "Кабинет/Клиенты/Вера.md")).toBeNull();
  });

  test("the first value by date", () => {
    const col = computeBacklinkRollupColumn(clients, backlink("first_value", { orderBy: "date" }), visits);
    expect(valueOf(col, "Кабинет/Клиенты/Анна.md")).toBe(6);
  });
});

describe("first_value / last_value in the kernel", () => {
  test("skip empty cells and keep the order they are given", () => {
    const cfg = (fn: "first_value" | "last_value") => ({ relationField: "", targetField: "", function: fn });
    expect(aggregate([null, 4, 5, null], cfg("first_value")).value).toBe(4);
    expect(aggregate([null, 4, 5, null], cfg("last_value")).value).toBe(5);
    expect(aggregate([null, ""], cfg("last_value")).value).toBeNull();
  });
});

describe("the view layer wires backlink rollups", () => {
  const fieldConfig = { visitCount: { rollup: backlink("count_total") } };

  test("the project the backlinks come from is fetched", () => {
    expect(extractRelationTargetIds("clients", fieldConfig)).toContain("visits");
  });

  test("applyRollupColumns folds the backlink rollup into the client frame", () => {
    const out = applyRollupColumns(clients, fieldConfig, "clients", new Map([["visits", visits]]));
    const anna = out.records.find((r) => r.id === "Кабинет/Клиенты/Анна.md")!;
    expect(anna.values["visitCount"]).toBe(3);
  });

  test("backlinks inside the same project read the project's own frame", () => {
    const own = frame([...clients.records.map((r) => [r.id, r.values] as [string, Record<string, DataValue>]),
      ...visits.records.map((r) => [r.id, r.values] as [string, Record<string, DataValue>])]);
    const cfg = { visitCount: { rollup: { ...backlink("count_total"), backlink: { projectId: "cabinet", relationField: "client" } } } };
    const out = applyRollupColumns(own, cfg, "cabinet", new Map());
    expect(out.records.find((r) => r.id === "Кабинет/Клиенты/Анна.md")!.values["visitCount"]).toBe(3);
  });
});

// ── backlink-review (codex, 2026-09-26) ──────────────────────────────────
describe("a backlink reaches exactly what a forward link from the source reaches", () => {
  const named = frame([["clients/c1.md", { name: "Alice" }], ["clients/c2.md", { name: "Bob", archived: "yes" }]]);

  test("a link by display name counts, as it does forward", () => {
    const v = frame([["v/1.md", { client: "[[Alice]]", score: 3 }]]);
    const col = computeBacklinkRollupColumn(named, backlink("count_total", { targetField: "score" }), v);
    expect(col.get("clients/c1.md")?.value).toBe(1);
  });

  test("a client excluded by the source relation's targetSubBaseFilter is not reached", () => {
    const v = frame([["v/1.md", { client: "[[Bob]]", score: 3 }]]);
    const withFilter: DataFrame = {
      ...v,
      fields: v.fields.map((f) => f.name === "client"
        ? { ...f, typeConfig: { relation: { targetProjectId: "clients", targetSubBaseFilter: {
          conjunction: "and", conditions: [{ field: "archived", operator: "is-empty", enabled: true }] } } } }
        : f),
    } as unknown as DataFrame;
    const col = computeBacklinkRollupColumn(named, backlink("count_total", { targetField: "score" }), withFilter);
    expect(col.get("clients/c2.md")?.value).toBe(0);
  });
});

describe("orderBy compares dates as instants, whatever their form", () => {
  test("an ISO string and a Date order by time", () => {
    const v = frame([
      ["v/new.md", { client: "[[Анна]]", date: new Date(2026, 8, 10) as unknown as DataValue, score: 2 }],
      ["v/old.md", { client: "[[Анна]]", date: "2026-09-01", score: 1 }],
    ]);
    const col = computeBacklinkRollupColumn(clients, backlink("last_value", { targetField: "score", orderBy: "date" }), v);
    expect(col.get("Кабинет/Клиенты/Анна.md")?.value).toBe(2);
  });

  test("forward rollups honour orderBy too", () => {
    const own = frame([
      ["c/Анна.md", { visits: ["[[v2]]", "[[v1]]"] as unknown as DataValue }],
      ["v/v1.md", { date: "2026-09-01", score: 1 }],
      ["v/v2.md", { date: "2026-09-10", score: 2 }],
    ]);
    const cfg = { visits: { relation: { targetProjectId: "p" } },
      last: { rollup: { relationField: "visits", targetField: "score", function: "last_value" as const, orderBy: "date" } } };
    const out = applyRollupColumns(own, cfg, "p", new Map());
    expect(out.records.find((r) => r.id === "c/Анна.md")!.values["last"]).toBe(2);
  });
});

describe("a date value keeps its local calendar day", () => {
  test("last_value of a local-midnight date is that day, not the UTC one", () => {
    const d = new Date(2026, 8, 10); // local midnight, as ingestion stores a date-only value
    const cfg = { relationField: "", targetField: "", function: "last_value" as const };
    expect(aggregate([d as unknown as DataValue], cfg).value).toBe("2026-09-10");
  });
});
