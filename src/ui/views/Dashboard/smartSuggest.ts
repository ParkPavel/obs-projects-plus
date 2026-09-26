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
  /**
   * For kind === "relation-block": the block the strip promises, resolved
   * when the suggestion is computed so the strip text and the added block
   * cannot disagree (architect F1–F3, M2-C7/C8).
   */
  readonly relationWiring?: RelationWiring;
}

/**
 * How a linked block reads related records. `relationField` lives in the
 * RECEIVING block's frame and points at the master's project — except for
 * `relationSide: "master"`, where it lives in the master's frame and points
 * at the receiving project (no field exists on the receiving side).
 */
export interface RelationWiring {
  /** The project the block reads; absent when it reads the dashboard's own project. */
  readonly readProjectId?: string;
  readonly readProjectName?: string;
  readonly relationField: string;
  readonly relationSide?: "master";
}

/** What the relation rule needs beyond the frame: this project, and every project's declared relations. */
export interface SuggestContext {
  readonly hostProjectId: string;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly fieldConfig?: Readonly<Record<string, { relation?: { targetProjectId?: string } } | undefined>>;
  }>;
}

const targetOf = (cfg: { relation?: { targetProjectId?: string } } | undefined) => cfg?.relation?.targetProjectId;

/**
 * The linked block to offer, most direct first:
 * 1. incoming — some project declares a field pointing HERE: read it through
 *    that field (the block stays writable when that project is this one);
 * 2. an outgoing field whose target declares a field pointing back: read the
 *    target through it;
 * 3. an outgoing field with no way back: read the target from the master's
 *    side (F3b).
 * Without a context only case 3 can be seen.
 */
function relationWiringFor(fields: readonly DataField[], context: SuggestContext | undefined): { fieldName: string; target?: string; wiring: RelationWiring } | null {
  const host = context?.hostProjectId;
  if (context && host) {
    for (const p of context.projects) {
      for (const [f, cfg] of Object.entries(p.fieldConfig ?? {})) {
        if (targetOf(cfg) !== host) continue;
        return {
          fieldName: f,
          wiring: p.id === host ? { relationField: f } : { readProjectId: p.id, readProjectName: p.name, relationField: f },
        };
      }
    }
  }
  const outgoing = fields.filter((f) => f.type === DataFieldType.Relation && !!targetOf(f.typeConfig as never));
  if (context && host) {
    for (const f of outgoing) {
      const t = targetOf(f.typeConfig as never)!;
      const target = context.projects.find((p) => p.id === t);
      const back = Object.entries(target?.fieldConfig ?? {}).find(([, cfg]) => targetOf(cfg) === host);
      if (target && back) {
        return { fieldName: f.name, target: t, wiring: { readProjectId: t, readProjectName: target.name, relationField: back[0] } };
      }
    }
  }
  const first = outgoing[0];
  if (!first) return null;
  const t = targetOf(first.typeConfig as never)!;
  const name = context?.projects.find((p) => p.id === t)?.name;
  return {
    fieldName: first.name,
    target: t,
    wiring: { readProjectId: t, ...(name ? { readProjectName: name } : {}), relationField: first.name, relationSide: "master" },
  };
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
  dismissed: readonly string[],
  context?: SuggestContext
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
  const relation = relationWiringFor(fields, context);
  // A database-call block with linkedSelection means the user already wired
  // related records to a master block — nothing left to suggest.
  const hasLinkedBlock = widgets.some(
    (w) => w.type === "database-call" && w.config["linkedSelection"] != null
  );
  if (relation && !hasLinkedBlock && !dismissed.includes("relation-block")) {
    suggestions.push({
      kind: "relation-block",
      fieldName: relation.fieldName,
      widgetType: "database-call",
      ...(relation.target ? { relationTargetProjectId: relation.target } : {}),
      relationWiring: relation.wiring,
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
