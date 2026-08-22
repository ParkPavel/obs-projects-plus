import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import {
  buildRelationTargetIndex,
  resolveRelationValue,
  type RelationResolution,
  type RelationResolutionStatus,
} from "./relationContract";
import type { RelationFieldConfig } from "src/settings/base/settings";

export type RelationSetupDraft = {
  readonly fieldName: string;
  readonly targetProjectId: string;
  readonly displayField?: string;
  readonly createSourceField: boolean;
  readonly inverse?: { readonly enabled: boolean; readonly fieldName: string };
};

export type RelationPreviewItem = {
  readonly recordId: string;
  readonly resolutions: readonly RelationResolution[];
};

export type RelationPreviewSummary = Readonly<Record<RelationResolutionStatus, number>>;

export type RelationSetupValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly message: string };

export function validateRelationSetupDraft(
  draft: RelationSetupDraft,
  existingFields: readonly DataField[]
): RelationSetupValidation {
  if (!draft.fieldName.trim()) return { valid: false, message: "A relation property name is required." };
  if (!draft.targetProjectId.trim()) return { valid: false, message: "Choose a database to link." };
  if (draft.createSourceField && existingFields.some((field) => field.name === draft.fieldName.trim())) {
    return { valid: false, message: "A property with this name already exists." };
  }
  if (!draft.createSourceField) {
    const field = existingFields.find((candidate) => candidate.name === draft.fieldName);
    if (!field || field.type !== DataFieldType.Relation) {
      return { valid: false, message: "Choose an existing Relation property or create one." };
    }
  }
  if (draft.inverse?.enabled && !draft.inverse.fieldName.trim()) {
    return { valid: false, message: "An inverse property name is required." };
  }
  return { valid: true };
}

/** Builds a non-mutating diagnostic preview. Existing Markdown values remain untouched. */
export function previewRelationSetup(
  source: DataFrame,
  sourceFieldName: string,
  target: DataFrame,
  displayField?: string
): readonly RelationPreviewItem[] {
  const index = buildRelationTargetIndex(target, displayField ? [displayField] : []);
  return source.records.map((record) => ({
    recordId: record.id,
    resolutions: resolveRelationValue(record.values[sourceFieldName], index),
  }));
}

export function summarizeRelationPreview(items: readonly RelationPreviewItem[]): RelationPreviewSummary {
  const summary: Record<RelationResolutionStatus, number> = { resolved: 0, unmatched: 0, ambiguous: 0 };
  for (const item of items) for (const resolution of item.resolutions) summary[resolution.status] += 1;
  return summary;
}

export function toRelationFieldConfig(draft: RelationSetupDraft): RelationFieldConfig {
  const inverse = draft.inverse?.enabled && draft.inverse.fieldName.trim()
    ? { inverseFieldName: draft.inverse.fieldName.trim() }
    : {};
  return {
    targetProjectId: draft.targetProjectId.trim(),
    ...(draft.displayField?.trim() ? { displayField: draft.displayField.trim() } : {}),
    ...inverse,
  };
}
