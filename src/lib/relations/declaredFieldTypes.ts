import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";

/** The part of a project's field config this needs: which fields are declared relations. */
export type DeclaredRelations = Record<string, { relation?: { targetProjectId?: string } } | undefined>;

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
 * Runs before enrichment (`enrichFrameWithAllRelations`, and backlink
 * enrichment of external frames), so the type a relation's own
 * `__resolved__<field>` companion inherits is correct too. Returns the frame
 * unchanged, by identity, when nothing is declared or nothing changes.
 */
export function applyDeclaredFieldTypes(
  frame: DataFrame,
  fieldConfig: DeclaredRelations | undefined
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
