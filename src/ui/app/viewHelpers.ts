import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { FilterCondition } from "src/settings/base/settings";
import type { ColorFilterDefinition } from "src/settings/base/settings";

// Moved to src/lib/relations/relationTargets.ts (3.6.0); re-exported here.
export { extractRelationTargetIds, type FieldConfigRelationMap } from "src/lib/relations/relationTargets";

// Moved to src/lib (M2-C6): external frames need it too, and lib must not
// import from ui. Re-exported so existing importers keep working.
export { applyDeclaredFieldTypes } from "src/lib/relations/declaredFieldTypes";

/**
 * Returns the first matching color from a color-filter rule set, or null.
 * Disabled conditions (enabled === false) are skipped; absent enabled flag
 * defaults to true (backward compat with rules written before the flag existed).
 */
export function getRecordColor(
  record: DataRecord,
  colorFilter: ColorFilterDefinition,
  matchesFn: (condition: FilterCondition, record: DataRecord) => boolean
): string | null {
  for (const rule of colorFilter.conditions) {
    if (rule.condition?.enabled ?? true) {
      if (matchesFn(rule.condition, record)) {
        return rule.color;
      }
    }
  }
  return null;
}
