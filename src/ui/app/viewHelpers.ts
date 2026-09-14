import { DataFieldType, type DataFrame, type DataRecord } from "src/lib/dataframe/dataframe";
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
 * A field the user explicitly typed as a relation through "Настроить поле"
 * must READ as a relation everywhere the frame is inspected — the schema
 * list, the header tooltip, the rollup picker — not just where enrichment
 * already consults `typeConfig.relation` directly.
 *
 * `detectCellType` (datasources/helpers.ts) deliberately leaves a single
 * `[[…]]` string as String, because the historical `name` alias encoding
 * depends on staying a string for `MarkdownRenderer`. That rule governs
 * INFERENCE for a field nobody configured. Once a field carries an explicit
 * `fieldConfig.relation.targetProjectId`, inference is no longer the
 * question being asked, and this is the one place the two are reconciled —
 * on the frame, because only the frame's own project knows which of its
 * fields were configured this way; a datasource has no notion of a project.
 *
 * Runs before enrichment (`enrichFrameWithAllRelations`), so the type a
 * relation's own `__resolved__<field>` companion inherits is correct too.
 */
export function applyDeclaredFieldTypes(
  frame: DataFrame,
  fieldConfig: FieldConfigRelationMap | undefined
): DataFrame {
  if (!fieldConfig) return frame;
  let changed = false;
  const fields = frame.fields.map((field) => {
    if (field.type === DataFieldType.Relation) return field;
    if (!fieldConfig[field.name]?.relation?.targetProjectId) return field;
    changed = true;
    return { ...field, type: DataFieldType.Relation };
  });
  return changed ? { ...frame, fields } : frame;
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
