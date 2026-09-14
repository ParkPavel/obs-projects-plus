// smartSuggest.ts — #059 SmartSuggest rule engine (Vision §6).
//
// The product proactively offers the next analytical step the moment the
// data shape allows it: "see a numeric field? offer a Stats block". This
// module owns WHEN a suggestion fires; SmartSuggestionBus.svelte owns HOW
// it is rendered. Kept a pure function of (schema, widgets, dismissals) so
// the rules are unit-testable without mounting Svelte.
//
// V2 note: the relation suggestion adds a `database-call` block, not the
// legacy `sub-base-canvas` widget — V2 retires the latter
// (sub-bases live inside database-call via SubBasePanel).

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import type { WidgetDefinition, WidgetType } from "./types";

export type SuggestionKind = "numeric-stats" | "relation-block" | "date-chart";

export interface SmartSuggestion {
  readonly kind: SuggestionKind;
  /** Field that triggered the rule — interpolated into the strip message. */
  readonly fieldName: string;
  /** Widget type added when the user accepts the suggestion. */
  readonly widgetType: WidgetType;
  /** Defined for kind === "relation-block" when the field has a configured targetProjectId. */
  readonly relationTargetProjectId?: string;
  /**
   * Defined for kind === "date-chart" when the frame also has a numeric
   * field — the accepted chart averages it on Y instead of counting records.
   * The strip message must name exactly this field when it is present, so
   * it is carried on the suggestion rather than recomputed at accept time.
   */
  readonly numericFieldName?: string;
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

  // #155 — only a relation that actually names a target can produce a linked
  // block. Suggesting one for an unconfigured Relation field used to add an
  // empty `database-call`: the strip promised related records and delivered a
  // blank block, which reads as a broken feature rather than an unset field.
  const relationField = fields.find(
    (f) =>
      f.type === DataFieldType.Relation &&
      !!(f.typeConfig as { relation?: { targetProjectId?: string } } | undefined)?.relation
        ?.targetProjectId
  );
  // A database-call block with linkedSelection means the user already wired
  // related records to a master block — nothing left to suggest.
  const hasLinkedBlock = widgets.some(
    (w) => w.type === "database-call" && w.config["linkedSelection"] != null
  );
  if (relationField && !hasLinkedBlock && !dismissed.includes("relation-block")) {
    const relConfig = (relationField.typeConfig as { relation?: { targetProjectId?: string } } | undefined)?.relation;
    suggestions.push({
      kind: "relation-block",
      fieldName: relationField.name,
      widgetType: "database-call",
      ...(relConfig?.targetProjectId ? { relationTargetProjectId: relConfig.targetProjectId } : {}),
    });
  }

  // A date field's next analytical step is a trend chart. The gate is a
  // chart widget that already plots this exact field on its X axis — that
  // is the one fact that makes the suggestion redundant, mirroring how the
  // relation rule gates on a block already wired to that field rather than
  // on "some database-call exists somewhere".
  const dateField = fields.find((f) => f.type === DataFieldType.Date);
  const hasDateChart = widgets.some(
    (w) => w.type === "chart" && (w.config as { xAxis?: { property?: string } })?.xAxis?.property === dateField?.name
  );
  if (dateField && !hasDateChart && !dismissed.includes("date-chart")) {
    const yNumericField = fields.find((f) => f.type === DataFieldType.Number);
    suggestions.push({
      kind: "date-chart",
      fieldName: dateField.name,
      widgetType: "chart",
      ...(yNumericField ? { numericFieldName: yNumericField.name } : {}),
    });
  }

  return suggestions;
}
