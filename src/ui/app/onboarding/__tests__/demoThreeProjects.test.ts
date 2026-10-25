/**
 * The demo (3.6.1): three new linked projects — a massage practice, a daily
 * tracker and a personal budget — each at least the size of the single demo
 * they replace (40 notes, five views of four kinds), with cross-table and
 * cross-project computation that the numbers below re-derive independently
 * from the notes themselves.
 */

import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { applyComputedColumns } from "src/lib/relations/computedColumns";
import { CABINET_FOLDER, DEMO_NAMES, FINANCE_FOLDER, TRACKER_FOLDER, type DemoFile } from "../demoShared";
import { CABINET_CLIENTS, CABINET_ROLLUPS, CABINET_SERVICES, buildCabinetCovers, buildCabinetNotes, cabinetFieldConfig } from "../demoCabinet";
import { TRACKER_PEOPLE, buildTrackerNotes } from "../demoTracker";
import { FINANCE_CATEGORIES, FINANCE_ROLLUPS, buildFinanceNotes, financeFieldConfig } from "../demoFinance";
import { demoProjects } from "../demoProject";

const ids = { cabinetId: "cabinet", trackerId: "tracker", financeId: "finance" };

function frameOf(files: Record<string, DemoFile>, folder: string, relations: string[]): DataFrame {
  const records = Object.entries(files).map(([name, f]) => ({
    id: `${folder}/${name}.md`,
    values: { name, ...f.frontmatter } as Record<string, DataValue>,
  }));
  const names = [...new Set(records.flatMap((r) => Object.keys(r.values)))];
  return {
    fields: names.map((n) => ({
      name: n,
      type: relations.includes(n)
        ? DataFieldType.Relation
        : records.some((r) => typeof r.values[n] === "number") ? DataFieldType.Number : DataFieldType.String,
      repeated: false,
      identifier: n === "name",
      derived: false,
    })),
    records,
  } as unknown as DataFrame;
}

const cabinetNotes = buildCabinetNotes();
const trackerNotes = buildTrackerNotes();
const financeNotes = buildFinanceNotes();
const cabinetRaw = frameOf(cabinetNotes, CABINET_FOLDER, ["client", "service"]);
const trackerRaw = frameOf(trackerNotes, TRACKER_FOLDER, ["person"]);
const financeRaw = frameOf(financeNotes, FINANCE_FOLDER, ["category"]);
// w4-p01b: computed as the plugin computes a project — formulas and rollups in
// dependency order — and checked against values derived here from the notes'
// own fields (status, paid, price, kind, amount), not from computed copies.
const cabinetConfig = cabinetFieldConfig(ids) as never;
const cabinet = applyComputedColumns(cabinetRaw, cabinetConfig, ids.cabinetId, new Map([[ids.trackerId, trackerRaw]]));
const finance = applyComputedColumns(financeRaw, financeFieldConfig(ids) as never, ids.financeId, new Map());

const ofType = (frame: DataFrame, type: string) => frame.records.filter((r) => r.values["type"] === type);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const held = (v: { values: Record<string, unknown> }) => v.values["status"] === "проведён";
const paidOf = (v: { values: Record<string, unknown> }) => (held(v) && v.values["paid"] === true ? num(v.values["price"]) : 0);
const debtOf = (v: { values: Record<string, unknown> }) => (held(v) && v.values["paid"] !== true ? num(v.values["price"]) : 0);
const linking = (frame: DataFrame, field: string, name: string) => frame.records.filter((r) => r.values[field] === `[[${name}]]`);

describe("scale: each project at least the size of the old demo", () => {
  test("notes per project", () => {
    expect(Object.keys(cabinetNotes).length).toBeGreaterThanOrEqual(150);
    expect(Object.keys(trackerNotes).length).toBeGreaterThanOrEqual(150);
    expect(Object.keys(financeNotes).length).toBeGreaterThanOrEqual(80);
  });

  test.each(demoProjects(ids).map((p) => [p.name, p] as const))("%s has five views of at least three kinds", (_name, p) => {
    expect(p.views).toHaveLength(5);
    expect(new Set(p.views.map((v) => v.type)).size).toBeGreaterThanOrEqual(3);
    expect(p.views.map((v) => v.type)).toContain("dashboard");
  });

  test("the three projects are the new ones, the studio is gone", () => {
    expect(demoProjects(ids).map((p) => p.name)).toEqual([DEMO_NAMES.cabinet, DEMO_NAMES.tracker, DEMO_NAMES.finance]);
  });
});

describe("the practice's notes", () => {
  test("services, clients, visits and expenses", () => {
    expect(ofType(cabinetRaw, "service")).toHaveLength(CABINET_SERVICES.length);
    expect(ofType(cabinetRaw, "client")).toHaveLength(CABINET_CLIENTS.length);
    expect(ofType(cabinetRaw, "visit").length).toBeGreaterThanOrEqual(120);
    expect(ofType(cabinetRaw, "expense").length).toBeGreaterThanOrEqual(25);
  });

  test("past visits are held or cancelled, future ones are planned", () => {
    const statuses = new Set(ofType(cabinetRaw, "visit").map((r) => r.values["status"]));
    expect(statuses).toEqual(new Set(["проведён", "отменён", "запланирован"]));
  });

  test("every client has an offline cover the gallery can show", () => {
    const covers = buildCabinetCovers();
    for (const c of CABINET_CLIENTS) {
      const link = String(cabinetNotes[c.name]!.frontmatter["cover"]);
      const file = link.replace(/^\[\[|\]\]$/g, "");
      expect(covers[file]).toMatch(/^<svg /);
    }
  });

  test("a client note carries no computed field", () => {
    for (const c of CABINET_CLIENTS) {
      for (const col of Object.values(CABINET_ROLLUPS)) expect(cabinetNotes[c.name]!.frontmatter).not.toHaveProperty(col);
    }
  });
});

describe("the client card is computed from the notes that link the client", () => {
  test.each(CABINET_CLIENTS.map((c) => [c.name] as const))("%s", (name) => {
    const card = cabinet.records.find((r) => r.id === `${CABINET_FOLDER}/${name}.md`)!.values;
    const visits = linking(cabinetRaw, "client", name);
    const done = visits.filter(held);
    expect(card[CABINET_ROLLUPS.sessions]).toBe(done.length);
    expect(card[CABINET_ROLLUPS.paid]).toBe(sum(visits.map(paidOf)));
    const debt = sum(visits.map(debtOf));
    if (debt > 0) expect(card[CABINET_ROLLUPS.debt]).toBe(debt);
    const ordered = [...done].sort((a, b) => String(a.values["date"]).localeCompare(String(b.values["date"])));
    expect(card[CABINET_ROLLUPS.last]).toBe(ordered[ordered.length - 1]!.values["wellbeingAfter"]);

    const log = linking(trackerRaw, "person", name);
    if (log.length > 0) {
      const byDate = [...log].sort((a, b) => String(a.values["date"]).localeCompare(String(b.values["date"])));
      expect(card[CABINET_ROLLUPS.weight]).toBe(byDate[byDate.length - 1]!.values["weight"]);
      expect(card[CABINET_ROLLUPS.training]).toBe(sum(log.map((r) => num(r.values["trainingMinutes"]))));
    }
  });

  test("three clients keep a tracker log; the others have none", () => {
    const withLog = CABINET_CLIENTS.filter((c) => linking(trackerRaw, "person", c.name).length > 0).map((c) => c.name);
    expect(withLog).toEqual(TRACKER_PEOPLE.map((p) => p.person));
  });

  test("a service counts its sessions and revenue", () => {
    for (const s of CABINET_SERVICES) {
      const card = cabinet.records.find((r) => r.id === `${CABINET_FOLDER}/${s.name}.md`)!.values;
      const visits = linking(cabinetRaw, "service", s.name);
      expect(card[CABINET_ROLLUPS.revenue]).toBe(sum(visits.map(paidOf)));
      expect(card[CABINET_ROLLUPS.serviceSessions]).toBe(visits.filter(held).length);
      expect(card[CABINET_ROLLUPS.serviceSessions]).toBeGreaterThan(0);
    }
  });
});

describe("the practice's profit", () => {
  test("net = payments of held visits − expenses, and profit is positive over the half-year", () => {
    const payments = sum(ofType(cabinetRaw, "visit").map(paidOf));
    const expenses = sum(ofType(cabinetRaw, "expense").map((e) => num(e.values["amount"])));
    const net = sum(cabinet.records.map((r) => num(r.values["net"])));
    expect(net).toBe(payments - expenses);
    expect(net).toBeGreaterThan(0);
  });

  test("the notes carry no computed money: it follows status, payment and price", () => {
    for (const v of ofType(cabinetRaw, "visit")) {
      for (const key of ["sessions", "paidAmount", "debt", "net"]) expect(v.values).not.toHaveProperty(key);
    }
  });

  test("unticking a payment moves the client's total and debt (acceptance 26.10, N4)", () => {
    const visit = ofType(cabinetRaw, "visit").find((v) => held(v) && v.values["paid"] === true)!;
    const client = String(visit.values["client"]).replace(/^\[\[|\]\]$/g, "");
    const cardOf = (frame: DataFrame) => frame.records.find((r) => r.id === `${CABINET_FOLDER}/${client}.md`)!.values;
    const before = cardOf(cabinet);
    const changed: DataFrame = {
      ...cabinetRaw,
      records: cabinetRaw.records.map((r) => (r === visit ? { ...r, values: { ...r.values, paid: false } } : r)),
    };
    const after = cardOf(applyComputedColumns(changed, cabinetConfig, ids.cabinetId, new Map([[ids.trackerId, trackerRaw]])));
    const price = num(visit.values["price"]);
    expect(after[CABINET_ROLLUPS.paid]).toBe(num(before[CABINET_ROLLUPS.paid]) - price);
    expect(after[CABINET_ROLLUPS.debt]).toBe(num(before[CABINET_ROLLUPS.debt]) + price);
  });
});

describe("the budget", () => {
  test("a category sums what went through it", () => {
    for (const c of FINANCE_CATEGORIES) {
      const card = finance.records.find((r) => r.id === `${FINANCE_FOLDER}/${c.name}.md`)!.values;
      const ops = linking(financeRaw, "category", c.name);
      expect(ops.length).toBeGreaterThan(0);
      expect(card[FINANCE_ROLLUPS.total]).toBe(sum(ops.map((o) => num(o.values["amount"]))));
      expect(card[FINANCE_ROLLUPS.count]).toBe(ops.length);
    }
  });

  test("balance = income − expenses", () => {
    const ops = ofType(financeRaw, "op");
    const income = sum(ops.filter((o) => o.values["kind"] === "Доход").map((o) => num(o.values["amount"])));
    const expense = sum(ops.filter((o) => o.values["kind"] === "Расход").map((o) => num(o.values["amount"])));
    expect(sum(finance.records.map((r) => num(r.values["income"])))).toBe(income);
    expect(sum(finance.records.map((r) => num(r.values["expense"])))).toBe(expense);
    expect(sum(finance.records.map((r) => num(r.values["balance"])))).toBe(income - expense);
    expect(income - expense).toBeGreaterThan(0);
  });

  test("an operation's income, expense and balance follow its amount", () => {
    const op = ofType(financeRaw, "op").find((o) => o.values["kind"] === "Расход")!;
    expect(op.values).not.toHaveProperty("expense");
    const changed: DataFrame = {
      ...financeRaw,
      records: financeRaw.records.map((r) => (r === op ? { ...r, values: { ...r.values, amount: 777 } } : r)),
    };
    const out = applyComputedColumns(changed, financeFieldConfig(ids) as never, ids.financeId, new Map());
    const row = out.records.find((r) => r.id === op.id)!.values;
    expect(row["expense"]).toBe(777);
    expect(row["balance"]).toBe(-777);
  });
});

describe("the projects read each other by id", () => {
  const [cab, trk, fin] = demoProjects(ids);
  const widgets = (p: typeof cab) => p!.views.flatMap((v) => ((v.config as { widgets?: Array<{ config: Record<string, unknown>; sourceConfig?: { projectId?: string } }> }).widgets ?? []));
  const reads = (p: typeof cab) => JSON.stringify(widgets(p));

  test("the finances read the practice", () => {
    expect(reads(fin)).toContain(`"dataProjectId":"${ids.cabinetId}"`);
  });

  test("the tracker reads the practice's clients and its wellbeing series", () => {
    expect(widgets(trk).some((w) => w.sourceConfig?.projectId === ids.cabinetId)).toBe(true);
    expect(reads(trk)).toContain(`"dataProjectId":"${ids.cabinetId}"`);
  });

  test("the practice reads the tracker (rollups and a chart series)", () => {
    expect(JSON.stringify(cab!.fieldConfig)).toContain(`"projectId":"${ids.trackerId}"`);
    expect(reads(cab)).toContain(`"dataProjectId":"${ids.trackerId}"`);
  });

  test("every linked block and following chart names a widget of its own dashboard", () => {
    for (const p of [cab, trk, fin]) {
      for (const v of p!.views) {
        const ws = (v.config as { widgets?: Array<{ id: string; config: { linkedSelection?: { sourceWidgetId: string } } }> }).widgets ?? [];
        const own = new Set(ws.map((w) => w.id));
        for (const w of ws) if (w.config.linkedSelection) expect(own.has(w.config.linkedSelection.sourceWidgetId)).toBe(true);
      }
    }
  });

  // Codex review of ccc13ee: «До визита» kept averaging every client while
  // «После визита» followed the picked one. A following chart narrows an extra
  // series only by the field that series declares.
  test("every series of a following chart follows the selection too", () => {
    for (const p of [cab, trk, fin]) {
      for (const v of p!.views) {
        const ws = (v.config as { widgets?: Array<{ title?: string; config: { linkedSelection?: unknown; series?: Array<{ id: string; selectionField?: string }> } }> }).widgets ?? [];
        for (const w of ws) {
          if (!w.config.linkedSelection) continue;
          for (const s of w.config.series ?? []) expect(`${w.title}/${s.id}:${s.selectionField ?? ""}`).not.toMatch(/:$/);
        }
      }
    }
  });
});
