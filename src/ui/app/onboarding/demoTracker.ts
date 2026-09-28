// ============================================================
// Demo — «Трекер»: daily self-tracking of three clients (3.6.1).
//
// Story: three clients of the massage practice keep a daily log — weight,
// sleep, mood, energy, pain and training. Each entry links its person in the
// practice project (`person`), so:
// - the practice's client cards read the current weight, training minutes
//   and sleep from here (reverse rollups across projects);
// - this project's charts follow the client picked in a table that reads the
//   practice, and put the practice's own wellbeing-after-visit next to the
//   log's mood (a series from another project).
// About a sixth of the days have no entry: a missing day is a gap, not a 0.
// ============================================================

import type { FieldConfig } from "src/settings/base/settings";
import type { BoardConfig } from "src/ui/views/Board/types";
import type { CalendarConfig } from "src/ui/views/Calendar/types";
import type { DatabaseViewConfig, WidgetDefinition } from "src/ui/views/Dashboard/types";
import type { ViewDefinition } from "src/settings/base/settings";
import { tableTabConfig } from "src/ui/views/Dashboard/widgets/legacyMigration";
import { CABINET_CLIENTS_TABLE } from "./demoCabinet";
import {
  CHART_STYLE, clamp, dayOf, demoView, ramp, rng, seq, tableOf, typeScope, widgetId, wikilink,
  type DemoFile, type DemoIds,
} from "./demoShared";

interface Training { type: string; minutes: number }
export interface PersonSeed {
  person: string;
  days: number;
  weight: [number, number];
  sleep: [number, number];
  mood: [number, number];
  pain: [number, number];
  week: Training[];
}

const REST: Training = { type: "Отдых", minutes: 0 };

export const TRACKER_PEOPLE: PersonSeed[] = [
  {
    person: "Анна Смирнова", days: 140, weight: [66.5, 63.8], sleep: [6, 7.5], mood: [4, 8], pain: [7, 2],
    week: [{ type: "Йога", minutes: 30 }, REST, { type: "Бег", minutes: 25 }, REST, { type: "Силовая", minutes: 40 }, { type: "Йога", minutes: 30 }, REST],
  },
  {
    person: "Борис Кузнецов", days: 100, weight: [84, 81.5], sleep: [7, 7.5], mood: [6, 8], pain: [4, 2],
    week: [{ type: "Бег", minutes: 50 }, { type: "Силовая", minutes: 60 }, REST, { type: "Бег", minutes: 45 }, { type: "Плавание", minutes: 40 }, { type: "Силовая", minutes: 60 }, REST],
  },
  {
    person: "Илья Фёдоров", days: 45, weight: [72, 70.8], sleep: [7, 6.5], mood: [7, 8], pain: [2, 3],
    week: [{ type: "Бег", minutes: 60 }, { type: "Бег", minutes: 40 }, REST, { type: "Бег", minutes: 90 }, { type: "Силовая", minutes: 40 }, { type: "Бег", minutes: 30 }, { type: "Бег", minutes: 120 }],
  },
];

export const TRAINING_COLORS: Record<string, string> = {
  "Бег": "#2196F3",
  "Силовая": "#F44336",
  "Йога": "#9C27B0",
  "Плавание": "#00BCD4",
  "Отдых": "#9E9E9E",
};

export function buildTrackerNotes(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  TRACKER_PEOPLE.forEach((p, pi) => {
    const random = rng(3000 + pi);
    let n = 0;
    for (let i = 0; i < p.days; i++) {
      const skip = random() < 0.16;
      const noise = random() * 2 - 1;
      if (skip) continue;
      const day = i - p.days + 1;
      const t = p.week[i % p.week.length]!;
      const mood = clamp(ramp(p.mood[0], p.mood[1], i, p.days) + Math.round(noise), 1, 10);
      out[`Запись ${p.person} ${seq(++n)}`] = {
        frontmatter: {
          type: "entry",
          date: dayOf(day),
          person: wikilink(p.person),
          weight: Math.round((ramp(p.weight[0], p.weight[1], i, p.days, 1) + noise * 0.3) * 10) / 10,
          sleep: Math.round(clamp(ramp(p.sleep[0], p.sleep[1], i, p.days, 1) + noise * 0.5, 4, 10) * 2) / 2,
          mood,
          energy: clamp(mood + (t.minutes > 0 ? 1 : 0) - (random() < 0.2 ? 1 : 0), 1, 10),
          pain: clamp(ramp(p.pain[0], p.pain[1], i, p.days) + Math.round(noise * 0.6), 0, 10),
          trainingType: t.type,
          trainingMinutes: t.minutes,
          color: TRAINING_COLORS[t.type],
          tags: ["entry"],
        },
        content: "",
      };
    }
  });
  return out;
}

export function trackerFieldConfig(ids: DemoIds): { [field: string]: FieldConfig } {
  return {
    date: { time: false },
    person: { relation: { targetProjectId: ids.cabinetId } },
  };
}

const ENTRY_FIELDS = ["date", "person", "weight", "sleep", "mood", "energy", "pain", "trainingType", "trainingMinutes", "color", "person_backlinks"];

const JOURNAL_TABLE = tableOf(
  ["name", "date", "person", "weight", "sleep", "mood", "energy", "pain", "trainingType", "trainingMinutes"],
  ENTRY_FIELDS,
  { name: 230, date: 110, person: 160 },
  { weight: "avg", sleep: "avg", mood: "avg", energy: "avg", pain: "avg", trainingMinutes: "sum", name: "count_total" }
);

export function trackerDynamicsWidgets(ids: DemoIds): WidgetDefinition[] {
  const people = widgetId();
  const follow = { sourceWidgetId: people, relationField: "person" };
  return [
    {
      id: widgetId(),
      type: "text",
      title: "Как читать трекер",
      layout: { x: 0, y: 0, w: 12, h: 1 },
      config: {
        content: "Таблица ниже читает клиентов из проекта «Демо: Массажный кабинет» — только для чтения; её колонки вес, тренировки и сон считаются из записей этого трекера. Сначала выберите клиента (меню строки → «Фильтровать связанные блоки по этой строке»): показатели и графики покажут только его — без выбора они усредняют всех троих. Линия «Самочувствие после визита» приходит из визитов кабинета.",
      },
    },
    {
      id: people,
      type: "database-call",
      title: "Клиенты кабинета",
      layout: { x: 0, y: 1, w: 12, h: 4 },
      sourceConfig: { projectId: ids.cabinetId },
      config: { ...tableTabConfig(CABINET_CLIENTS_TABLE, "Таблица"), subFilter: typeScope("client") },
    },
    {
      id: widgetId(),
      type: "stats",
      title: "Показатели клиента",
      layout: { x: 0, y: 5, w: 12, h: 2 },
      config: {
        linkedSelection: follow,
        cards: [
          { id: "t1", label: "Средний сон, ч",     field: "sleep",           aggregation: "avg" },
          { id: "t2", label: "Среднее настроение", field: "mood",            aggregation: "avg" },
          { id: "t3", label: "Средняя боль",       field: "pain",            aggregation: "avg" },
          { id: "t4", label: "Тренировки, мин",    field: "trainingMinutes", aggregation: "sum" },
        ],
        columns: 4,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Вес и тренировки клиента",
      layout: { x: 0, y: 7, w: 12, h: 4 },
      config: {
        chartType: "line",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "week" },
        yAxis: { label: "Вес, кг", property: "weight", aggregation: "avg" },
        linkedSelection: follow,
        series: [
          { id: "s-train", label: "Тренировки, мин", property: "trainingMinutes", aggregation: "sum", axis: "right", selectionField: "person" },
        ],
        style: CHART_STYLE,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Настроение, энергия, боль и самочувствие после визита — клиента",
      layout: { x: 0, y: 11, w: 12, h: 4 },
      config: {
        chartType: "line",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "week" },
        yAxis: { label: "Настроение", property: "mood", aggregation: "avg" },
        linkedSelection: follow,
        series: [
          { id: "s-energy", label: "Энергия", property: "energy", aggregation: "avg", selectionField: "person" },
          { id: "s-pain", label: "Боль", property: "pain", aggregation: "avg", selectionField: "person" },
          { id: "s-visit", label: "Самочувствие после визита", property: "wellbeingAfter", aggregation: "avg", dataProjectId: ids.cabinetId, xProperty: "date", selectionField: "client" },
        ],
        style: { ...CHART_STYLE, smooth: true },
      },
    },
  ];
}

export function trackerWeeksWidgets(): WidgetDefinition[] {
  return [
    {
      id: widgetId(),
      type: "chart",
      title: "Минуты тренировок по неделям",
      layout: { x: 0, y: 0, w: 12, h: 4 },
      config: {
        chartType: "bar",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "week" },
        yAxis: { label: "Минуты", property: "trainingMinutes", aggregation: "sum" },
        series: [{ id: "s-sleep", label: "Сон, ч (среднее)", property: "sleep", aggregation: "avg", axis: "right" }],
        style: CHART_STYLE,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Сон и настроение",
      layout: { x: 0, y: 4, w: 6, h: 4 },
      config: {
        chartType: "scatter",
        xAxis: { property: "sleep", sortBy: "label", sortOrder: "asc", omitZero: false },
        yAxis: { property: "mood", aggregation: "avg" },
        colorBy: "trainingType",
        showTrendLine: true,
        showR2: true,
        style: CHART_STYLE,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Минуты по видам тренировок",
      layout: { x: 6, y: 4, w: 6, h: 4 },
      config: {
        chartType: "donut",
        xAxis: { property: "trainingType", sortBy: "value", sortOrder: "desc", omitZero: true },
        yAxis: { property: "trainingMinutes", aggregation: "sum" },
        style: { ...CHART_STYLE, showGrid: false, showValues: true },
      },
    },
  ];
}

export function trackerJournalWidgets(): WidgetDefinition[] {
  return [
    {
      id: widgetId(),
      type: "database-call",
      title: "Все записи",
      layout: { x: 0, y: 0, w: 12, h: 8 },
      config: { ...tableTabConfig(JOURNAL_TABLE, "Таблица"), subFilter: typeScope("entry") },
    },
  ];
}

const dashboard = (widgets: WidgetDefinition[]): DatabaseViewConfig => ({
  widgets,
  table: tableOf([], []),
  layoutMode: "stack",
  layoutVersion: 1,
  showWidgetToolbar: true,
  compactMode: false,
});

const calendar: CalendarConfig = {
  interval: "month",
  displayMode: "bars",
  startDateField: "date",
  dateField: "date",
  eventColorField: "color",
  startHour: 6,
  endHour: 22,
  timezone: "local",
  timeFormat: "24h",
  agendaOpen: false,
};

const board: BoardConfig = {
  groupByField: "trainingType",
  headerField: "person",
  includeFields: ["date", "trainingMinutes", "mood", "pain"],
  columns: { "Бег": { weight: 1 }, "Силовая": { weight: 1 }, "Йога": { weight: 1 }, "Плавание": { weight: 1 } },
};

const training = {
  conjunction: "and" as const,
  conditions: [{ field: "trainingMinutes", operator: "gt" as const, value: "0", enabled: true }],
};

/** The five views of the log. */
export function trackerViews(ids: DemoIds): ViewDefinition[] {
  const byDateDesc = { criteria: [{ field: "date", order: "desc" as const, enabled: true }] };
  return [
    demoView("Динамика", "dashboard", dashboard(trackerDynamicsWidgets(ids)) as unknown as Record<string, unknown>),
    demoView("Календарь тренировок", "calendar", calendar as unknown as Record<string, unknown>, training),
    demoView("Виды тренировок", "board", board as unknown as Record<string, unknown>, training, byDateDesc),
    demoView("Недели", "dashboard", dashboard(trackerWeeksWidgets()) as unknown as Record<string, unknown>),
    demoView("Журнал", "dashboard", dashboard(trackerJournalWidgets()) as unknown as Record<string, unknown>, undefined, byDateDesc),
  ];
}
