/**
 * Rollup column folding for the view layer.
 *
 * #141 — a rollup configured through the UI never computed. No modal ever
 * wrote `RollupFieldConfig.targetProjectId` (`ConfigureField.patchRollup`
 * deletes it when empty, `CreateField.patchRollup` never sets it), while the
 * consumer keyed the whole computation on that field. The target is therefore
 * resolved here from the relation the rollup already names.
 *
 * Two rules this module holds on purpose:
 *
 * 1. **The target comes from the relation, and only from the relation.** An
 *    explicit `RollupFieldConfig.targetProjectId` is ignored. The first cut
 *    honoured it — no released code path ever wrote one (history down to
 *    `2af8a50` only ever read it), so a stored value could only come from a
 *    hand edit, and respecting a hand edit seemed free. Cross-model review
 *    showed it is not: a stored id that disagrees with the relation's target
 *    resolves the relation's WikiLinks against a *different* project, where
 *    basename matching can produce a plausible and wrong number with no error
 *    anywhere. One source of truth for "which project" removes that class.
 *
 * 2. **Every rollup reads the same snapshot.** Folding results into a frame
 *    that later rollups then read would make the outcome depend on the key
 *    order of `fieldConfig` — i.e. on the key order of stored JSON. Rollups
 *    are computed against the frame as it entered this function and folded
 *    into a separate output, so no rollup can observe another's result.
 *
 *    This is a deliberate behaviour change, not an equivalence: the previous
 *    inline loop passed the progressively-mutated frame along. `FieldConfig`
 *    allows a relation and a rollup on the *same* field, so a rollup could
 *    overwrite the WikiLink that a later rollup then tried to resolve. The old
 *    result was order-dependent garbage; this one resolves the link the user
 *    actually wrote.
 */
import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import type { RollupFieldConfig } from "src/settings/base/settings";
import { computeCrossProjectRollupColumn } from "src/lib/engine/crossProjectRollup";

import type { FieldConfigRelationMap } from "./viewHelpers";

/**
 * Resolves which project a rollup aggregates from: the target of the relation
 * field the rollup names. Returns undefined when that relation is missing, is
 * not a relation, or has no target — the cases where the rollup cannot be
 * computed at all.
 *
 * A stored `rollup.targetProjectId` is deliberately not consulted; see rule 1
 * in the module header.
 */
export function resolveRollupTargetProjectId(
  rollup: RollupFieldConfig,
  fieldConfig: FieldConfigRelationMap | undefined
): string | undefined {
  return fieldConfig?.[rollup.relationField]?.relation?.targetProjectId;
}

/**
 * Computes every declared rollup and folds the results into the frame under
 * the rollup's own field name, so filter, sort and cell renderers all see the
 * aggregate without a separate derived column.
 *
 * A rollup whose relation points back at the current project is computed
 * against the current frame; `externalFrames` never carries the project's own
 * frame, because `extractRelationTargetIds` excludes self-references from the
 * fetch set by design.
 */
export function applyRollupColumns(
  frame: DataFrame,
  fieldConfig: FieldConfigRelationMap | undefined,
  projectId: string,
  externalFrames: ReadonlyMap<string, DataFrame>
): DataFrame {
  if (!fieldConfig) return frame;

  const snapshot = frame;
  let out = frame;

  for (const [fieldName, cfg] of Object.entries(fieldConfig)) {
    const rollup = cfg?.rollup;
    if (!rollup) continue;

    const targetProjectId = resolveRollupTargetProjectId(rollup, fieldConfig);
    if (!targetProjectId) continue;

    const targetFrame =
      targetProjectId === projectId ? snapshot : externalFrames.get(targetProjectId);
    if (!targetFrame) continue;

    const column = computeCrossProjectRollupColumn(snapshot, rollup, targetFrame);
    out = {
      ...out,
      records: out.records.map((record) => {
        const result = column.get(record.id);
        if (!result) return record;
        // What lands here is DATA, and the whole frame is filtered and sorted
        // after this fold (`View.svelte`), dispatching on the runtime type of
        // the value. Before #180b a percent rollup put the string "57%" here,
        // so `percent > 50` could not reach the numeric branch at all and a
        // sort compared text — 33.1 and 33.4 were both "33%". The number goes
        // in, and the missing "%" is a gap in the DISPLAY layer, which has no
        // notion of units for a rollup field yet. #180d (T4) is where a cell
        // learns the unit; recorded in BACKLOG #180 rather than paid for here
        // with a string, which is the conflation this ticket exists to remove.
        // (Found by the Codex adversarial review of #180b, against the first
        // version of this very line.)
        return {
          ...record,
          values: {
            ...record.values,
            [fieldName]: result.value as unknown as DataRecord["values"][string],
          },
        };
      }),
    };
  }

  return out;
}
