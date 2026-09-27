// ============================================================
// Demo — «Кабинет»: a private massage practice (3.6.0).
//
// Story: one therapist, five clients. A client is ONE note; everything the
// card shows about them is computed from the notes that link them —
// visits (by `client`) and the daily tracker (by `person`) — through
// reverse rollups, with no list of visits kept in the client note.
//
// Shows: backlink rollups (visit count, last and average wellbeing, money
// spent), a dashboard formula (net = income − expenses), a bar+line chart
// of income, expenses and profit by month (profit can go negative), and
// charts that follow the client picked in the clients table — wellbeing
// against the tracker's tests, weight against training minutes on a second
// axis. The studio pays for its employee's sessions (payer: «Студия»); the
// studio and personal-finance demos read this project for that.
// ============================================================

import type { FieldConfig } from "src/settings/base/settings";
import type { CalendarConfig } from "src/ui/views/Calendar/types";
import type { DatabaseViewConfig, WidgetDefinition } from "src/ui/views/Dashboard/types";
import { tableTabConfig } from "src/ui/views/Dashboard/widgets/legacyMigration";
import { dayOf, seq, datedScope, typeScope, widgetId, wikilink, type DemoFile } from "./demoShared";

interface ClientSeed { name: string; since: number; goal: string }
interface VisitSeed {
  client: string;
  days: number[];
  service: string;
  duration: number;
  price: number;
  /** Wellbeing before → after, first and last visit; the visits in between climb evenly. */
  before: [number, number];
  after: [number, number];
  payer: "Клиент" | "Студия";
}
interface TrackerSeed { person: string; weight: [number, number]; training: number[]; mood: [number, number] }
interface ExpenseSeed { category: string; day: number; amount: number }

export const CABINET_CLIENTS: ClientSeed[] = [
  { name: "Анна Смирнова",  since: -90, goal: "Боль в шее после офисной работы" },
  { name: "Борис Кузнецов", since: -60, goal: "Восстановление после тренировок" },
  { name: "Вера Павлова",   since: -45, goal: "Стресс и сон" },
  { name: "Глеб Орлов",     since: -30, goal: "Корпоративный велнес: оплачивает студия" },
  { name: "Дарья Лебедева", since: -14, goal: "Курс лимфодренажа" },
];

export const CABINET_VISITS: VisitSeed[] = [
  { client: "Анна Смирнова",  days: [-84, -70, -56, -42, -28, -14, -3], service: "Классический",  duration: 60, price: 3000, before: [4, 6], after: [6, 9], payer: "Клиент" },
  { client: "Борис Кузнецов", days: [-58, -44, -30, -16, -2],           service: "Спортивный",    duration: 90, price: 4500, before: [5, 6], after: [7, 8], payer: "Клиент" },
  { client: "Вера Павлова",   days: [-40, -26, -12],                    service: "Релакс",        duration: 60, price: 3200, before: [3, 5], after: [6, 8], payer: "Клиент" },
  { client: "Глеб Орлов",     days: [-28, -21, -14, -7],                service: "Классический",  duration: 60, price: 3000, before: [4, 6], after: [7, 8], payer: "Студия" },
  { client: "Дарья Лебедева", days: [-13, -10, -6],                     service: "Лимфодренаж",   duration: 90, price: 5000, before: [5, 6], after: [7, 8], payer: "Клиент" },
];

/** 21 days of a daily tracker for two clients. */
export const CABINET_TRACKER: TrackerSeed[] = [
  { person: "Анна Смирнова", weight: [64.2, 62.9], training: [0, 30, 45, 0, 30, 60, 0], mood: [5, 8] },
  { person: "Глеб Орлов",    weight: [86.0, 84.4], training: [40, 0, 60, 20, 0, 45, 30], mood: [4, 7] },
];
export const TRACKER_DAYS = 21;

export const CABINET_EXPENSES: ExpenseSeed[] = [
  { category: "Аренда",  day: -85, amount: 15000 },
  { category: "Аренда",  day: -55, amount: 15000 },
  { category: "Аренда",  day: -25, amount: 15000 },
  { category: "Масла",   day: -80, amount: 2400 },
  { category: "Масла",   day: -40, amount: 2600 },
  { category: "Масла",   day: -10, amount: 2400 },
  { category: "Бельё",   day: -75, amount: 1800 },
  { category: "Бельё",   day: -35, amount: 1800 },
  { category: "Реклама", day: -20, amount: 5000 },
];

/** Evenly from `a` to `b` over `n` steps, rounded to `digits`. */
const ramp = (a: number, b: number, i: number, n: number, digits = 0) => {
  const scale = 10 ** digits;
  return Math.round((a + ((b - a) * i) / Math.max(n - 1, 1)) * scale) / scale;
};

export function buildCabinetClients(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  for (const s of CABINET_CLIENTS) {
    out[s.name] = {
      frontmatter: { type: "client", since: dayOf(s.since), goal: s.goal, tags: ["client"] },
      content: `## Клиент\n\n**Запрос:** ${s.goal}\n\nВизиты, самочувствие и оплаты этой карточки считаются из заметок визитов и трекера, которые ссылаются сюда. В самой карточке их нет.\n`,
    };
  }
  return out;
}

export function buildCabinetVisits(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  for (const s of CABINET_VISITS) {
    s.days.forEach((day, i) => {
      const date = dayOf(day);
      out[`Визит ${s.client} ${seq(i + 1)}`] = {
        frontmatter: {
          type: "visit",
          date,
          client: wikilink(s.client),
          service: s.service,
          duration: s.duration,
          price: s.price,
          wellbeingBefore: ramp(s.before[0], s.before[1], i, s.days.length),
          wellbeingAfter: ramp(s.after[0], s.after[1], i, s.days.length),
          payer: s.payer,
          tags: ["visit"],
        },
        content: `## Визит\n\n**Услуга:** ${s.service}, ${s.duration} мин.\n\n### Заметки\n*Что делали, как отреагировал клиент.*\n`,
      };
    });
  }
  return out;
}

export function buildCabinetTracker(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  for (const s of CABINET_TRACKER) {
    for (let i = 0; i < TRACKER_DAYS; i++) {
      const date = dayOf(i - TRACKER_DAYS + 1);
      const mood = ramp(s.mood[0], s.mood[1], i, TRACKER_DAYS);
      out[`Трекер ${s.person} ${seq(i + 1)}`] = {
        frontmatter: {
          type: "tracker",
          date,
          person: wikilink(s.person),
          // Psychological and physiological self-tests, 1–10.
          mood,
          energy: Math.min(10, mood + (i % 3 === 0 ? 1 : 0)),
          weight: ramp(s.weight[0], s.weight[1], i, TRACKER_DAYS, 1),
          training: s.training[i % s.training.length],
          tags: ["tracker"],
        },
        content: "",
      };
    }
  }
  return out;
}

export function buildCabinetExpenses(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  CABINET_EXPENSES.forEach((s, n) => {
    const date = dayOf(s.day);
    out[`Расход ${s.category} ${seq(n + 1)}`] = {
      frontmatter: { type: "expense", date, category: s.category, amount: s.amount, tags: ["expense"] },
      content: "",
    };
  });
  return out;
}

export function buildCabinetNotes(): Record<string, DemoFile> {
  return { ...buildCabinetClients(), ...buildCabinetVisits(), ...buildCabinetTracker(), ...buildCabinetExpenses() };
}

/**
 * The computed columns of a client. Named in the user's language: they exist
 * only in the view, never as keys in a note.
 */
export const CABINET_ROLLUPS = {
  visits: "Визитов",
  last: "Последнее самочувствие",
  avg: "Среднее самочувствие",
  spent: "Оплачено",
} as const;

/** The dashboard formula: net = income − expenses. */
export const NET_FIELD = "Прибыль";

/** Relations and reverse rollups: the client card is computed from the notes that link it. */
export function cabinetFieldConfig(cabinetId: string): { [field: string]: FieldConfig } {
  const fromVisits = (targetField: string, fn: string, extra: Record<string, unknown> = {}) => ({
    rollup: {
      relationField: "",
      targetField,
      function: fn,
      backlink: { projectId: cabinetId, relationField: "client" },
      ...extra,
    },
  });
  return {
    date: { time: false },
    since: { time: false },
    client: { relation: { targetProjectId: cabinetId } },
    person: { relation: { targetProjectId: cabinetId } },
    [CABINET_ROLLUPS.visits]: fromVisits("price", "count_values"),
    [CABINET_ROLLUPS.last]: fromVisits("wellbeingAfter", "last_value", { orderBy: "date" }),
    [CABINET_ROLLUPS.avg]: fromVisits("wellbeingAfter", "avg"),
    [CABINET_ROLLUPS.spent]: fromVisits("price", "sum"),
  } as unknown as { [field: string]: FieldConfig };
}

const CHART_STYLE = { colorScheme: "categorical", height: "medium", showGrid: true, showLabels: true, showLegend: true, showValues: false } as const;

export function cabinetWidgets(): WidgetDefinition[] {
  const clientsTable = widgetId();
  return [
    {
      id: widgetId(),
      type: "stats",
      title: "Кабинет в цифрах",
      layout: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { id: "k1", label: "Визитов",         field: "price",  aggregation: "count_values" },
          { id: "k2", label: "Доход",           field: "price",  aggregation: "sum", format: "currency", currencySymbol: "₽" },
          { id: "k3", label: "Расходы",         field: "amount", aggregation: "sum", format: "currency", currencySymbol: "₽" },
          { id: "k4", label: "Чистая прибыль",  field: NET_FIELD,  aggregation: "sum", format: "currency", currencySymbol: "₽" },
        ],
        columns: 4,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Доход, расходы и прибыль по месяцам",
      layout: { x: 0, y: 2, w: 12, h: 4 },
      config: {
        subFilter: datedScope(),
        chartType: "bar",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "month" },
        yAxis: { label: "Доход", property: "price", aggregation: "sum" },
        series: [
          { id: "s-exp", label: "Расходы", property: "amount", aggregation: "sum" },
          { id: "s-net", label: "Прибыль", property: NET_FIELD, aggregation: "sum" },
        ],
        style: CHART_STYLE,
      },
    },
    {
      id: widgetId(),
      type: "text",
      title: "Как читать графики клиента",
      layout: { x: 0, y: 6, w: 12, h: 1 },
      config: {
        content: "Выберите клиента в таблице «Клиенты» (меню строки → «Фильтровать связанные блоки»): графики справа покажут только его визиты и трекер. Колонки «Визитов», «Последнее самочувствие», «Среднее самочувствие» и «Оплачено» считаются из визитов, которые ссылаются на клиента.",
      },
    },
    {
      id: clientsTable,
      type: "database-call",
      title: "Клиенты",
      layout: { x: 0, y: 7, w: 12, h: 4 },
      config: { ...tableTabConfig(CLIENTS_TABLE as unknown as Record<string, unknown>, "Таблица"), subFilter: typeScope("client") },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Самочувствие и тесты трекера",
      layout: { x: 0, y: 11, w: 6, h: 4 },
      config: {
        subFilter: datedScope(),
        chartType: "line",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "day" },
        yAxis: { label: "Самочувствие после визита", property: "wellbeingAfter", aggregation: "avg" },
        linkedSelection: { sourceWidgetId: clientsTable, relationField: "client" },
        series: [
          { id: "s-mood",   label: "Настроение (тест)", property: "mood",   aggregation: "avg", selectionField: "person" },
          { id: "s-energy", label: "Энергия (тест)",    property: "energy", aggregation: "avg", selectionField: "person" },
        ],
        style: { ...CHART_STYLE, smooth: true },
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Вес и тренировки",
      layout: { x: 6, y: 11, w: 6, h: 4 },
      config: {
        subFilter: datedScope(),
        chartType: "line",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "day" },
        yAxis: { label: "Вес, кг", property: "weight", aggregation: "avg" },
        linkedSelection: { sourceWidgetId: clientsTable, relationField: "person" },
        series: [
          { id: "s-train", label: "Тренировки, мин", property: "training", aggregation: "sum", axis: "right", selectionField: "person" },
        ],
        style: CHART_STYLE,
      },
    },
  ];
}

export function cabinetOverview(tableFieldConfig: DatabaseViewConfig["table"]): DatabaseViewConfig {
  return {
    widgets: cabinetWidgets(),
    layoutMode: "stack",
    layoutVersion: 1,
    table: tableFieldConfig,
    showWidgetToolbar: true,
    compactMode: false,
    // Net = income − expenses, per note: a visit adds its price, an expense
    // takes its amount away; everything else adds 0.
    formulaFields: [{ name: NET_FIELD, expression: "IFBLANK(price, 0) - IFBLANK(amount, 0)", resultType: "number" }],
  };
}

/** Fields of the other note types, and the plugin's own, hidden from the clients table. */
const NOT_CLIENT_FIELDS = [
  "path", "amount", "category", "client", "date", "duration", "energy", "mood", "payer", "person",
  "price", "service", "tags", "training", "type", "weight", "wellbeingAfter", "wellbeingBefore",
  "pp_created_time", "pp_last_edited_time", "client_backlinks", "person_backlinks",
];

const CLIENTS_TABLE: DatabaseViewConfig["table"] = {
  fieldConfig: {
    ...Object.fromEntries([...NOT_CLIENT_FIELDS, "Прибыль"].map((f) => [f, { hide: true }])),
    name: { width: 200 },
    goal: { width: 240 },
    since: { width: 110 },
  },
  orderFields: ["name", "Визитов", "Последнее самочувствие", "Среднее самочувствие", "Оплачено", "goal", "since"],
  aggregations: { "Оплачено": "sum", "Визитов": "sum", name: "count_total" },
  showAggregationRow: true,
  rowHeight: "default",
  wrapText: false,
};

export const cabinetCalendar: CalendarConfig = {
  interval: "week",
  displayMode: "bars",
  startDateField: "date",
  dateField: "date",
  startHour: 9,
  endHour: 21,
  timezone: "local",
  timeFormat: "24h",
  agendaOpen: true,
};

export const cabinetTable: DatabaseViewConfig["table"] = {
  fieldConfig: {
    name: { width: 240 },
    path: { hide: true },
    goal: { width: 220 },
    since: { width: 110 },
    [CABINET_ROLLUPS.visits]: { width: 90 },
    [CABINET_ROLLUPS.last]: { width: 120 },
    [CABINET_ROLLUPS.avg]: { width: 120 },
    [CABINET_ROLLUPS.spent]: { width: 110 },
  },
  orderFields: ["name", CABINET_ROLLUPS.visits, CABINET_ROLLUPS.last, CABINET_ROLLUPS.avg, CABINET_ROLLUPS.spent, "goal", "since"],
  aggregations: { [CABINET_ROLLUPS.spent]: "sum", [CABINET_ROLLUPS.visits]: "sum", name: "count_total" },
  showAggregationRow: true,
  rowHeight: "default",
  wrapText: false,
};
