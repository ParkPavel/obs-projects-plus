/**
 * Spreadsheet oracles — the engine must reproduce a real user's workbook.
 *
 * `ИНВЕНТА1.xlsx` is how a coffee shop keeps its books, and it is the shape
 * users bring when they move calculations into notes:
 *
 * - a recipe card (drink × ingredient);
 * - daily sales multiplied through it into consumption per ingredient (a
 *   matrix product);
 * - a display case with purchase, retail and write-offs;
 * - staff consumption priced per unit.
 *
 * Every expected number below is the value Excel computed and stored in the
 * workbook (sheet and cell given), not one derived by this code. The pipeline
 * has to arrive at it through the steps a user would configure: join → compute
 * → group-by → aggregate.
 */

import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";

function frame(rows: Array<Record<string, string | number>>): DataFrame {
  const names = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return {
    fields: names.map((name) => ({
      name,
      type: typeof rows.find((r) => r[name] !== undefined)?.[name] === "number" ? DataFieldType.Number : DataFieldType.String,
      repeated: false,
      identifier: false,
      derived: false,
    })),
    records: rows.map((values, i) => ({ id: `r${i}.md`, values })),
  } as unknown as DataFrame;
}

function column(df: DataFrame, key: string, value: string): Map<string, number> {
  return new Map(df.records.map((r) => [String(r.values[key]), Number(r.values[value])]));
}

// ── кальк.кофе × ТЕХКАРТА ────────────────────────────────────────────────
// ТЕХКАРТА rows 3–27, the drinks sold that day, as recipe lines (drink,
// ingredient, amount). Capuccino 450 and Latte 450 carry the lid in the 0.3
// column and the cup in the 0.4 column exactly as the workbook does.
const RECIPE: Array<[string, Record<string, number>]> = [
  ["Американо 250", { coffee: 17, cup02: 1, lid02: 1 }],
  ["Американо 350", { coffee: 34, cup03: 1, lid03: 1 }],
  ["Горячий шоколад", { milk: 210, chocolate: 30, cup03: 1, lid03: 1 }],
  ["Капучино 250", { coffee: 17, milk: 150, cup02: 1, lid02: 1 }],
  ["Капучино 350", { coffee: 17, milk: 190, cup03: 1, lid03: 1 }],
  ["Капучино 450", { coffee: 17, milk: 240, lid03: 1, cup04: 1 }],
  ["Латте 350", { coffee: 17, milk: 190, cup03: 1, lid03: 1 }],
  ["Латте 450", { coffee: 17, milk: 240, lid03: 1, cup04: 1 }],
  ["Моккачино", { coffee: 17, milk: 190, chocolate: 20, cup03: 1, lid03: 1 }],
  ["Эспрессо", { coffee: 17 }],
  ["Сироп", { syrup: 15 }],
  // Drinks on the card that sold nothing that day: they must add nothing.
  ["Айс-латте", { coffee: 17, milk: 260, cup05: 1, lidPull: 1 }],
  ["Раф Кедр", { coffee: 17, milk: 190, cedar: 10, cup03: 1, lid03: 1, syrup: 15 }],
];
// кальк.кофе column B.
const SOLD: Record<string, number> = {
  "Американо 250": 5, "Американо 350": 3, "Горячий шоколад": 1, "Капучино 250": 3,
  "Капучино 350": 5, "Капучино 450": 4, "Латте 350": 5, "Латте 450": 1,
  "Моккачино": 1, "Эспрессо": 3, "Сироп": 6,
};

describe("coffee shop: sales × recipe card → consumption (кальк.кофе row 28)", () => {
  const sales = frame(Object.entries(SOLD).map(([drink, qty]) => ({ drink, qty })));
  const lines = frame(RECIPE.flatMap(([drink, parts]) =>
    Object.entries(parts).map(([ingredient, amount]) => ({ drink, ingredient, amount }))));
  const pipeline: TransformPipeline = {
    steps: [
      { type: "join", rightSourceId: "recipe", on: { leftKey: "drink", rightKey: "drink" }, how: "inner" },
      { type: "compute", columns: [{ name: "used", expression: "qty * amount" }] },
      { type: "group-by", fields: ["ingredient"] },
      { type: "aggregate", columns: [{ sourceField: "used", outputName: "total", function: "SUM" }] },
    ],
  };
  const out = executeTransform(sales, pipeline, { rightFrames: new Map([["recipe", lines]]) });
  const totals = column(out.data, "ingredient", "total");

  test("cups sold that day: 37 (B28)", () => {
    expect(Object.values(SOLD).reduce((a, b) => a + b, 0)).toBe(37);
  });

  test.each([
    ["coffee", 561],   // C28
    ["milk", 3950],    // D28
    ["chocolate", 50], // E28
    ["cup02", 8],      // L28
    ["lid02", 8],      // M28
    ["cup03", 15],     // N28
    ["lid03", 20],     // O28
    ["cup04", 5],      // P28
    ["syrup", 90],     // S28
  ])("%s consumed: %d", (ingredient, expected) => {
    expect(totals.get(ingredient)).toBe(expected);
  });

  test("an ingredient only unsold drinks use does not appear, rather than showing 0 or its recipe amount", () => {
    expect(totals.has("cedar")).toBe(false);
    expect(totals.has("cup05")).toBe(false);
  });

  test("an unsold drink on the card does not change any total", () => {
    // Раф Кедр also uses coffee, milk and syrup: if its recipe leaked into the
    // totals, coffee would read 578 and syrup 105.
    expect(totals.get("coffee")).toBe(561);
    expect(totals.get("syrup")).toBe(90);
  });
});

// ── ВИТРИНА rows 3–13 ────────────────────────────────────────────────────
// D purchased, E purchase price, G sold, H retail price, K written off to staff.
const CASE: Array<[string, number, number, number, number, number]> = [
  ["Меренга", 3, 97, 0, 210, 1],
  ["Медовик", 0, 64, 0, 170, 0],
  ["Трубочка", 0, 110, 0, 190, 0],
  ["Креманка", 6, 174, 1, 280, 0],
  ["Боул", 5, 250, 1, 410, 0],
  ["Второе", 8, 170, 5, 260, 2],
  ["Салаты", 6, 95, 2, 150, 1],
  ["Роллы", 2, 140, 1, 250, 1],
  ["Каша", 2, 60, 1, 140, 0],
  ["Круассаны", 2, 155, 1, 280, 0],
  ["Блины", 3, 80, 1, 140, 0],
];

describe("coffee shop: display case day (ВИТРИНА row 14)", () => {
  const items = frame(CASE.map(([item, bought, cost, sold, price, staff]) => ({ item, bought, cost, sold, price, staff })));
  const perRow: TransformPipeline = {
    steps: [{
      type: "compute",
      columns: [
        { name: "purchase", expression: "bought * cost" },            // F = D*E
        { name: "revenue", expression: "sold * price" },              // I = G*H
        { name: "writeoff", expression: "staff * cost" },             // N = (K+L+M)*E
        { name: "remaining", expression: "bought - sold - staff" },   // O = D-G-K-L
        { name: "result", expression: "revenue - writeoff - purchase" }, // R = I-N-F
      ],
    }],
  };
  const rows = executeTransform(items, perRow).data;
  const day = executeTransform(rows, {
    steps: [{
      type: "aggregate",
      columns: [
        { sourceField: "purchase", outputName: "purchase", function: "SUM" },
        { sourceField: "revenue", outputName: "revenue", function: "SUM" },
        { sourceField: "writeoff", outputName: "writeoff", function: "SUM" },
        { sourceField: "result", outputName: "result", function: "SUM" },
      ],
    }],
  }).data.records[0]!.values;

  test("purchase F14 = 5465", () => expect(day["purchase"]).toBe(5465));
  test("revenue I14 = 3100", () => expect(day["revenue"]).toBe(3100));
  test("write-offs N14 = 672", () => expect(day["writeoff"]).toBe(672));
  test("day result R14 = −3037", () => expect(day["result"]).toBe(-3037));

  test("a later compute column reads an earlier one in the same step (R reads I, N, F)", () => {
    const meringue = rows.records.find((r) => r.values["item"] === "Меренга")!.values;
    expect(meringue["result"]).toBe(-388); // R3
    expect(meringue["remaining"]).toBe(2); // O3
  });
});

// ── СОТР ─────────────────────────────────────────────────────────────────
// Row 1 carries unit prices: coffee 1830 per kg, milk 109 per litre,
// syrup 1.32 per ml; display items at purchase price.
describe("coffee shop: staff consumption (СОТР row 14)", () => {
  const staff = frame([
    // ЭД: coffee 155.9 g (C4 = 17×8 + 9.9 + 10), milk 150, syrup 15, a креманка (174) and a roll (140).
    { name: "ЭД", coffee: 155.9, milk: 150, syrup: 15, items: 174 + 140 },
    { name: "НАСТЯ", coffee: 17, milk: 140, syrup: 0, items: 0 },
    { name: "ПАША", coffee: 14, milk: 0, syrup: 0, items: 174 },
    { name: "ВАНЯ", coffee: 0, milk: 0, syrup: 0, items: 0 },
  ]);
  const out = executeTransform(staff, {
    steps: [
      {
        type: "compute",
        columns: [
          { name: "drinks", expression: "coffee * 1830 / 1000 + milk * 109 / 1000" }, // G = E + F
          { name: "total", expression: "drinks + syrup * 1.32 + items" },             // V = G + U
        ],
      },
    ],
  }).data;
  const byName = column(out, "name", "total");
  const sum = executeTransform(out, {
    steps: [{ type: "aggregate", columns: [{ sourceField: "total", outputName: "sum", function: "SUM" }] }],
  }).data.records[0]!.values["sum"];

  test("ЭД V4 = 635.447", () => expect(byName.get("ЭД")).toBeCloseTo(635.447, 9));
  test("НАСТЯ V6 = 46.37", () => expect(byName.get("НАСТЯ")).toBeCloseTo(46.37, 9));
  test("ПАША V12 = 199.62", () => expect(byName.get("ПАША")).toBeCloseTo(199.62, 9));
  test("staff total V14 = 881.437", () => expect(sum).toBeCloseTo(881.437, 9));
});
