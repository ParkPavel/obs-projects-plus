/**
 * RelationResolver — resolves wiki-link references (`[[Note Name]]`)
 * within DataRecord field values to actual DataRecords from the same DataFrame.
 */

import type { DataFrame, DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";

// ── Types ─────────────────────────────────────────────────

export interface ResolvedRelation {
  /** Original link text (e.g. "[[My Note]]" → "My Note") */
  readonly linkText: string;
  /** Matched record from the DataFrame, or undefined if unresolved */
  readonly target: DataRecord | undefined;
}

export interface RelationResult {
  /** Source record ID */
  readonly sourceId: string;
  /** All resolved links for that record's relation field */
  readonly relations: ResolvedRelation[];
}

// ── Wiki‐link parser ─────────────────────────────────────

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?\|?[^\]]*\]\]/g;

/**
 * Extract link targets from a raw string value.
 * Handles `[[Note]]`, `[[Note|Alias]]`, `[[Note#heading]]`.
 */
const MAX_WIKILINKS = 500;

export function extractWikiLinks(raw: string): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  // reset lastIndex in case regex is reused
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(raw)) !== null) {
    const link = m[1]?.trim();
    if (link) results.push(link);
    if (results.length >= MAX_WIKILINKS) break;
  }
  return results;
}

// ── Record look-up index ────────────────────────────────

export type RecordIndex = Map<string, DataRecord>;

/**
 * Build an index mapping lowercase note names to records.
 * Uses the record id (path) basename and optionally an explicit "name" field.
 */
export function buildRecordIndex(df: DataFrame): RecordIndex {
  const idx: RecordIndex = new Map();
  for (const r of df.records) {
    // id is typically a file path — use the basename without extension
    const baseName = extractBaseName(r.id);
    idx.set(baseName.toLowerCase(), r);

    // Also index by explicit "name" / "title" field
    for (const f of ["name", "title", "Name", "Title"]) {
      const v = r.values[f];
      if (typeof v === "string" && v) {
        idx.set(v.toLowerCase(), r);
      }
    }
  }
  return idx;
}

/** Extract filename without extension from a path */
function extractBaseName(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

// ── Public API ──────────────────────────────────────────

/**
 * Resolve relations for a single record's field value.
 */
export function resolveRelationsForValue(
  value: Optional<DataValue>,
  index: RecordIndex
): ResolvedRelation[] {
  const raw = normalizeToString(value);
  if (!raw) return [];

  const links = extractWikiLinks(raw);
  return links.map((linkText) => ({
    linkText,
    target: index.get(linkText.toLowerCase()),
  }));
}

/**
 * Resolve all relations from a given field across the entire DataFrame.
 */
export function resolveRelations(
  df: DataFrame,
  fieldName: string
): RelationResult[] {
  const index = buildRecordIndex(df);
  const results: RelationResult[] = [];

  for (const record of df.records) {
    const value = record.values[fieldName];
    const relations = resolveRelationsForValue(value, index);
    if (relations.length > 0) {
      results.push({ sourceId: record.id, relations });
    }
  }

  return results;
}

/**
 * Get a single record's relation targets quickly.
 * Prefer getRelationTargetsWithIndex() when processing multiple records.
 */
export function getRelationTargets(
  record: DataRecord,
  fieldName: string,
  df: DataFrame
): DataRecord[] {
  const index = buildRecordIndex(df);
  return getRelationTargetsWithIndex(record, fieldName, index);
}

/**
 * Get relation targets using a pre-built index — O(1) per record instead of O(n).
 */
export function getRelationTargetsWithIndex(
  record: DataRecord,
  fieldName: string,
  index: RecordIndex
): DataRecord[] {
  const value = record.values[fieldName];
  const relations = resolveRelationsForValue(value, index);
  return relations
    .map((r) => r.target)
    .filter((t): t is DataRecord => t !== undefined);
}

// ── Backlinks (bi-directional relations) ─────────────────

export interface BacklinkResult {
  /** Map from record ID to list of source record IDs that link TO it */
  readonly backlinks: Map<string, string[]>;
  /** Field name for the generated backlink column */
  readonly fieldName: string;
}

/**
 * Compute bi-directional backlinks for a relation field.
 *
 * For each record A that links to record B via `fieldName`,
 * record B gets an entry in the backlink map pointing back to A.
 *
 * @returns Map<targetRecordId, sourceRecordIds[]>
 */
export function computeBacklinks(
  df: DataFrame,
  fieldName: string
): BacklinkResult {
  const index = buildRecordIndex(df);
  // Invert: build a map of targetId → [sourceIds]
  const backlinks = new Map<string, string[]>();

  for (const record of df.records) {
    const value = record.values[fieldName];
    const relations = resolveRelationsForValue(value, index);
    for (const rel of relations) {
      if (!rel.target) continue;
      const targetId = rel.target.id;
      const existing = backlinks.get(targetId);
      if (existing) {
        existing.push(record.id);
      } else {
        backlinks.set(targetId, [record.id]);
      }
    }
  }

  return {
    backlinks,
    fieldName: `${fieldName}_backlinks`,
  };
}

/**
 * Enrich a DataFrame with backlink fields for all Relation-type fields.
 * Each relation field "X" generates a derived field "X_backlinks" containing
 * wiki-links back to source records.
 */
export function enrichWithBacklinks(
  df: DataFrame,
  relationFields: string[]
): DataFrame {
  if (relationFields.length === 0) return df;

  const backlinkResults = relationFields.map((f) => computeBacklinks(df, f));

  // Add new fields
  const newFields = backlinkResults.map((br) => ({
    name: br.fieldName,
    type: DataFieldType.Relation,
    repeated: true,
    identifier: false,
    derived: true,
  }));

  // Enrich records with backlink values
  const enrichedRecords = df.records.map((record) => {
    const extraValues: Record<string, DataValue> = {};
    for (const br of backlinkResults) {
      const sources = br.backlinks.get(record.id);
      if (sources && sources.length > 0) {
        // Format as wiki-links so they can be resolved by RelationResolver
        extraValues[br.fieldName] = sources.map(
          (id) => `[[${extractBaseName(id)}]]`
        );
      }
    }
    if (Object.keys(extraValues).length === 0) return record;
    return {
      id: record.id,
      values: { ...record.values, ...extraValues },
    };
  });

  return {
    fields: [...df.fields, ...newFields],
    records: enrichedRecords,
  };
}

// ── Helpers ─────────────────────────────────────────────

function normalizeToString(value: Optional<DataValue>): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(normalizeToString).join(" ");
  return String(value);
}
