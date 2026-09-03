// renderContext.ts — #169.
//
// Assembling the `WidgetRenderContext` the props builders read.
//
// It sits beside the registry rather than inside it because they are two
// different jobs: `widgetComponentRegistry` is a routing table from a type to a
// component, and this is the one place the host's measurements are folded into
// the shape those builders consume. Keeping it out of the host is what stops
// the shape and its construction from drifting apart — every field below is
// derived exactly once, so a rule like "an external source has no pipeline"
// cannot be stated in one expression and contradicted in another.

import type { DataTableConfig } from "../types";
import { validateLegacyLinkedSelection } from "src/lib/relations/relationContract";
import type { WidgetRenderContext } from "./widgetComponentRegistry";
import type { DbCallView } from "./linkedSourceState";

/**
 * What `WidgetHost` measures, before the derived shape the builders read.
 *
 * Written as the context minus everything derived below, so a field added to
 * `WidgetRenderContext` is either supplied by the host or derived here — it
 * cannot be quietly forgotten in both places.
 */
export type RenderContextInput = Omit<
  WidgetRenderContext,
  | "effectiveTableConfig"
  | "dbCallFrame"
  | "dbCallFields"
  | "dbCallSourceConfig"
  | "dbCallLinkedSelection"
  | "dbCallLinkedSelectionValidation"
  | "dbCallScopeApplied"
  | "dbCallUsesLinkedSource"
  | "dbCallSource"
> & {
  readonly tableConfig: DataTableConfig | undefined;
  readonly isPrimaryDataTable: boolean;
  readonly dbCall: DbCallView;
  /** #118: true when the host already narrowed the frame by `config.subFilter`. */
  readonly scopeApplied: boolean;
};

/** Fold the host's measurements into the context the builders read. */
export function buildRenderContext(input: RenderContextInput): WidgetRenderContext {
  const {
    widget, dbCall, project, tableConfig, isPrimaryDataTable,
    pipelineStepCount, pipelineInputRowCount, scopeApplied, ...passThrough
  } = input;
  return {
    ...passThrough,
    widget,
    project,
    effectiveTableConfig: isPrimaryDataTable
      ? tableConfig
      : (widget.config as { table?: DataTableConfig })?.table ?? tableConfig,
    // An external source is read whole: the host's transform pipeline never ran
    // on it, so reporting a step count would describe work that did not happen.
    pipelineStepCount: dbCall.isExternal ? 0 : pipelineStepCount,
    pipelineInputRowCount: dbCall.isExternal ? 0 : pipelineInputRowCount,
    dbCallFrame: dbCall.frame,
    dbCallFields: dbCall.frame.fields,
    dbCallSourceConfig: dbCall.sourceConfig,
    dbCallLinkedSelection: dbCall.linkedSelection,
    dbCallSource: dbCall.source,
    dbCallScopeApplied: !dbCall.isExternal && scopeApplied,
    dbCallUsesLinkedSource: dbCall.isExternal,
    dbCallLinkedSelectionValidation: dbCall.linkedSelection
      ? validateLegacyLinkedSelection(
          { relationField: dbCall.linkedSelection.relationField },
          dbCall.sourceConfig?.projectId ?? project?.id ?? "",
          project?.id,
          dbCall.frame.fields
        ).status
      : undefined,
  };
}
