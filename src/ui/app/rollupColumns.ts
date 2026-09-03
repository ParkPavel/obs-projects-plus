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
import { PERCENT_FUNCTIONS } from "src/lib/engine/aggregate";

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
        // #180b: the percent operators' datum became a number, and this is the
        // one place a rollup result is handed to a cell renderer that has no
        // notion of a unit — so a bare number here would turn a cell reading
        // "57%" into "57". The rendered text is kept for that family alone, and
        // only when there is a value at all: an empty population stays null and
        // draws an empty cell rather than the "0%" it used to claim.
        // `PERCENT_FUNCTIONS` is declared beside the code that formats them, so
        // this is a question asked of the kernel, not a second list. #180d (T4)
        // gives the display layer units and retires it.
        const folded =
          result.value != null && PERCENT_FUNCTIONS.has(rollup.function)
            ? result.formattedValue
            : result.value;
        return {
          ...record,
          values: {
            ...record.values,
            [fieldName]: folded as unknown as DataRecord["values"][string],
          },
        };
      }),
    };
  }

  return out;
}
