/**
 * The three demo projects compute what they claim (3.6.0).
 *
 * The demo is the first thing a user sees of the computation features, so
 * its numbers are checked against its own seed data, computed here
 * independently: the massage room's reverse rollups (visits, money, last and
 * average wellbeing per client), its net profit formula, the charts that
 * follow a picked client, and the ids by which the three projects read each
 * other.
 */

import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { applyFormulaFields } from "src/lib/dashboard-engine/applyFormulaFields";
import { computeMultiSeriesChartData } from "src/lib/dashboard-engine/chartDataPipeline";
import { applyRollupColumns } from "src/ui/app/rollupColumns";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import { followLinkedSelection } from "src/ui/views/Dashboard/widgets/_shared/selectionFollow";
import { dataTableSourceId, type SelectionState } from "src/ui/views/Dashboard/canvasSelectionStore";
import type { ChartConfig } from "src/ui/views/Dashboard/types";
import type { FieldConfigRelationMap } from "src/ui/app/viewHelpers";
import { CABINET_FOLDER, type DemoFile } from "../demoShared";
import {
  CABINET_CLIENTS,
  CABINET_EXPENSES,
  CABINET_ROLLUPS,
  CABINET_VISITS,
  NET_FIELD,
  TRACKER_DAYS,
  buildCabinetNotes,
  cabinetFieldConfig,
  cabinetOverview,
  cabinetTable,
  cabinetWidgets,
} from "../demoCabinet";
import { financeWidgets } from "../demoFinance";

const CAB = "cabinet-id";

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

const notes = buildCabinetNotes();
const raw = frameOf(notes, CABINET_FOLDER, ["client", "person"]);
const withRollups = applyRollupColumns(raw, cabinetFieldConfig(CAB) as unknown as FieldConfigRelationMap, CAB, new Map());
const client = (name: string) => withRollups.records.find((r) => r.id === `${CABINET_FOLDER}/${name}.md`)!.values;

describe("the massage room's notes", () => {
  test("five clients, their visits, 21 tracker days for two clients, the expenses", () => {
    const count = (type: string) => raw.records.filter((r) => r.values["type"] === type).length;
    expect(count("client")).toBe(CABINET_CLIENTS.length);
    expect(count("visit")).toBe(CABINET_VISITS.reduce((n, v) => n + v.days.length, 0));
    expect(count("tracker")).toBe(2 * TRACKER_DAYS);
    expect(count("expense")).toBe(CABINET_EXPENSES.length);
  });

  test("a client note carries no computed field", () => {
    const anna = notes["Анна Смирнова"]!.frontmatter;
    for (const col of Object.values(CABINET_ROLLUPS)) expect(anna).not.toHaveProperty(col);
  });
});

describe("the client card is computed from the notes that link the client", () => {
  test.each(CABINET_VISITS.map((v) => [v.client, v] as const))("%s", (name, seed) => {
    const c = client(name);
    expect(c[CABINET_ROLLUPS.visits]).toBe(seed.days.length);
    expect(c[CABINET_ROLLUPS.spent]).toBe(seed.days.length * seed.price);
    // The last visit's wellbeing is the end of its ramp.
    expect(c[CABINET_ROLLUPS.last]).toBe(seed.after[1]);
    expect(c[CABINET_ROLLUPS.avg] as number).toBeGreaterThanOrEqual(seed.after[0]);
    expect(c[CABINET_ROLLUPS.avg] as number).toBeLessThanOrEqual(seed.after[1]);
  });
});

describe("net profit = income − expenses", () => {
  test("the dashboard formula sums to the seeds' income minus their expenses", () => {
    const withNet = applyFormulaFields(withRollups, cabinetOverview(cabinetTable).formulaFields);
    const net = withNet.records.reduce((s, r) => s + (Number(r.values[NET_FIELD]) || 0), 0);
    const income = CABINET_VISITS.reduce((s, v) => s + v.days.length * v.price, 0);
    const spent = CABINET_EXPENSES.reduce((s, e) => s + e.amount, 0);
    expect(net).toBe(income - spent);
  });
});

describe("the client charts follow the picked client", () => {
  const widgets = cabinetWidgets();
  const table = widgets.find((w) => w.title === "Клиенты")!;
  const chart = widgets.find((w) => w.title === "Самочувствие и тесты трекера")!;
  const cfg = chart.config as unknown as ChartConfig & { subFilter: never };
  const picked: SelectionState = { source: dataTableSourceId(table.id), field: "name", values: ["Анна Смирнова"], op: "is" } as SelectionState;

  test("the chart follows the clients table", () => {
    expect(cfg.linkedSelection?.sourceWidgetId).toBe(table.id);
  });

  test("with Анна picked: her visits and her tracker days only", () => {
    const input = applyFilter(withRollups, cfg.subFilter);
    const narrow = (frame: DataFrame, s?: { selectionField?: string }) => {
      const rel = s ? s.selectionField : cfg.linkedSelection!.relationField;
      return { ...frame, records: [...followLinkedSelection(frame.records, picked, { ...cfg.linkedSelection!, relationField: rel! })] };
    };
    const data = computeMultiSeriesChartData(input, cfg, new Map(), undefined, narrow);
    const visitPoints = data.series[0]!.values.filter((v) => v !== null).length;
    const moodPoints = data.series[1]!.values.filter((v) => v !== null).length;
    expect(visitPoints).toBe(CABINET_VISITS.find((v) => v.client === "Анна Смирнова")!.days.length);
    expect(moodPoints).toBe(TRACKER_DAYS);
  });
});

describe("the projects read each other by id", () => {
  test("personal finances read the room and the studio", () => {
    const ids = { cabinetId: "C", studioId: "S" };
    const refs = financeWidgets(ids).flatMap((w) => {
      const c = w.config as { dataProjectId?: string; series?: Array<{ dataProjectId?: string }> };
      return [c.dataProjectId, ...(c.series ?? []).map((s) => s.dataProjectId)].filter(Boolean);
    });
    expect(new Set(refs)).toEqual(new Set(["C", "S"]));
  });

  test("the room's rollups read the room itself", () => {
    const fc = cabinetFieldConfig(CAB) as unknown as Record<string, { rollup?: { backlink?: { projectId: string } } }>;
    for (const col of Object.values(CABINET_ROLLUPS)) expect(fc[col]?.rollup?.backlink?.projectId).toBe(CAB);
  });
});
