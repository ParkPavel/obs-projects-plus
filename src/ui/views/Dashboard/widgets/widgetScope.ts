// #118 — axis A (scope) of the canonical A→C→B order (FILTER_ORDER_ADR.md).
//
// A widget's `subFilter` narrows the frame BEFORE the advanced transform
// pipeline runs. It lives here rather than inline in WidgetHost so the host
// stays inside its LOC budget and the rule stays unit-testable.

import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { FilterDefinition } from "src/settings/settings";
import { applyFilter } from "src/lib/engine/filterEvaluator";

/**
 * The widget's scope filter, or undefined when it would not remove anything.
 * A definition carrying only groups still filters — checking `conditions`
 * alone would read a nested filter as empty.
 */
export function widgetScopeFilter(
  config: Record<string, unknown> | undefined
): FilterDefinition | undefined {
  const subFilter = config?.["subFilter"] as FilterDefinition | undefined;
  if (!subFilter) return undefined;
  const hasEffect =
    subFilter.conditions.length > 0 || (subFilter.groups?.length ?? 0) > 0;
  return hasEffect ? subFilter : undefined;
}

/** Apply axis A to `frame`; returns the frame unchanged when there is no scope. */
export function applyWidgetScope(
  frame: DataFrame,
  config: Record<string, unknown> | undefined
): DataFrame {
  const scope = widgetScopeFilter(config);
  return scope ? applyFilter(frame, scope) : frame;
}
