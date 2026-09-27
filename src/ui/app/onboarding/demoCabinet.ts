// ============================================================
// Demo — «Кабинет»: a private massage practice (3.6.1).
//
// Story: one therapist, ten clients, five services, half a year of visits
// and the practice's own expenses. A client is ONE note: what its card shows
// — sessions, money paid, debt, last and average wellbeing, last visit, and
// from the tracker project the current weight, training minutes and sleep —
// is computed from the notes that link it (reverse rollups), never kept in
// the client note. Services count their sessions and revenue the same way.
//
// Every visit carries `net` (its payment) and every expense `net` (minus its
// amount), so the practice's profit is a plain sum here and in the finance
// project, which reads this project as an income source.
// ============================================================

import type { FieldConfig } from "src/settings/base/settings";
import type { BoardConfig } from "src/ui/views/Board/types";
import type { CalendarConfig } from "src/ui/views/Calendar/types";
import type { GalleryConfig } from "src/ui/views/Gallery/types";
import type { DatabaseViewConfig, WidgetDefinition } from "src/ui/views/Dashboard/types";
import { tableTabConfig } from "src/ui/views/Dashboard/widgets/legacyMigration";
import {
  CHART_STYLE, RUB, clamp, dayOf, demoView, ramp, rng, seq, tableOf, typeScope, typeWith, widgetId, wikilink,
  type DemoFile, type DemoIds,
} from "./demoShared";
import type { ViewDefinition } from "src/settings/base/settings";

export interface ServiceSeed { name: string; duration: number; price: number; color: string }
export interface ClientSeed {
  name: string;
  icon: string;
  since: number;
  source: string;
  goal: string;
  service: string;
  cadence: number;
  payer: "Личная оплата" | "Компания";
  /** The last day of the client's visits (default: two weeks ahead, planned). */
  until?: number;
  /** A course: at most this many visits. */
  limit?: number;
  before: [number, number];
  after: [number, number];
}

export const CABINET_SERVICES: ServiceSeed[] = [
  { name: "Классический массаж",  duration: 60, price: 3000, color: "#4CAF50" },
  { name: "Спортивный массаж",    duration: 60, price: 3500, color: "#2196F3" },
  { name: "Лимфодренаж",          duration: 75, price: 4000, color: "#9C27B0" },
  { name: "Антистресс",           duration: 45, price: 2500, color: "#FF9800" },
  { name: "Корпоративный сеанс",  duration: 30, price: 1500, color: "#607D8B" },
];

export const CABINET_CLIENTS: ClientSeed[] = [
  { name: "Анна Смирнова",   icon: "🧘", since: -175, source: "Сарафан",   goal: "Боль в шее после офисной работы", service: "Классический массаж", cadence: 10, payer: "Личная оплата", before: [3, 6], after: [6, 9] },
  { name: "Борис Кузнецов",  icon: "🏋️", since: -160, source: "Instagram", goal: "Восстановление после тренировок", service: "Спортивный массаж",  cadence: 7,  payer: "Личная оплата", before: [5, 6], after: [7, 9] },
  { name: "Вера Павлова",    icon: "🌙", since: -150, source: "Сайт",      goal: "Стресс и сон",                     service: "Антистресс",         cadence: 14, payer: "Личная оплата", before: [3, 5], after: [6, 8] },
  { name: "Глеб Орлов",      icon: "💼", since: -140, source: "Корпоратив", goal: "Корпоративный велнес «Северный ветер»", service: "Корпоративный сеанс", cadence: 7, payer: "Компания", before: [4, 6], after: [6, 8] },
  { name: "Дарья Лебедева",  icon: "💧", since: -120, source: "Сарафан",   goal: "Курс лимфодренажа",                service: "Лимфодренаж",        cadence: 5,  payer: "Личная оплата", limit: 10, before: [4, 6], after: [6, 8] },
  { name: "Егор Морозов",    icon: "📦", since: -110, source: "Instagram", goal: "Спина после переезда",             service: "Классический массаж", cadence: 14, payer: "Личная оплата", until: -40, before: [3, 5], after: [5, 7] },
  { name: "Жанна Соколова",  icon: "🌿", since: -90,  source: "Сайт",      goal: "Отёки к вечеру",                   service: "Лимфодренаж",        cadence: 10, payer: "Личная оплата", before: [4, 6], after: [6, 8] },
  { name: "Зоя Никитина",    icon: "💼", since: -75,  source: "Корпоратив", goal: "Корпоративный велнес «Северный ветер»", service: "Корпоративный сеанс", cadence: 7, payer: "Компания", before: [4, 5], after: [6, 7] },
  { name: "Илья Фёдоров",    icon: "🏃", since: -45,  source: "Instagram", goal: "Подготовка к марафону",            service: "Спортивный массаж",  cadence: 7,  payer: "Личная оплата", before: [5, 6], after: [7, 8] },
  { name: "Кира Белова",     icon: "🎧", since: -20,  source: "Сарафан",   goal: "Головные боли",                    service: "Антистресс",         cadence: 7,  payer: "Личная оплата", before: [3, 5], after: [6, 8] },
];

/** Recurring expenses of the practice: every `every` days from `from`, amount within [min, max]. */
const EXPENSE_SEEDS = [
  { category: "Аренда",              from: -178, every: 30, min: 18000, max: 18000 },
  { category: "Масла и кремы",       from: -170, every: 21, min: 2500,  max: 3500 },
  { category: "Бельё и полотенца",   from: -160, every: 42, min: 1800,  max: 2200 },
  { category: "Реклама",             from: -175, every: 30, min: 4000,  max: 6000 },
  { category: "Стирка",              from: -165, every: 30, min: 1100,  max: 1400 },
  { category: "Обучение",            from: -95,  every: 999, min: 12000, max: 12000 },
] as const;

const SLOTS = [10, 11, 12, 14, 15, 16, 17, 18];
const HORIZON = 14;

const serviceOf = (name: string) => CABINET_SERVICES.find((s) => s.name === name)!;
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function buildCabinetServices(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  for (const s of CABINET_SERVICES) {
    out[s.name] = {
      frontmatter: { type: "service", duration: s.duration, price: s.price, color: s.color, tags: ["service"] },
      content: `## Услуга\n\n${s.duration} минут, ${s.price} ₽. Сколько раз её провели и сколько она принесла, считается из визитов, которые на неё ссылаются.\n`,
    };
  }
  return out;
}

export function buildCabinetClients(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  for (const c of CABINET_CLIENTS) {
    out[c.name] = {
      frontmatter: { type: "client", icon: c.icon, since: dayOf(c.since), source: c.source, goal: c.goal, payer: c.payer, tags: ["client"] },
      content: `## Клиент\n\n**Запрос:** ${c.goal}\n\nВизиты, оплаты, самочувствие, вес и тренировки этой карточки считаются из заметок визитов и трекера, которые ссылаются сюда. В самой карточке их нет.\n`,
    };
  }
  return out;
}

/** The visit days of a client: every `cadence` days from `since`, shifted a day or two. */
function visitDays(c: ClientSeed, random: () => number): number[] {
  const days: number[] = [];
  const until = c.until ?? HORIZON;
  for (let d = c.since + 2; d <= until; d += c.cadence) {
    const day = Math.min(until, d + Math.floor(random() * 3));
    if (days.length === 0 || day > days[days.length - 1]!) days.push(day);
    if (c.limit && days.length >= c.limit) break;
  }
  return days;
}

export function buildCabinetVisits(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  CABINET_CLIENTS.forEach((c, ci) => {
    const random = rng(1000 + ci);
    const days = visitDays(c, random);
    const service = serviceOf(c.service);
    const done = days.filter((d) => d < 0).length;
    let k = 0;
    days.forEach((day, i) => {
      const start = SLOTS[Math.floor(random() * SLOTS.length)]! * 60;
      const past = day < 0;
      const cancelled = past && random() < 0.06;
      const status = !past ? "запланирован" : cancelled ? "отменён" : "проведён";
      const fm: Record<string, unknown> = {
        type: "visit",
        date: dayOf(day),
        startTime: hhmm(start),
        endTime: hhmm(start + service.duration),
        client: wikilink(c.name),
        service: wikilink(service.name),
        serviceName: service.name,
        status,
        price: service.price,
        payer: c.payer,
        color: service.color,
      };
      if (status === "проведён") {
        const paid = random() > 0.07;
        const noise = () => Math.round(random() * 2 - 1);
        fm["sessions"] = 1;
        fm["doneDate"] = dayOf(day);
        fm["paid"] = paid;
        fm["wellbeingBefore"] = clamp(ramp(c.before[0], c.before[1], k, done) + noise(), 1, 10);
        fm["wellbeingAfter"] = clamp(ramp(c.after[0], c.after[1], k, done) + noise(), 1, 10);
        if (paid) {
          fm["paidAmount"] = service.price;
          fm["net"] = service.price;
        } else {
          fm["debt"] = service.price;
        }
        k++;
      }
      fm["tags"] = ["visit"];
      out[`Визит ${c.name} ${seq(i + 1, 2)}`] = {
        frontmatter: fm,
        content: `## Визит\n\n**Услуга:** ${service.name}, ${service.duration} мин.\n\n### Заметки\n*Что делали, как отреагировал клиент.*\n`,
      };
    });
  });
  return out;
}

export function buildCabinetExpenses(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  const random = rng(2000);
  for (const e of EXPENSE_SEEDS) {
    let n = 0;
    for (let d = e.from; d < 0; d += e.every) {
      const amount = e.min === e.max ? e.min : Math.round((e.min + random() * (e.max - e.min)) / 100) * 100;
      out[`Расход ${e.category} ${seq(++n, 2)}`] = {
        frontmatter: { type: "expense", date: dayOf(d), category: e.category, amount, net: -amount, tags: ["expense"] },
        content: "",
      };
    }
  }
  return out;
}

export function buildCabinetNotes(): Record<string, DemoFile> {
  return { ...buildCabinetServices(), ...buildCabinetClients(), ...buildCabinetVisits(), ...buildCabinetExpenses() };
}

/** The computed columns, named in the user's language: they exist only in the view. */
export const CABINET_ROLLUPS = {
  sessions: "Проведено визитов",
  paid: "Оплачено",
  debt: "Долг",
  last: "Последнее самочувствие",
  avg: "Среднее самочувствие",
  lastVisit: "Последний визит",
  weight: "Текущий вес",
  training: "Тренировки, мин",
  sleep: "Сон, ч",
  revenue: "Выручка",
} as const;

export function cabinetFieldConfig(ids: DemoIds): { [field: string]: FieldConfig } {
  const back = (projectId: string, relationField: string, targetField: string, fn: string, extra: Record<string, unknown> = {}) => ({
    rollup: { relationField: "", targetField, function: fn, backlink: { projectId, relationField }, ...extra },
  });
  const R = CABINET_ROLLUPS;
  return {
    date: { time: false },
    since: { time: false },
    doneDate: { time: false },
    startTime: { time: true },
    endTime: { time: true },
    client: { relation: { targetProjectId: ids.cabinetId } },
    service: { relation: { targetProjectId: ids.cabinetId } },
    // A client's card, from its visits in this project…
    [R.sessions]: back(ids.cabinetId, "client", "sessions", "sum"),
    [R.paid]: back(ids.cabinetId, "client", "paidAmount", "sum"),
    [R.debt]: back(ids.cabinetId, "client", "debt", "sum"),
    [R.last]: back(ids.cabinetId, "client", "wellbeingAfter", "last_value", { orderBy: "date" }),
    [R.avg]: back(ids.cabinetId, "client", "wellbeingAfter", "avg"),
    [R.lastVisit]: back(ids.cabinetId, "client", "doneDate", "last_value", { orderBy: "date" }),
    // …and from the tracker, another project.
    [R.weight]: back(ids.trackerId, "person", "weight", "last_value", { orderBy: "date" }),
    [R.training]: back(ids.trackerId, "person", "trainingMinutes", "sum"),
    [R.sleep]: back(ids.trackerId, "person", "sleep", "avg"),
    // A service, from the visits that name it.
    [R.revenue]: back(ids.cabinetId, "service", "paidAmount", "sum"),
  } as unknown as { [field: string]: FieldConfig };
}

const VISIT_FIELDS = ["date", "startTime", "endTime", "client", "service", "serviceName", "status", "price", "paid", "paidAmount", "debt", "net", "sessions", "doneDate", "wellbeingBefore", "wellbeingAfter", "payer", "color"];
const CLIENT_FIELDS = ["icon", "since", "source", "goal", "payer"];
const OTHER = ["amount", "category", "duration", "client_backlinks", "service_backlinks", "person_backlinks"];
const ALL_ROLLUPS = Object.values(CABINET_ROLLUPS) as string[];
const R = CABINET_ROLLUPS;

export const CABINET_CLIENTS_TABLE = tableOf(
  ["name", R.sessions, R.paid, R.debt, R.last, R.avg, R.lastVisit, R.weight, R.training, R.sleep, "source", "since"],
  [...VISIT_FIELDS, ...CLIENT_FIELDS, ...OTHER, ...ALL_ROLLUPS],
  { name: 180, source: 110, since: 110 },
  { [R.sessions]: "sum", [R.paid]: "sum", [R.debt]: "sum", name: "count_total" }
);

const VISITS_TABLE = tableOf(
  ["name", "date", "serviceName", "status", "price", "paid", "wellbeingBefore", "wellbeingAfter"],
  [...VISIT_FIELDS, ...CLIENT_FIELDS, ...OTHER, ...ALL_ROLLUPS],
  { name: 220, date: 110 },
  { price: "sum", name: "count_total" }
);

const SERVICES_TABLE = tableOf(
  ["name", "duration", "price", R.sessions, R.revenue],
  [...VISIT_FIELDS, ...CLIENT_FIELDS, ...OTHER, ...ALL_ROLLUPS],
  { name: 200 },
  { [R.revenue]: "sum", [R.sessions]: "sum" }
);

const EXPENSES_TABLE = tableOf(
  ["name", "date", "category", "amount"],
  [...VISIT_FIELDS, ...CLIENT_FIELDS, ...OTHER, ...ALL_ROLLUPS],
  { name: 220, date: 110 },
  { amount: "sum", name: "count_total" }
);

/** The sessions revenue over a period, the expenses, and the profit of the practice. */
export function cabinetOverviewWidgets(ids: DemoIds): WidgetDefinition[] {
  const clients = widgetId();
  return [
    {
      id: widgetId(),
      type: "stats",
      title: "Кабинет за полгода",
      layout: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { id: "k1", label: "Проведено визитов", field: "sessions",   aggregation: "sum" },
          { id: "k2", label: "Выручка",           field: "paidAmount", aggregation: "sum", ...RUB },
          { id: "k3", label: "Расходы",           field: "amount",     aggregation: "sum", ...RUB },
          { id: "k4", label: "Чистая прибыль",    field: "net",        aggregation: "sum", ...RUB },
          { id: "k5", label: "Средний чек",       field: "paidAmount", aggregation: "avg", ...RUB },
          { id: "k6", label: "Долги клиентов",    field: "debt",       aggregation: "sum", ...RUB },
        ],
        columns: 3,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Выручка, расходы и прибыль по месяцам",
      layout: { x: 0, y: 2, w: 12, h: 4 },
      config: {
        chartType: "bar",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "month" },
        yAxis: { label: "Выручка", property: "paidAmount", aggregation: "sum" },
        series: [
          { id: "s-exp", label: "Расходы", property: "amount", aggregation: "sum" },
          { id: "s-net", label: "Прибыль", property: "net", aggregation: "sum" },
        ],
        style: CHART_STYLE,
      },
    },
    {
      id: widgetId(),
      type: "text",
      title: "Как читать этот обзор",
      layout: { x: 0, y: 6, w: 12, h: 1 },
      config: {
        content: "Выберите клиента в таблице «Клиенты» (меню строки → «Фильтровать связанные блоки по этой строке»): блок «Визиты клиента» и график самочувствия покажут только его. Колонки клиента — визиты, оплаты, долг, самочувствие, вес, тренировки и сон — считаются из визитов этого проекта и из записей проекта «Демо: Трекер», которые ссылаются на клиента.",
      },
    },
    {
      id: clients,
      type: "database-call",
      title: "Клиенты",
      layout: { x: 0, y: 7, w: 12, h: 4 },
      config: { ...tableTabConfig(CABINET_CLIENTS_TABLE, "Таблица"), subFilter: typeScope("client") },
    },
    {
      id: widgetId(),
      type: "database-call",
      title: "Визиты клиента",
      layout: { x: 0, y: 11, w: 6, h: 4 },
      config: {
        ...tableTabConfig(VISITS_TABLE, "Таблица"),
        subFilter: typeScope("visit"),
        linkedSelection: { sourceWidgetId: clients, relationField: "client" },
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Самочувствие клиента",
      layout: { x: 6, y: 11, w: 6, h: 4 },
      config: {
        subFilter: typeWith("visit", "wellbeingAfter"),
        chartType: "line",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "week" },
        yAxis: { label: "После визита", property: "wellbeingAfter", aggregation: "avg" },
        linkedSelection: { sourceWidgetId: clients, relationField: "client" },
        series: [
          { id: "s-before", label: "До визита", property: "wellbeingBefore", aggregation: "avg" },
          { id: "s-mood", label: "Настроение (трекер)", property: "mood", aggregation: "avg", dataProjectId: ids.trackerId, selectionField: "person" },
        ],
        style: { ...CHART_STYLE, smooth: true },
      },
    },
  ];
}

export function cabinetServicesWidgets(): WidgetDefinition[] {
  return [
    {
      id: widgetId(),
      type: "database-call",
      title: "Услуги",
      layout: { x: 0, y: 0, w: 6, h: 3 },
      config: { ...tableTabConfig(SERVICES_TABLE, "Таблица"), subFilter: typeScope("service") },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Визиты по услугам",
      layout: { x: 6, y: 0, w: 6, h: 3 },
      config: {
        subFilter: typeWith("visit", "sessions"),
        chartType: "donut",
        xAxis: { property: "serviceName", sortBy: "value", sortOrder: "desc", omitZero: true },
        yAxis: { property: "sessions", aggregation: "sum" },
        style: { ...CHART_STYLE, showGrid: false, showValues: true },
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Выручка по услугам",
      layout: { x: 0, y: 3, w: 12, h: 4 },
      config: {
        subFilter: typeWith("visit", "paidAmount"),
        chartType: "bar",
        xAxis: { property: "serviceName", sortBy: "value", sortOrder: "desc", omitZero: true },
        yAxis: { label: "Выручка", property: "paidAmount", aggregation: "sum" },
        style: CHART_STYLE,
      },
    },
    {
      id: widgetId(),
      type: "database-call",
      title: "Расходы кабинета",
      layout: { x: 0, y: 7, w: 6, h: 4 },
      config: { ...tableTabConfig(EXPENSES_TABLE, "Таблица"), subFilter: typeScope("expense") },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Расходы по статьям",
      layout: { x: 6, y: 7, w: 6, h: 4 },
      config: {
        subFilter: typeScope("expense"),
        chartType: "donut",
        xAxis: { property: "category", sortBy: "value", sortOrder: "desc", omitZero: true },
        yAxis: { property: "amount", aggregation: "sum" },
        style: { ...CHART_STYLE, showGrid: false, showValues: true },
      },
    },
  ];
}

const dashboard = (widgets: WidgetDefinition[]): DatabaseViewConfig => ({
  widgets,
  table: tableOf([], []) as unknown as DatabaseViewConfig["table"],
  layoutMode: "stack",
  layoutVersion: 1,
  showWidgetToolbar: true,
  compactMode: false,
});

const calendar: CalendarConfig = {
  interval: "week",
  displayMode: "bars",
  startDateField: "date",
  dateField: "date",
  startTimeField: "startTime",
  endTimeField: "endTime",
  eventColorField: "color",
  checkField: "paid",
  startHour: 9,
  endHour: 21,
  timezone: "local",
  timeFormat: "24h",
  agendaOpen: true,
};

const board: BoardConfig = {
  groupByField: "status",
  headerField: "client",
  includeFields: ["serviceName", "date", "startTime", "price", "paid"],
  columns: {
    "запланирован": { weight: 1 },
    "проведён": { weight: 1.5 },
    "отменён": { weight: 1 },
  },
};

const gallery: GalleryConfig = {
  iconField: "icon",
  cardWidth: 260,
  includeFields: ["goal", R.sessions, R.last, R.lastVisit, R.weight],
};

/** The five views of the practice. */
export function cabinetViews(ids: DemoIds): ViewDefinition[] {
  const byDate = { criteria: [{ field: "date", order: "asc" as const, enabled: true }] };
  return [
    demoView("Обзор кабинета", "dashboard", dashboard(cabinetOverviewWidgets(ids)) as unknown as Record<string, unknown>),
    demoView("Расписание", "calendar", calendar as unknown as Record<string, unknown>, typeScope("visit")),
    demoView("Визиты по статусам", "board", board as unknown as Record<string, unknown>, typeScope("visit"), byDate),
    demoView("Клиенты", "gallery", gallery as unknown as Record<string, unknown>, typeScope("client"), { criteria: [{ field: "since", order: "asc", enabled: true }] }),
    demoView("Услуги и расходы", "dashboard", dashboard(cabinetServicesWidgets()) as unknown as Record<string, unknown>),
  ];
}
