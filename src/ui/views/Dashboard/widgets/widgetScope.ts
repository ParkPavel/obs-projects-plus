// #118 — axis A (scope) of the canonical A→C→B order (FILTER_ORDER_ADR.md).
//
// A widget's `subFilter` narrows the frame BEFORE the advanced transform
// pipeline runs. It lives here rather than inline in WidgetHost so the host
// stays inside its LOC budget and the rule stays unit-testable.

import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { FilterDefinition } from "src/settings/settings";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import { hasFilterEffect } from "src/lib/engine/filterCompose";

/**
 * The widget's scope filter, or undefined when it would not remove anything.
 * A definition carrying only groups still filters — checking `conditions`
 * alone would read a nested filter as empty.
 */
export function widgetScopeFilter(
  config: Record<string, unknown> | undefined
): FilterDefinition | undefined {
  const subFilter = config?.["subFilter"] as FilterDefinition | undefined;
  return hasFilterEffect(subFilter) ? subFilter : undefined;
}

/** Every field name the definition references, groups included. */
function referencedFields(filter: FilterDefinition, out: Set<string> = new Set()): Set<string> {
  for (const condition of filter.conditions ?? []) {
    if (condition?.field) out.add(condition.field);
  }
  for (const group of filter.groups ?? []) referencedFields(group, out);
  return out;
}

/**
 * Whether the scope can be evaluated on this frame at all.
 *
 * Before #118 a block's `subFilter` was applied to the *transformed* frame, and
 * the filter UI offered that frame's fields — so a stored filter may legitimately
 * name a column the pipeline creates (`_value` from unnest, `_group_size`, a
 * computed column). Running such a filter ahead of the pipeline matches nothing
 * and empties the block.
 *
 * So axis A moves ahead of axis C only where that is provably equivalent: when
 * every field the conditions name already exists. Otherwise the filter is left
 * for the block to apply after the transform, exactly as it did before. Found by
 * cross-model review (Codex, 2026-08-25).
 */
export function scopeIsEvaluableOn(filter: FilterDefinition, frame: DataFrame): boolean {
  const available = new Set(frame.fields.map((f) => f.name));
  for (const name of referencedFields(filter)) {
    if (!available.has(name)) return false;
  }
  return true;
}

/** Outcome of {@link applyWidgetScope}. */
export interface WidgetScopeResult {
  readonly frame: DataFrame;
  /**
   * True when axis A ran here. False means the block must still apply the
   * filter itself, after the transform — it references fields that only exist
   * downstream.
   */
  readonly applied: boolean;
}

/** Apply axis A to `frame` when it is evaluable there. */
export function applyWidgetScope(
  frame: DataFrame,
  config: Record<string, unknown> | undefined
): WidgetScopeResult {
  const scope = widgetScopeFilter(config);
  if (!scope) return { frame, applied: true };
  if (!scopeIsEvaluableOn(scope, frame)) return { frame, applied: false };
  return { frame: applyFilter(frame, scope), applied: true };
}
