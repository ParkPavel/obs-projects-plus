// suggestionWidgets.ts — what a suggestion adds when it is accepted (#059).
//
// Split out of `dashboardSuggest.ts`, which owns the wiring and has a 60-line
// ceiling to keep it readable as wiring. The rule that lives here is the one
// #155 bought: whatever the strip promised, this is what has to arrive. A
// suggestion that adds a differently-configured block reads as a broken
// feature rather than an unset field.

import type { ChartConfig, WidgetDefinition, WidgetType } from "./types";
import type { SmartSuggestion } from "./smartSuggest";

type InitialWidget = Partial<Omit<WidgetDefinition, "id" | "type">>;

/**
 * The chart a "date-chart" suggestion promised: the date field on X grouped
 * by day, and — when the frame has a numeric field — that field averaged on
 * Y, otherwise a plain count of records.
 */
function dateChartWidget(suggestion: SmartSuggestion): InitialWidget {
  const config: ChartConfig = {
    chartType: suggestion.numericFieldName ? "line" : "bar",
    xAxis: { property: suggestion.fieldName, sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "day" },
    yAxis: suggestion.numericFieldName
      ? { property: suggestion.numericFieldName, aggregation: "avg" }
      : { property: "count", aggregation: "count_total" },
    style: { colorScheme: "auto", height: "medium", showGrid: true, showLabels: true, showLegend: false, showValues: false },
  };
  return { config: config as unknown as Record<string, unknown> };
}

/** The linked block a "relation-block" suggestion promised, wired to the master block. */
function relationBlockWidget(suggestion: SmartSuggestion, primaryWidgetId: string): InitialWidget {
  return {
    sourceConfig: { projectId: suggestion.relationTargetProjectId ?? "" },
    config: {
      linkedSelection: { sourceWidgetId: primaryWidgetId, relationField: suggestion.fieldName },
    },
  };
}

/** Which widget an accepted suggestion adds, and how it is configured. */
export function widgetForSuggestion(
  suggestion: SmartSuggestion,
  primaryWidgetId: string
): { type: WidgetType; initial?: InitialWidget } {
  if (suggestion.kind === "relation-block" && suggestion.relationTargetProjectId) {
    return { type: "database-call", initial: relationBlockWidget(suggestion, primaryWidgetId) };
  }
  if (suggestion.kind === "date-chart") return { type: "chart", initial: dateChartWidget(suggestion) };
  return { type: suggestion.widgetType };
}
