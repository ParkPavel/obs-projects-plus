/**
 * Which projects a project's relation and rollup fields read (3.6.0: moved
 * from ui/app/viewHelpers — the external-frame resolver needs it, and lib
 * must not import from ui).
 */

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
    // A reverse rollup reads the project whose records link here.
    if (cfg?.rollup?.backlink?.projectId && cfg.rollup.backlink.projectId !== projectId) {
      ids.add(cfg.rollup.backlink.projectId);
    }
  }
  return Array.from(ids).sort();
}
