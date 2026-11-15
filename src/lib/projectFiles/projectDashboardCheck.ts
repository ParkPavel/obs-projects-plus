import type { ColumnAggregation, WidgetType, ChartType } from "src/ui/views/Dashboard/types";
import type { ViewInspectionTools } from "./projectViewCheck";
import { projectShapeChecks, type ProjectShapeRule, type SchemaLocation } from "./projectShapeCheck";
import { projectTransformRule } from "./projectTransformCheck";
import { filterOperatorTypes } from "src/settings/base/settings";

export interface DashboardInspectionTools extends ViewInspectionTools {
  readonly filter: (value: unknown, at: SchemaLocation) => void;
  readonly source: (value: unknown, at: SchemaLocation) => void;
  readonly plainView: (kind: string, value: unknown, at: SchemaLocation) => boolean;
}
const columns: Record<ColumnAggregation, true> = {
  none: true, count: true, count_total: true, count_values: true, count_numeric: true, count_unique: true, count_empty: true,
  sum: true, avg: true, median: true, min: true, max: true, range: true, count_checked: true, count_unchecked: true,
  percent_checked: true, percent_unchecked: true, percent_empty: true, percent_not_empty: true, earliest: true, latest: true, date_range: true,
};
const chartTypes: Record<ChartType, true> = { bar: true, "horizontal-bar": true, "stacked-bar": true, line: true, area: true, pie: true, donut: true, number: true, progress: true, scatter: true };

/** Known dashboard shapes only. Does not migrate legacy widgets, render, run pipelines or bind external references. */
export function createDashboardConfigInspector(tools: DashboardInspectionTools): (kind: string, value: unknown, at: SchemaLocation) => boolean {
  const s = projectShapeChecks(tools), r = s.required, str = s.string, bool = s.boolean, num = s.number;
  const e = s.enumeration, a = s.array, obj = s.shape;
  const aggregation = e(Object.keys(columns));
  const asc = e(["asc", "desc"]), groupOrder = e(["asc", "desc", "manual"]);
  const version = e(["unified-v1"]), strings = a(str), filter = s.rule(tools.filter);
  const format = e(["number", "percent", "currency", "duration"]);
  const flags = obj({ todo: strings, inProgress: strings, complete: strings });
  const group = obj({ field: r(str), sortOrder: r(groupOrder), hiddenGroups: r(strings), collapsedGroups: r(strings), showEmptyGroups: r(bool), subGroupField: str, subGroupSortOrder: groupOrder, mode: e(["values", "semantic"]), statusGroups: flags, semanticLabels: obj({ todo: str, inProgress: str, complete: str, none: str }) });
  const fieldConfig = s.dictionary(obj({ width: num, widthRem: num, hide: bool, pinned: bool }));
  const sort = a(obj({ field: r(str), order: r(asc) }));
  const cellStyle = obj({ backgroundColor: str, textColor: str, bold: bool, italic: bool });
  const operators = e(Object.keys(filterOperatorTypes));
  const conditionalFormat = obj({ id: r(s.id), field: r(str), conditions: r(a(obj({ operator: r(operators), value: str, style: r(cellStyle) }))) });
  const table = obj({ fieldConfig, sortField: str, sortAsc: bool, sortCriteria: sort, orderFields: strings, aggregations: s.dictionary(aggregation), showAggregationRow: bool, groupBy: group, freezeUpTo: str, conditionalFormats: a(conditionalFormat, "id"), rowHeight: e(["compact", "default", "expanded"]), wrapText: bool, hideEmptyFields: bool, iconField: str, defaultValues: s.dictionary(str), hintDismissed: bool,
    // Retired persisted state is explicitly carried, not interpreted as live definitions.
    subBases: a(s.rule(() => {})), activeSubBaseId: str,
  });
  const preset = obj({ id: r(s.id), label: r(str), fieldConfig, orderFields: strings, sortCriteria: sort, freezeUpTo: str, groupBy: group, rowHeight: e(["compact", "default", "expanded"]), wrapText: bool });
  const linkedSelection = obj({ sourceWidgetId: r(str), relationField: r(str), relationSide: e(["master"]) });
  const xAxis = obj({ property: r(str), sortBy: r(e(["value", "label", "manual"])), sortOrder: r(asc), omitZero: r(bool), hiddenGroups: strings, dateGranularity: e(["day", "week", "month", "quarter", "year"]) });
  const yAxis = obj({ property: r(str), label: str, aggregation: r(aggregation), groupBy: str, cumulative: bool });
  const style = obj({ colorScheme: r(e(["auto", "accent", "categorical", "sequential"])), height: r(e(["small", "medium", "large"])), showGrid: r(bool), showLabels: r(bool), showLegend: r(bool), showValues: r(bool), smooth: bool, gradient: bool, showCenter: bool });
  const chart = obj({ chartType: r(e(Object.keys(chartTypes))), xAxis: r(xAxis), yAxis: r(yAxis), style: r(style), groupMode: e(["values", "semantic"]), title: str, linkedSelection,
    series: a(obj({ id: r(s.id), label: str, property: r(str), aggregation: r(aggregation), dataProjectId: str, xProperty: str, axis: e(["left", "right"]), cumulative: bool, selectionField: str }), "id"),
    // These persisted scatter keys are read by ChartWidget outside ChartConfig's interface.
    colorBy: str, sizeBy: str, showTrendLine: bool, showR2: bool, pointRadius: num, opacity: num,
    correlation: obj({ rightSourceId: r(str), on: r(obj({ leftKey: r(str), rightKey: r(str) })) }),
  });
  const statsCard = obj({ id: r(s.id), label: r(str), field: r(str), aggregation: r(aggregation), format, currencySymbol: str, showTrend: bool, color: str, sparkline: bool });
  const stats = obj({ cards: r(a(statsCard, "id")), columns: r(s.rule((value, at) => { if (typeof value !== "number" || ![2, 3, 4].includes(value)) tools.issue(at, "invalid-type"); })), linkedSelection });
  const dataList = obj({ titleField: str, fields: r(strings), limit: num, sortField: str, sortOrder: asc });
  const timeline = obj({ startField: r(str), endField: str, labelField: str, colorField: str, zoom: r(e(["day", "week", "month", "quarter", "year"])), windowStart: str });
  // Empty configs are real persisted unconfigured widgets/tabs; no defaults are synthesized.
  const unconfigured = (rule: ProjectShapeRule) => s.rule((value, at) => {
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return;
    rule.inspect(value, at);
  });
  const tabConfig = s.rule((value, at) => { s.objectValue.inspect(value, at); });
  const tabEnvelope = obj({ id: r(s.id), label: r(str), viewType: r(e(["table", "board", "calendar", "gallery", "list", "timeline", "chart", "stats"])), config: r(tabConfig), linkedViewId: str,
    sort: obj({ criteria: r(a(obj({ field: r(str), order: r(asc), enabled: r(bool) }))) }), filter,
  });
  const tabPayloads: Record<string, ProjectShapeRule> = { table, list: unconfigured(dataList), timeline: unconfigured(timeline), chart: unconfigured(chart), stats: unconfigured(stats) };
  const tab = s.rule((value, at) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) { tools.issue(at, "invalid-type"); return; }
    const row = value as Record<string, unknown>;
    tabEnvelope.inspect(row, at);
    const type = row['viewType'], config = row['config'], location = [...at, "config"];
    if (typeof type !== "string" || !config || typeof config !== "object" || Array.isArray(config)) return;
    if (tools.plainView(type, config, location)) return;
    if (Object.prototype.hasOwnProperty.call(tabPayloads, type)) tabPayloads[type]!.inspect(config, location);
  });
  const dbCall = obj({ sourceConfig: s.rule(tools.source), subFilter: filter, viewTabs: a(tab, "id"), activeTabId: str, linkedSelection });
  const payloads: Record<WidgetType, ProjectShapeRule> = {
    "data-table": obj({ table, subFilter: filter }), chart: unconfigured(chart), stats: unconfigured(stats),
    checklist: obj({ field: str, labelField: str, sortField: str, sortOrder: asc, showMode: e(["all", "open", "done"]), limit: num }),
    "filter-tabs": unconfigured(obj({ tabs: r(a(obj({ id: r(s.id), label: r(str), field: r(str), value: r(str) }), "id")), field: r(str), showAll: r(bool) })),
    "database-call": dbCall,
    "cover-banner": unconfigured(obj({ src: r(str), widthMode: e(["full", "half", "custom"]), widthRem: num, fitStyle: e(["cover", "contain"]), position: e(["top", "center", "bottom"]), overlay: str })),
    text: obj({ content: str }), divider: obj({ label: str }),
    // Retired types have no active renderer; retain their opaque contents, including
    // old extension keys. Their common source/transform envelope is still inspected.
    comparison: s.objectValue, "view-port": s.objectValue, "summary-row": s.objectValue,
    "data-list": s.objectValue, "sub-base-canvas": s.objectValue, "yaml-visualizer": s.objectValue, timeline: s.objectValue,
  };
  const widgetEnvelope = obj({ id: r(s.id), type: r(e(Object.keys(payloads))), title: r(str),
      layout: r(obj({ x: r(num), y: r(num), w: r(num), h: r(num), minW: num, minH: num, locked: bool, zIndex: num })),
      config: r(s.objectValue), collapsed: bool, transform: projectTransformRule(tools, tools.filter),
      sourceConfig: obj({ projectId: r(str), sourceId: str }),
    });
  const widget = s.rule((value, at) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) { tools.issue(at, "invalid-type"); return; }
    const cfg = value as Record<string, unknown>;
    widgetEnvelope.inspect(cfg, at);
    const type = cfg['type'];
    if (typeof type === "string" && Object.prototype.hasOwnProperty.call(payloads, type) && cfg['config'] && typeof cfg['config'] === "object" && !Array.isArray(cfg['config'])) payloads[type as WidgetType].inspect(cfg['config'], [...at, "config"]);
  });
  const dashboard = obj({ widgets: a(widget, "id"), layoutMode: e(["free", "stack"]), layoutVersion: num, table, showWidgetToolbar: bool, compactMode: bool,
    formulaFields: a(obj({ name: r(str), expression: r(str), resultType: e(["string", "number", "date", "boolean"]), formulaVersion: version }), "name"),
    quickActions: a(obj({ id: r(s.id), label: r(str), labelKey: str, kind: r(e(["toggle-formula-bar"])) }), "id"),
    fieldPresets: a(preset, "id"), activeFieldPresetId: str, dismissedSuggestions: strings,
  });
  const legacyTable = obj({ fieldConfig: s.dictionary(obj({ width: num, hide: bool, pinned: bool })), sortField: str, sortAsc: bool, orderFields: strings });
  return (kind, value, at) => {
    if (kind === "table") {
      // The settings resolver renames this historical registered type to dashboard.
      // Match the documented migration's explicit widgets+layoutVersion format;
      // a lookalike widgets key alone is not an inline source or widget schema.
      const cfg = value as Record<string, unknown>;
      if (cfg && typeof cfg === "object" && !Array.isArray(cfg) && Array.isArray(cfg['widgets']) && typeof cfg['layoutVersion'] === "number") dashboard.inspect(value, at);
      else legacyTable.inspect(value, at);
      return true;
    }
    if (kind !== "dashboard" && kind !== "database") return false;
    dashboard.inspect(value, at);
    return true;
  };
}
