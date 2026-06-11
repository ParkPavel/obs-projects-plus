// smartSuggest.ts — #059 SmartSuggest rule engine (Vision §6).
//
// The product proactively offers the next analytical step the moment the
// data shape allows it: "see a numeric field? offer a Stats block". This
// module owns WHEN a suggestion fires; SmartSuggestionBus.svelte owns HOW
// it is rendered. Kept a pure function of (schema, widgets, dismissals) so
// the rules are unit-testable without mounting Svelte.
//
// V2 note: the relation suggestion adds a `database-call` block, not the
// legacy `sub-base-canvas` widget — DASHBOARD_V2_SPEC §4 retires the latter
// (sub-bases live inside database-call via SubBasePanel).

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import type { WidgetDefinition, WidgetType } from "./types";

export type SuggestionKind = "numeric-stats" | "relation-block";

export interface SmartSuggestion {
  readonly kind: SuggestionKind;
  /** Field that triggered the rule — interpolated into the strip message. */
  readonly fieldName: string;
  /** Widget type added when the user accepts the suggestion. */
  readonly widgetType: WidgetType;
}

type WidgetLike = Pick<WidgetDefinition, "type" | "config">;

/**
 * Compute active suggestions for the canvas, most relevant first.
 *
 * `dismissed` carries both persisted opt-outs
 * (`DatabaseViewConfig.dismissedSuggestions`) and session-local closes —
 * the caller concatenates them.
 */
export function computeSuggestions(
  fields: readonly DataField[],
  widgets: readonly WidgetLike[],
  dismissed: readonly string[]
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];

  const numericField = fields.find((f) => f.type === DataFieldType.Number);
  const hasStats = widgets.some((w) => w.type === "stats");
  if (numericField && !hasStats && !dismissed.includes("numeric-stats")) {
    suggestions.push({
      kind: "numeric-stats",
      fieldName: numericField.name,
      widgetType: "stats",
    });
  }

  const relationField = fields.find((f) => f.type === DataFieldType.Relation);
  // A database-call block with linkedSelection means the user already wired
  // related records to a master block — nothing left to suggest.
  const hasLinkedBlock = widgets.some(
    (w) => w.type === "database-call" && w.config["linkedSelection"] != null
  );
  if (relationField && !hasLinkedBlock && !dismissed.includes("relation-block")) {
    suggestions.push({
      kind: "relation-block",
      fieldName: relationField.name,
      widgetType: "database-call",
    });
  }

  return suggestions;
}
