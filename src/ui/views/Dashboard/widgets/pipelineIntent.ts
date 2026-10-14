// pipelineIntent.ts — B7: what a plain-words menu entry asks of the PipelineEditor.
//
// «Group and count», «Pivot table» and «Combine with another source» open the
// same editor with one sentence on what the step gives and one button that
// adds it. Nothing is added just by opening: an unfinished join or grouping
// would change what the block shows before the person has chosen anything.

import type { TransformStep } from "src/lib/dashboard-engine/transformTypes";
import type { PipelineIntent } from "./widgetMenu";

export interface IntentCopy {
  readonly steps: ReadonlyArray<TransformStep["type"]>;
  readonly hintKey: string;
  readonly hintDefault: string;
  readonly actionKey: string;
  readonly actionDefault: string;
}

const K = "views.dashboard.pipeline.intent";

export const INTENT_COPY: Readonly<Record<PipelineIntent, IntentCopy>> = {
  summarize: { steps: ["group-by", "aggregate"],
    hintKey: `${K}.summarize-hint`, hintDefault: "One row per group with its count or sum — e.g. how many tasks each person has.",
    actionKey: `${K}.summarize-add`, actionDefault: "Add grouping and count" },
  pivot: { steps: ["pivot"],
    hintKey: `${K}.pivot-hint`, hintDefault: "Values of one field become columns — a summary table, like a spreadsheet pivot.",
    actionKey: `${K}.pivot-add`, actionDefault: "Add pivot table" },
  join: { steps: ["join"],
    hintKey: `${K}.join-hint`, hintDefault: "Adds columns from another project by a shared value — e.g. a client's city next to each order.",
    actionKey: `${K}.join-add`, actionDefault: "Add another source" },
};

/** The step types of an intent that the pipeline does not have yet, in order. */
export function missingIntentSteps(intent: PipelineIntent, steps: ReadonlyArray<{ type: string }>): Array<TransformStep["type"]> {
  return INTENT_COPY[intent].steps.filter((type) => !steps.some((s) => s.type === type));
}
