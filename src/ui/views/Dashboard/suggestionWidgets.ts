// suggestionWidgets.ts — what a suggestion adds when it is accepted (#059).
//
// Split out of `dashboardSuggest.ts`, which owns the wiring and has a 60-line
// ceiling to keep it readable as wiring. The rule that lives here is the one
// #155 bought: whatever the strip promised, this is what has to arrive. A
// suggestion that adds a differently-configured block reads as a broken
// feature rather than an unset field.

import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { aggregationLabel } from "src/lib/dashboard-engine/aggregationOptions";
import type { ChartConfig, DatabaseViewConfig, StatsConfig, WidgetDefinition, WidgetType } from "./types";
import type { SmartSuggestion } from "./smartSuggest";
import { asChartConfig, asStatsConfig } from "./widgets/linkedSourceState";

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

/**
 * The stats block a "numeric-stats" suggestion promised: the sum and the
 * average of the field it named, labelled in the user's language (M2-C5).
 * It used to add `{ type: "stats" }` with no config, which saved `{}` and
 * showed the setup wizard.
 */
function numericStatsWidget(suggestion: SmartSuggestion): InitialWidget {
  const t = (key: string, defaultValue: string) => get(i18n).t(key, { defaultValue });
  const card = (fn: "sum" | "avg") => ({
    id: fn,
    label: `${aggregationLabel(fn, t)} · ${suggestion.fieldName}`,
    field: suggestion.fieldName,
    aggregation: fn,
    format: "number" as const,
  });
  const config: StatsConfig = { columns: 2, cards: [card("sum"), card("avg")] };
  return { config: config as unknown as Record<string, unknown> };
}

/**
 * Whether the block an accept added keeps the strip's promise, checked on the
 * config that was saved: a stats block with cards, a chart with an axis.
 * Only then is the suggestion dismissed — a block that shows the setup
 * wizard is not what was offered, and the strip stays (M2-C5).
 */
export function deliversSuggestion(suggestion: SmartSuggestion, saved: DatabaseViewConfig): boolean {
  const added = saved.widgets[saved.widgets.length - 1];
  if (!added) return false;
  if (suggestion.kind === "numeric-stats") return (asStatsConfig(added.config)?.cards.length ?? 0) > 0;
  if (suggestion.kind === "date-chart") return asChartConfig(added.config) !== null;
  return true;
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
  if (suggestion.kind === "numeric-stats") return { type: "stats", initial: numericStatsWidget(suggestion) };
  return { type: suggestion.widgetType };
}
