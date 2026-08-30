/**
 * relationSetup.ts — the pure half of the Relation setup wizard (#112, #150).
 *
 * Everything the wizard needs to decide and to show, with no Obsidian and no
 * Svelte: validate the draft, preview what the relation WOULD resolve to
 * against the real records, and lower the draft into the stored
 * `RelationFieldConfig`.
 *
 * It is separate from the modal on purpose. #150 was three defects of one
 * shape — the wizard reported success before the write, lost the chosen
 * `displayField`, and counted its preview against an empty record list. A
 * preview that is a pure function of (draft, source frame, target frame) can be
 * unit-tested against the same records the user is looking at; one that lives
 * inside the modal cannot.
 */

import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import {
  buildRelationTargetIndex,
  resolveRelationValue,
  type RelationResolution,
  type RelationResolutionStatus,
} from "./relationContract";
import type { RelationFieldConfig } from "src/settings/base/settings";

/** What the user has filled in so far. Not yet valid, not yet stored. */
export type RelationSetupDraft = {
  readonly fieldName: string;
  readonly targetProjectId: string;
  readonly displayField?: string;
  readonly createSourceField: boolean;
  readonly inverse?: { readonly enabled: boolean; readonly fieldName: string };
};

/** One source record and how each of its links resolved, for the preview list. */
export type RelationPreviewItem = {
  readonly recordId: string;
  readonly resolutions: readonly RelationResolution[];
};

/**
 * How many links landed in each status across the whole preview. This is the
 * number the wizard shows before the user commits — «12 resolved, 3 unmatched»
 * is the difference between a relation that works and one that looks like it.
 */
export type RelationPreviewSummary = Readonly<Record<RelationResolutionStatus, number>>;

/** Either the draft is usable, or it is not and there is one reason why. */
export type RelationSetupValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly message: string };

/**
 * Reject a draft that cannot be written: no name, no target, a name that is
 * already taken, an inverse asked for without a name. Returns the first
 * problem only — the wizard shows one message at a time.
 */
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
/**
 * Resolve the draft against the REAL source and target frames, so the user sees
 * what this relation will actually match before it exists. #150: this used to
 * run against an empty record list and always reported a clean sheet.
 */
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

/** Tally a preview by status. */
export function summarizeRelationPreview(items: readonly RelationPreviewItem[]): RelationPreviewSummary {
  const summary: Record<RelationResolutionStatus, number> = { resolved: 0, unmatched: 0, ambiguous: 0 };
  for (const item of items) for (const resolution of item.resolutions) summary[resolution.status] += 1;
  return summary;
}

/**
 * Lower a validated draft into the shape that is stored on the field.
 * `displayField` survives this step — #150 dropped it here.
 */
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
