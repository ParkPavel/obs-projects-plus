/**
 * The aggregation vocabulary in the user's language.
 *
 * aggregationOptions.ts (#180 T4) is the one table of aggregation names,
 * consequences and badge codes — in English. Stats cards translated 17 names;
 * the table's Calculate menu and footer printed raw identifiers ("count
 * total"); consequences and badge codes were never translated. Every surface
 * now reads the table through one set of keys with English as the default.
 */

import * as fs from "fs";
import * as path from "path";
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import * as vocabulary from "../aggregationOptions";
import { buildHeaderMenuEntries } from "src/ui/views/Dashboard/widgets/DatabaseCall/tableHeaderOps";

const { AGGREGATIONS } = vocabulary;
type Translate = (key: string, defaultValue: string) => string;
type Helper = (value: string, t: Translate) => string;
const helper = (name: string): Helper => {
  const fn = (vocabulary as Record<string, unknown>)[name];
  if (typeof fn !== "function") throw new Error(`aggregationOptions has no ${name}`);
  return fn as Helper;
};
const echo: Translate = (key, fallback) => `${key}|${fallback}`;

function bundle(locale: string): Record<string, unknown> {
  const file = path.join(__dirname, "..", "..", "stores", "translations", `${locale}.json`);
  return (JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as { translation: Record<string, unknown> }).translation;
}
const at = (b: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), b);

describe("aggregation vocabulary — keys", () => {
  const values = [...new Set(AGGREGATIONS.map((o) => o.value))].filter((v) => v !== "none");

  it.each(["en", "ru", "uk", "zh-CN"])("%s names, explains and abbreviates every aggregation", (locale) => {
    const b = bundle(locale);
    const missing = values.flatMap((v) =>
      [`views.dashboard.agg.${v}`, `views.dashboard.agg-consequence.${v}`, `views.dashboard.agg-badge.${v}`]
        .filter((key) => typeof at(b, key) !== "string" || !(at(b, key) as string).trim())
    );
    expect(missing).toEqual([]);
  });
});

describe("aggregation vocabulary — helpers", () => {
  it("route the name, consequence and badge through the caller's translate function", () => {
    const sum = AGGREGATIONS.find((o) => o.value === "sum")!;
    expect(helper("aggregationLabel")("sum", echo)).toBe(`views.dashboard.agg.sum|${sum.label}`);
    expect(helper("aggregationConsequence")("sum", echo)).toBe(`views.dashboard.agg-consequence.sum|${sum.consequence}`);
    expect(helper("aggregationBadgeText")("sum", echo)).toBe(`views.dashboard.agg-badge.sum|${sum.badge}`);
  });

  it("an unknown value falls back to itself, never to an empty string", () => {
    expect(helper("aggregationLabel")("mystery", (_k, d) => d)).toBe("mystery");
    expect(helper("aggregationBadgeText")("mystery", (_k, d) => d)).toBe("MYSTERY");
  });
});

describe("aggregation vocabulary — the table's Calculate menu", () => {
  it("names each calculation through the vocabulary, not by its identifier", () => {
    const entries = buildHeaderMenuEntries({
      field: { name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false } as DataField,
      isPrimary: false,
      currentSort: null,
      currentCalc: undefined,
      groupedBy: false,
      t: echo,
      onSort: () => {},
      onHide: () => {},
      onCalculate: () => {},
      onGroup: () => {},
    });
    const calculate = entries.find((e) => "title" in e && e.title.startsWith("views.dashboard.table-v2.calculate"));
    const titles = (calculate && "submenu" in calculate ? calculate.submenu ?? [] : [])
      .map((e) => ("title" in e ? e.title : ""))
      .filter((title) => !title.startsWith("views.dashboard.table-v2.calc-none"));
    expect(titles.length).toBeGreaterThan(3);
    for (const title of titles) expect(title).toMatch(/^views\.dashboard\.agg\.[a-z_]+\|/);
  });
});
