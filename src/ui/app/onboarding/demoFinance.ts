// ============================================================
// Demo — «Финансы»: personal finances (3.6.0).
//
// Story: the owner of the studio and of the massage practice keeps their own
// money here. Their own notes are everyday spending and a little side
// income; the two other demos are income sources, READ, not copied: the
// massage room's visits and the studio's client payments come in as stats
// blocks and chart series that name the other project.
//
// Shows: stats and chart series over another project (`dataProjectId`), one
// chart with bars from this project and lines from two others, a category
// breakdown, and a transactions table.
// ============================================================

import type { FieldConfig } from "src/settings/base/settings";
import type { DatabaseViewConfig, WidgetDefinition } from "src/ui/views/Dashboard/types";
import { tableTabConfig } from "src/ui/views/Dashboard/widgets/legacyMigration";
import { dayOf, seq, widgetId, type DemoFile } from "./demoShared";

interface OpSeed { kind: "income" | "expense"; category: string; day: number; amount: number; note: string }

const weekly = (category: string, amount: number, from: number, note: string): OpSeed[] =>
  Array.from({ length: 12 }, (_, i) => ({ kind: "expense" as const, category, day: from + i * 7, amount: amount + (i % 3) * 250, note }));

export const FINANCE_OPS: OpSeed[] = [
  ...weekly("Продукты", 3500, -84, "Продукты на неделю"),
  { kind: "expense", category: "Жильё",     day: -80, amount: 30000, note: "Аренда квартиры" },
  { kind: "expense", category: "Жильё",     day: -50, amount: 30000, note: "Аренда квартиры" },
  { kind: "expense", category: "Жильё",     day: -20, amount: 30000, note: "Аренда квартиры" },
  { kind: "expense", category: "Транспорт", day: -78, amount: 2500,  note: "Проездной" },
  { kind: "expense", category: "Транспорт", day: -48, amount: 2500,  note: "Проездной" },
  { kind: "expense", category: "Транспорт", day: -18, amount: 2500,  note: "Проездной" },
  { kind: "expense", category: "Досуг",     day: -60, amount: 4000,  note: "Театр" },
  { kind: "expense", category: "Досуг",     day: -33, amount: 2500,  note: "Кино и ужин" },
  { kind: "expense", category: "Досуг",     day: -5,  amount: 6000,  note: "Выходные за городом" },
  { kind: "expense", category: "Здоровье",  day: -40, amount: 1800,  note: "Анализы" },
  { kind: "income",  category: "Подработка", day: -70, amount: 5000, note: "Гонорар за статью" },
  { kind: "income",  category: "Подработка", day: -15, amount: 7000, note: "Консультация" },
];

export function buildFinanceNotes(): Record<string, DemoFile> {
  const out: Record<string, DemoFile> = {};
  FINANCE_OPS.forEach((s, n) => {
    const date = dayOf(s.day);
    out[`${s.kind === "income" ? "Доход" : "Трата"} ${s.category} ${seq(n + 1)}`] = {
      frontmatter: { type: "op", date, kind: s.kind, category: s.category, amount: s.amount, tags: ["op"] },
      content: `${s.note}\n`,
    };
  });
  return out;
}

export function financeFieldConfig(): { [field: string]: FieldConfig } {
  return { date: { time: false } };
}

const expenses = {
  conjunction: "and" as const,
  conditions: [{ field: "kind", operator: "is" as const, value: "expense", enabled: true }],
};

export function financeWidgets(ids: { cabinetId: string; studioId: string }): WidgetDefinition[] {
  return [
    {
      id: widgetId(),
      type: "stats",
      title: "Мои траты",
      layout: { x: 0, y: 0, w: 4, h: 2 },
      config: {
        subFilter: expenses,
        cards: [
          { id: "f1", label: "Потрачено",      field: "amount", aggregation: "sum", format: "currency", currencySymbol: "₽" },
          { id: "f2", label: "Средняя трата",  field: "amount", aggregation: "avg", format: "currency", currencySymbol: "₽" },
        ],
        columns: 2,
      },
    },
    {
      id: widgetId(),
      type: "stats",
      title: "Доход из кабинета",
      layout: { x: 4, y: 0, w: 4, h: 2 },
      // Read from the massage room: its visits' prices, not a copy of them.
      config: {
        dataProjectId: ids.cabinetId,
        cards: [
          { id: "c1", label: "Оплаты визитов", field: "price", aggregation: "sum", format: "currency", currencySymbol: "₽" },
          { id: "c2", label: "Визитов",        field: "price", aggregation: "count_values" },
        ],
        columns: 2,
      },
    },
    {
      id: widgetId(),
      type: "stats",
      title: "Выручка студии",
      layout: { x: 8, y: 0, w: 4, h: 2 },
      // Read from the studio: its clients' payments.
      config: {
        dataProjectId: ids.studioId,
        cards: [
          { id: "s1", label: "Оплаты клиентов", field: "amount", aggregation: "sum", format: "currency", currencySymbol: "₽" },
          { id: "s2", label: "Платежей",        field: "amount", aggregation: "count_values" },
        ],
        columns: 2,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Траты и доходы по месяцам",
      layout: { x: 0, y: 2, w: 12, h: 4 },
      // Bars: this project's spending. Lines: income read from the other two.
      config: {
        subFilter: expenses,
        chartType: "bar",
        xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "month" },
        yAxis: { label: "Траты", property: "amount", aggregation: "sum" },
        series: [
          { id: "s-cab", label: "Кабинет", property: "price",  aggregation: "sum", dataProjectId: ids.cabinetId },
          { id: "s-std", label: "Студия",  property: "amount", aggregation: "sum", dataProjectId: ids.studioId },
        ],
        style: { colorScheme: "categorical", height: "medium", showGrid: true, showLabels: true, showLegend: true, showValues: false },
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Траты по категориям",
      layout: { x: 0, y: 6, w: 6, h: 4 },
      config: {
        subFilter: expenses,
        chartType: "donut",
        xAxis: { property: "category", sortBy: "value", sortOrder: "desc", omitZero: true },
        yAxis: { property: "amount", aggregation: "sum" },
        style: { colorScheme: "categorical", height: "medium", showGrid: false, showLabels: true, showLegend: true, showValues: true },
      },
    },
    {
      id: widgetId(),
      type: "database-call",
      title: "Операции",
      layout: { x: 6, y: 6, w: 6, h: 4 },
      config: tableTabConfig(financeTable as unknown as Record<string, unknown>, "Таблица"),
    },
  ];
}

export function financeOverview(ids: { cabinetId: string; studioId: string }, table: DatabaseViewConfig["table"]): DatabaseViewConfig {
  return {
    widgets: financeWidgets(ids),
    layoutMode: "stack",
    layoutVersion: 1,
    table,
    showWidgetToolbar: true,
    compactMode: false,
  };
}

export const financeTable: DatabaseViewConfig["table"] = {
  fieldConfig: {
    name: { width: 260 },
    path: { hide: true },
    tags: { hide: true },
    type: { hide: true },
    pp_created_time: { hide: true },
    pp_last_edited_time: { hide: true },
    date: { width: 110 },
    kind: { width: 90 },
    category: { width: 120 },
    amount: { width: 110 },
  },
  orderFields: ["name", "date", "kind", "category", "amount"],
  aggregations: { amount: "sum", name: "count_total" },
  showAggregationRow: true,
  rowHeight: "default",
  wrapText: false,
};
