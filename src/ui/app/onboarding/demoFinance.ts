// ============================================================
// Demo — «Финансы»: the personal budget of the therapist (3.6.1).
//
// Story: half a year of personal money — a salary, some side income and
// everyday spending by category — plus the private practice as a second
// income, read from the practice project rather than copied into this one.
// Each operation links its category (`category`), so a category's card sums
// what was spent, counts operations and shows the last one (reverse rollups).
// An operation carries `income` or `expense` and a signed `balance`, so the
// charts can put spending, income and the practice's profit side by side.
// ============================================================

import type { FieldConfig } from "src/settings/base/settings";
import type { BoardConfig } from "src/ui/views/Board/types";
import type { CalendarConfig } from "src/ui/views/Calendar/types";
import type { DatabaseViewConfig, WidgetDefinition } from "src/ui/views/Dashboard/types";
import type { ViewDefinition } from "src/settings/base/settings";
import { tableTabConfig } from "src/ui/views/Dashboard/widgets/legacyMigration";
import {
  CHART_STYLE, RUB, dayOf, demoView, rng, seq, tableOf, typeScope, widgetId, wikilink,
  type DemoFile, type DemoIds,
} from "./demoShared";

export interface CategorySeed {
  name: string;
  kind: "Доход" | "Расход";
  icon: string;
  monthlyLimit?: number;
  /** Operations: every `every` days from `from`, amount within [min, max]. */
  from: number;
  every: number;
  min: number;
  max: number;
  account: "Карта" | "Наличные";
}

export const FINANCE_CATEGORIES: CategorySeed[] = [
  { name: "Зарплата",    kind: "Доход",  icon: "💼", from: -175, every: 30, min: 85000, max: 85000, account: "Карта" },
  { name: "Подработка",  kind: "Доход",  icon: "🧾", from: -120, every: 55, min: 6000,  max: 12000, account: "Карта" },
  { name: "Продукты",    kind: "Расход", icon: "🛒", monthlyLimit: 22000, from: -178, every: 7,  min: 3500, max: 6500, account: "Карта" },
  { name: "Транспорт",   kind: "Расход", icon: "🚇", monthlyLimit: 5000,  from: -176, every: 10, min: 400,  max: 2500, account: "Карта" },
  { name: "Коммуналка",  kind: "Расход", icon: "🏠", monthlyLimit: 8500,  from: -172, every: 30, min: 6500, max: 8200, account: "Карта" },
  { name: "Связь",       kind: "Расход", icon: "📱", monthlyLimit: 1000,  from: -170, every: 30, min: 900,  max: 900,  account: "Карта" },
  { name: "Досуг",       kind: "Расход", icon: "🎭", monthlyLimit: 8000,  from: -168, every: 18, min: 1500, max: 7000, account: "Наличные" },
  { name: "Здоровье",    kind: "Расход", icon: "💊", monthlyLimit: 4000,  from: -160, every: 28, min: 1200, max: 4500, account: "Карта" },
  { name: "Одежда",      kind: "Расход", icon: "👕", monthlyLimit: 6000,  from: -150, every: 45, min: 3000, max: 9000, account: "Карта" },
  { name: "Подарки",     kind: "Расход", icon: "🎁", monthlyLimit: 3000,  from: -140, every: 60, min: 2000, max: 6000, account: "Наличные" },
  { name: "Образование", kind: "Расход", icon: "📚", monthlyLimit: 5000,  from: -130, every: 75, min: 4000, max: 9000, account: "Карта" },
];

const KIND_COLOR = { "Доход": "#4CAF50", "Расход": "#F44336" } as const;

export function buildFinanceCategories(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  for (const c of FINANCE_CATEGORIES) {
    const fm: Record<string, unknown> = { type: "category", kind: c.kind, icon: c.icon, tags: ["category"] };
    if (c.monthlyLimit) fm["monthlyLimit"] = c.monthlyLimit;
    out[c.name] = {
      frontmatter: fm,
      content: `## ${c.kind === "Доход" ? "Источник дохода" : "Статья расходов"}\n\nСколько по ней прошло денег, сколько операций и когда была последняя, считается из операций, которые ссылаются сюда.\n`,
    };
  }
  return out;
}

export function buildFinanceOperations(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  FINANCE_CATEGORIES.forEach((c, ci) => {
    const random = rng(4000 + ci);
    let n = 0;
    for (let d = c.from; d < 0; d += c.every) {
      const day = Math.min(-1, d + Math.floor(random() * 3));
      const amount = c.min === c.max ? c.min : Math.round((c.min + random() * (c.max - c.min)) / 50) * 50;
      const income = c.kind === "Доход";
      out[`${income ? "Доход" : "Трата"} ${c.name} ${seq(++n, 2)}`] = {
        frontmatter: {
          type: "op",
          date: dayOf(day),
          kind: c.kind,
          category: wikilink(c.name),
          categoryName: c.name,
          account: c.account,
          amount,
          [income ? "income" : "expense"]: amount,
          balance: income ? amount : -amount,
          color: KIND_COLOR[c.kind],
          tags: ["op"],
        },
        content: "",
      };
    }
  });
  return out;
}

export function buildFinanceNotes(): Record<string, DemoFile> {
  return { ...buildFinanceCategories(), ...buildFinanceOperations() };
}

export const FINANCE_ROLLUPS = {
  total: "Прошло за полгода",
  count: "Операций",
  last: "Последняя операция",
  avg: "Средняя операция",
} as const;

export function financeFieldConfig(ids: DemoIds): { [field: string]: FieldConfig } {
  const back = (targetField: string, fn: string, extra: Record<string, unknown> = {}) => ({
    rollup: { relationField: "", targetField, function: fn, backlink: { projectId: ids.financeId, relationField: "category" }, ...extra },
  });
  const R = FINANCE_ROLLUPS;
  return {
    date: { time: false },
    category: { relation: { targetProjectId: ids.financeId } },
    [R.total]: back("amount", "sum"),
    [R.count]: back("amount", "count_values"),
    [R.last]: back("date", "last_value", { orderBy: "date" }),
    [R.avg]: back("amount", "avg"),
  } as unknown as { [field: string]: FieldConfig };
}

const OP_FIELDS = ["date", "kind", "category", "categoryName", "account", "amount", "income", "expense", "balance", "color", "category_backlinks"];
const CATEGORY_FIELDS = ["icon", "monthlyLimit"];
const R = FINANCE_ROLLUPS;
const ALL = [...OP_FIELDS, ...CATEGORY_FIELDS, ...(Object.values(R) as string[])];

const CATEGORIES_TABLE = tableOf(
  ["name", "kind", "monthlyLimit", R.total, R.count, R.avg, R.last],
  ALL,
  { name: 160 },
  { [R.total]: "sum", [R.count]: "sum" }
);

const OPS_TABLE = tableOf(
  ["name", "date", "kind", "categoryName", "account", "amount"],
  ALL,
  { name: 230, date: 110 },
  { amount: "sum", name: "count_total" }
);

const expensesOnly = {
  conjunction: "and" as const,
  conditions: [{ field: "kind", operator: "is" as const, value: "Расход", enabled: true }],
};

export function financeBudgetWidgets(ids: DemoIds): WidgetDefinition[] {
  return [
    {
      id: widgetId(),
      type: "stats",
      title: "Личный бюджет за полгода",
      layout: { x: 0, y: 0, w: 8, h: 2 },
      config: {
        cards: [
          { id: "f1", label: "Доходы",          field: "income",  aggregation: "sum", ...RUB },
          { id: "f2", label: "Расходы",         field: "expense", aggregation: "sum", ...RUB },
          { id: "f3", label: "Остаток",         field: "balance", aggregation: "sum", ...RUB },
          { id: "f4", label: "Средняя трата",   field: "expense", aggregation: "avg", ...RUB },
        ],
        columns: 4,
      },
    },
    {
      id: widgetId(),
      type: "stats",
      title: "Частная практика (из «Демо: Кабинет»)",
      layout: { x: 8, y: 0, w: 4, h: 2 },
      // Read from the massage practice: its visits and expenses, not a copy.
      config: {
        dataProjectId: ids.cabinetId,
        cards: [
          { id: "c1", label: "Выручка",        field: "paidAmount", aggregation: "sum", ...RUB },
          { id: "c2", label: "Чистая прибыль", field: "net",        aggregation: "sum", ...RUB },
        ],
        columns: 2,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Расходы, доходы и прибыль практики по месяцам",
      layout: { x: 0, y: 2, w: 12, h: 4 },
      config: {
        chartType: "bar",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "month" },
        yAxis: { label: "Расходы", property: "expense", aggregation: "sum" },
        series: [
          { id: "s-inc", label: "Доходы", property: "income", aggregation: "sum" },
          { id: "s-cab", label: "Прибыль практики", property: "net", aggregation: "sum", dataProjectId: ids.cabinetId },
        ],
        style: CHART_STYLE,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Расходы по статьям",
      layout: { x: 0, y: 6, w: 6, h: 4 },
      config: {
        subFilter: expensesOnly,
        chartType: "donut",
        xAxis: { property: "categoryName", sortBy: "value", sortOrder: "desc", omitZero: true },
        yAxis: { property: "expense", aggregation: "sum" },
        style: { ...CHART_STYLE, showGrid: false, showValues: true },
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Остаток нарастающим итогом",
      layout: { x: 6, y: 6, w: 6, h: 4 },
      config: {
        subFilter: typeScope("op"),
        chartType: "line",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "week" },
        yAxis: { label: "Остаток", property: "balance", aggregation: "sum", cumulative: true },
        style: CHART_STYLE,
      },
    },
  ];
}

export function financeCategoriesWidgets(): WidgetDefinition[] {
  const categories = widgetId();
  return [
    {
      id: widgetId(),
      type: "text",
      title: "Как читать статьи",
      layout: { x: 0, y: 0, w: 12, h: 1 },
      config: {
        content: "Колонки статьи — сколько прошло за полгода, сколько операций, средняя и последняя операция — считаются из операций, которые на неё ссылаются. Выберите статью (меню строки → «Фильтровать связанные блоки по этой строке»), и блок ниже покажет только её операции.",
      },
    },
    {
      id: categories,
      type: "database-call",
      title: "Статьи",
      layout: { x: 0, y: 1, w: 12, h: 4 },
      config: { ...tableTabConfig(CATEGORIES_TABLE, "Таблица"), subFilter: typeScope("category") },
    },
    {
      id: widgetId(),
      type: "database-call",
      title: "Операции статьи",
      layout: { x: 0, y: 5, w: 6, h: 4 },
      config: {
        ...tableTabConfig(OPS_TABLE, "Таблица"),
        subFilter: typeScope("op"),
        linkedSelection: { sourceWidgetId: categories, relationField: "category" },
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Траты по месяцам",
      layout: { x: 6, y: 5, w: 6, h: 4 },
      config: {
        subFilter: expensesOnly,
        chartType: "bar",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "month" },
        yAxis: { label: "Траты", property: "expense", aggregation: "sum" },
        linkedSelection: { sourceWidgetId: categories, relationField: "category" },
        style: CHART_STYLE,
      },
    },
  ];
}

export function financeJournalWidgets(): WidgetDefinition[] {
  return [
    {
      id: widgetId(),
      type: "database-call",
      title: "Все операции",
      layout: { x: 0, y: 0, w: 12, h: 8 },
      config: { ...tableTabConfig(OPS_TABLE, "Таблица"), subFilter: typeScope("op") },
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
  interval: "month",
  displayMode: "bars",
  startDateField: "date",
  dateField: "date",
  eventColorField: "color",
  startHour: 8,
  endHour: 22,
  timezone: "local",
  timeFormat: "24h",
  agendaOpen: false,
};

const board: BoardConfig = {
  groupByField: "categoryName",
  headerField: "date",
  includeFields: ["amount", "account"],
};

/** The five views of the budget. */
export function financeViews(ids: DemoIds): ViewDefinition[] {
  const byDateDesc = { criteria: [{ field: "date", order: "desc" as const, enabled: true }] };
  return [
    demoView("Бюджет", "dashboard", dashboard(financeBudgetWidgets(ids)) as unknown as Record<string, unknown>),
    demoView("Статьи", "dashboard", dashboard(financeCategoriesWidgets()) as unknown as Record<string, unknown>),
    demoView("Операции по статьям", "board", board as unknown as Record<string, unknown>, typeScope("op"), byDateDesc),
    demoView("Календарь операций", "calendar", calendar as unknown as Record<string, unknown>, typeScope("op")),
    demoView("Журнал", "dashboard", dashboard(financeJournalWidgets()) as unknown as Record<string, unknown>, undefined, byDateDesc),
  ];
}
