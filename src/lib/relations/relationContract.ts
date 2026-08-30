/**
 * relationContract.ts — the single definition of what a Relation IS (#111).
 *
 * A relation is a **declared property of the data**, not a query over it: a
 * field of type `Relation` whose value is one or more wikilinks into a target
 * project. Everything downstream — the setup wizard, related-record surfaces,
 * rollup, the Selection Bus — resolves links through this module, so that two
 * relations that look alike behave alike.
 *
 * Three things live here and nowhere else:
 *
 * 1. **Resolution with an honest status.** A link is `resolved`, `unmatched`
 *    or `ambiguous` — never silently dropped. `unmatched` (the target note
 *    does not exist) and `ambiguous` (several notes answer to the same link)
 *    are ordinary states of a Markdown vault, not errors, and the interface is
 *    expected to show them.
 * 2. **The matching ladder.** `resolveRelationValue` tries full path, then
 *    basename, then the target's display field, and stops at the first level
 *    that yields anything. A basename match is what makes `[[Acme Studio]]`
 *    work without the user typing a folder; a display-field match is what makes
 *    a human-readable name work when it is not the filename.
 * 3. **The legacy boundary.** `validateLegacyLinkedSelection` diagnoses the
 *    pre-contract Dashboard `linkedSelection` setting WITHOUT importing
 *    Dashboard code, so the contract does not depend on the UI that uses it.
 *
 * Deliberately absent: analytical joins. `executeJoin` and scatter-correlation
 * pair arbitrary fields, do not read `RelationFieldConfig` and cannot tell
 * `resolved` from `ambiguous` — see FILTER_MODEL.md, "Analytical joins are not
 * relations" (#148). A join may pair what this contract would call ambiguous,
 * and its numbers are not comparable with a rollup over the same field.
 */

import { DataFieldType, type DataField, type DataFrame, type DataRecord, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
import { extractWikilinks, stripToPath } from "src/lib/engine/wikilink";
import type { RelationFieldConfig } from "src/settings/base/settings";

/**
 * A relation in its resolved, engine-facing form: which project and field it
 * starts from, which project it points at, how the value is stored (only
 * `wikilink` today — the field exists so a second storage cannot be added by
 * accident), and the optional inverse to surface on the target side.
 */
export type RelationDefinition = {
  readonly source: { readonly projectId: string; readonly fieldName: string };
  readonly target: { readonly projectId: string; readonly displayField?: string };
  readonly storage: "wikilink";
  readonly inverse?: { readonly fieldName: string; readonly createIfMissing: boolean };
};

/**
 * The three honest outcomes of following one wikilink. `unmatched` and
 * `ambiguous` are states of the vault, not failures of the code: the target
 * note may not exist yet, or several notes may answer to the same name.
 */
export type RelationResolutionStatus = "resolved" | "unmatched" | "ambiguous";

/**
 * One link, resolved. `rawLink` is what the user wrote, `canonicalPath` is it
 * stripped to a path (alias and heading removed), and `targetRecordId` is set
 * only when `status` is `resolved` — an ambiguous link deliberately carries no
 * record, so a caller cannot quietly pick the first match.
 */
export type RelationResolution = {
  readonly rawLink: string;
  readonly canonicalPath: string;
  readonly status: RelationResolutionStatus;
  readonly targetRecordId?: string;
};

/**
 * The target project indexed for lookup, built once per frame by
 * `buildRelationTargetIndex` and reused across every record.
 *
 * Three maps, because a link may be written three ways — full path, bare
 * basename, or the target's display value — and each may legitimately hit more
 * than one record, which is exactly how `ambiguous` is detected.
 */
export type RelationTargetIndex = {
  readonly recordsById: ReadonlyMap<string, DataRecord>;
  readonly paths: ReadonlyMap<string, readonly DataRecord[]>;
  readonly basenames: ReadonlyMap<string, readonly DataRecord[]>;
  readonly displays: ReadonlyMap<string, readonly DataRecord[]>;
};

/** Pure diagnostic result for the legacy Dashboard Selection Bus setting. */
export type LegacyLinkedSelectionStatus = "valid" | "missing-relation" | "invalid-field" | "wrong-target-project";

/** Diagnosis plus, when it could be built, the relation the setting refers to. */
export type LegacyLinkedSelectionValidation = {
  readonly status: LegacyLinkedSelectionStatus;
  readonly relation?: RelationDefinition;
};

/** The pre-contract stored shape: a field name and nothing else. */
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

/**
 * Lift the stored `RelationFieldConfig` of a field into a `RelationDefinition`.
 * The stored shape is settings-facing and partial; this is the engine-facing
 * one, and it is the only place that knows how to translate between them.
 */
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

/**
 * Index a target frame for resolution. `displayFields` are the fields whose
 * values may be written inside a wikilink instead of a filename; pass none and
 * only path and basename matching are available.
 *
 * O(records × displayFields) once, so callers should build this per frame and
 * not per link.
 */
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

/**
 * Resolve every wikilink in one field value against the index.
 *
 * The ladder is path → basename → display value, and it STOPS at the first
 * level that matches: a path hit is never widened by a basename hit, so a
 * fully-qualified link cannot become ambiguous because some other folder holds
 * a note of the same name. One match is `resolved`, none is `unmatched`, more
 * than one is `ambiguous`.
 */
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

/**
 * The target records behind a set of resolutions. Unmatched and ambiguous
 * resolutions contribute nothing — this is the function that makes "a rollup
 * counts only what actually resolved" true.
 */
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

/** Canonical paths of every link in a value, in order, without resolving them. */
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
