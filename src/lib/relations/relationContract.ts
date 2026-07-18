import { DataFieldType, type DataField, type DataFrame, type DataRecord, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
import { extractWikilinks, stripToPath } from "src/lib/engine/wikilink";
import type { RelationFieldConfig } from "src/settings/base/settings";

export type RelationDefinition = {
  readonly source: { readonly projectId: string; readonly fieldName: string };
  readonly target: { readonly projectId: string; readonly displayField?: string };
  readonly storage: "wikilink";
  readonly inverse?: { readonly fieldName: string; readonly createIfMissing: boolean };
};

export type RelationResolutionStatus = "resolved" | "unmatched" | "ambiguous";

export type RelationResolution = {
  readonly rawLink: string;
  readonly canonicalPath: string;
  readonly status: RelationResolutionStatus;
  readonly targetRecordId?: string;
};

export type RelationTargetIndex = {
  readonly recordsById: ReadonlyMap<string, DataRecord>;
  readonly paths: ReadonlyMap<string, readonly DataRecord[]>;
  readonly basenames: ReadonlyMap<string, readonly DataRecord[]>;
  readonly displays: ReadonlyMap<string, readonly DataRecord[]>;
};

/** Pure diagnostic result for the legacy Dashboard Selection Bus setting. */
export type LegacyLinkedSelectionStatus = "valid" | "missing-relation" | "invalid-field" | "wrong-target-project";

export type LegacyLinkedSelectionValidation = {
  readonly status: LegacyLinkedSelectionStatus;
  readonly relation?: RelationDefinition;
};

export type LegacyLinkedSelectionConfig = { readonly relationField?: string };

/**
 * Validate a legacy widget filter without importing Dashboard code. A valid
 * filter uses a declared Relation field whose target is the master project.
 */
export function validateLegacyLinkedSelection(
  linkedSelection: LegacyLinkedSelectionConfig | undefined,
  receivingProjectId: string,
  masterProjectId: string | undefined,
  fields: readonly DataField[]
): LegacyLinkedSelectionValidation {
  const fieldName = linkedSelection?.relationField?.trim();
  if (!fieldName || !masterProjectId) return { status: "missing-relation" };
  const field = fields.find((candidate) => candidate.name === fieldName);
  if (!field || field.type !== DataFieldType.Relation) return { status: "invalid-field" };
  const config = field.typeConfig?.relation as RelationFieldConfig | undefined;
  if (!config) return { status: "missing-relation" };
  const relation = adaptRelationFieldConfig(receivingProjectId, fieldName, config);
  if (relation.target.projectId !== masterProjectId) {
    return { status: "wrong-target-project", relation };
  }
  return { status: "valid", relation };
}

export function adaptRelationFieldConfig(
  sourceProjectId: string,
  fieldName: string,
  config: RelationFieldConfig
): RelationDefinition {
  return {
    source: { projectId: sourceProjectId, fieldName },
    target: config.displayField
      ? { projectId: config.targetProjectId, displayField: config.displayField }
      : { projectId: config.targetProjectId },
    storage: "wikilink",
    ...(config.inverseFieldName
      ? { inverse: { fieldName: config.inverseFieldName, createIfMissing: false } }
      : {}),
  };
}

export function buildRelationTargetIndex(
  frame: DataFrame,
  displayFields: readonly string[] = []
): RelationTargetIndex {
  const paths = new Map<string, DataRecord[]>();
  const basenames = new Map<string, DataRecord[]>();
  const displays = new Map<string, DataRecord[]>();
  const recordsById = new Map<string, DataRecord>();
  for (const record of frame.records) {
    recordsById.set(record.id, record);
    add(paths, pathKey(record.id), record);
    add(basenames, basenameKey(record.id), record);
    for (const field of displayFields) {
      const value = record.values[field];
      if (typeof value === "string" && value.trim()) add(displays, value.trim().toLowerCase(), record);
    }
  }
  return { recordsById, paths, basenames, displays };
}

export function resolveRelationValue(
  value: Optional<DataValue>,
  index: RelationTargetIndex
): RelationResolution[] {
  return extractRawLinks(value).map(({ rawLink, canonicalPath }) => {
    const pathMatches = index.paths.get(pathKey(canonicalPath)) ?? [];
    const basenameMatches = pathMatches.length > 0
      ? pathMatches
      : index.basenames.get(basenameKey(canonicalPath)) ?? [];
    const matches = basenameMatches.length > 0
      ? basenameMatches
      : index.displays.get(canonicalPath.toLowerCase()) ?? [];
    if (matches.length === 1) {
      return { rawLink, canonicalPath, status: "resolved", targetRecordId: matches[0]!.id };
    }
    return { rawLink, canonicalPath, status: matches.length === 0 ? "unmatched" : "ambiguous" };
  });
}

export function resolvedRecords(
  resolutions: readonly RelationResolution[],
  index: RelationTargetIndex
): DataRecord[] {
  return resolutions.flatMap((resolution) => {
    if (resolution.status !== "resolved" || !resolution.targetRecordId) return [];
    const record = index.recordsById.get(resolution.targetRecordId);
    return record ? [record] : [];
  });
}

export function normalizeRelationValue(value: Optional<DataValue>): string[] {
  return extractRawLinks(value).map((link) => link.canonicalPath);
}

function extractRawLinks(value: Optional<DataValue>): Array<{ rawLink: string; canonicalPath: string }> {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap((item) => extractRawLinks(item));
  if (typeof value !== "string") return [];
  const wikilinks = extractWikilinks(value, 1000);
  if (wikilinks.length > 0) {
    const rawTokens = value.match(/\[\[[^\]]+\]\]/g) ?? [];
    return wikilinks.map((canonicalPath, index) => ({ rawLink: rawTokens[index] ?? canonicalPath, canonicalPath }));
  }
  const canonicalPath = stripToPath(value);
  return canonicalPath ? [{ rawLink: value, canonicalPath }] : [];
}

function add(map: Map<string, DataRecord[]>, key: string, record: DataRecord): void {
  if (!key) return;
  const existing = map.get(key);
  if (existing) existing.push(record);
  else map.set(key, [record]);
}

function pathKey(path: string): string {
  return path.replace(/\\/g, "/").replace(/\.md$/i, "").trim().toLowerCase();
}

function basenameKey(path: string): string {
  const canonical = pathKey(path);
  return canonical.slice(canonical.lastIndexOf("/") + 1);
}
