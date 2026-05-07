import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { FilterCondition } from "src/settings/base/settings";
import type { ColorFilterDefinition } from "src/settings/base/settings";
import type { RelationFieldConfig, RollupFieldConfig } from "src/settings/base/settings";

export type FieldConfigRelationMap = Record<
  string,
  { relation?: RelationFieldConfig; rollup?: RollupFieldConfig } | undefined
>;

/**
 * Extracts unique external target project IDs from relation/rollup field configs.
 * Self-references (targetProjectId === projectId) are excluded — they don't need
 * an external frame fetch. Result is sorted for stable reactive key comparison.
 */
export function extractRelationTargetIds(
  projectId: string,
  fieldConfig: FieldConfigRelationMap | undefined
): string[] {
  if (!fieldConfig) return [];
  const ids = new Set<string>();
  for (const cfg of Object.values(fieldConfig)) {
    if (cfg?.relation?.targetProjectId && cfg.relation.targetProjectId !== projectId) {
      ids.add(cfg.relation.targetProjectId);
    }
    if (cfg?.rollup?.targetProjectId && cfg.rollup.targetProjectId !== projectId) {
      ids.add(cfg.rollup.targetProjectId);
    }
  }
  return Array.from(ids).sort();
}

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
