/**
 * crossProjectResolver.ts — enrichment: turning declared relations into columns.
 *
 * `relationContract.ts` answers "what does this link point at". This module
 * answers "what does the rest of the pipeline get to see", by projecting the
 * resolved target records onto each row as a derived `__resolved__<field>`
 * column. Enrichment is the FIRST stage of the canonical order
 * `enrich → A (scope) → C (advanced) → B (reactive) → sort → render`
 * (FILTER_ORDER_ADR.md), which is what lets a filter, a rollup or a chart treat
 * a relation like any other column instead of re-resolving links themselves.
 *
 * Three things worth knowing before editing:
 *
 * - **The derived column is added, never substituted.** The original field
 *   keeps its wikilinks; `__resolved__<field>` carries the records. Nothing
 *   downstream has to know the difference, and nothing is lost on the way back.
 * - **`targetSubBaseFilter` is live.** Despite the name left over from the
 *   deleted sub-base model (#160), this filter narrows which target records a
 *   relation may resolve to, and it is applied here. Do not remove it with the
 *   rest of the sub-base vocabulary.
 * - **`LEGACY_DISPLAY_FALLBACKS` exists for relations configured before
 *   `displayField` did.** When the config names no display field, name / title
 *   / Name / Title are tried, which is what keeps older vaults resolving.
 */

import { DataFieldType, type DataField, type DataFrame, type DataRecord, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
import type { RelationFieldConfig, RollupFieldConfig } from "src/settings/base/settings";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import {
  buildRelationTargetIndex,
  normalizeRelationValue as normalizeContractRelationValue,
  resolveRelationValue,
  resolvedRecords,
} from "src/lib/relations/relationContract";

const DERIVED_PREFIX = "__resolved__";
const LEGACY_DISPLAY_FALLBACKS = ["name", "title", "Name", "Title"];

/** Re-export of the contract's normalizer, so callers of this module need only one import. */
export function normalizeRelationValue(value: Optional<DataValue>): string[] {
  return normalizeContractRelationValue(value);
}

/** The target records one record's relation field points at, for a single field. */
export function resolveCrossProjectRelations(
  record: DataRecord,
  fieldName: string,
  externalFrame: DataFrame,
  displayField?: string
): DataRecord[] {
  const index = buildRelationTargetIndex(
    externalFrame,
    displayField ? [displayField] : LEGACY_DISPLAY_FALLBACKS
  );
  return resolvedRecords(resolveRelationValue(record.values[fieldName], index), index);
}

/**
 * Add the `__resolved__<field>` column for ONE relation field.
 *
 * Rows whose value holds no links are returned untouched (not given an empty
 * column), so "no links" and "links that matched nothing" stay distinguishable
 * downstream. The derived field is marked `derived` and `repeated`, and is added
 * once — calling this twice for the same field does not duplicate it.
 */
export function enrichFrameWithRelations(
  frame: DataFrame,
  fieldName: string,
  config: RelationFieldConfig,
  externalFrame: DataFrame
): DataFrame {
  const derivedName = derivedFieldName(fieldName);
  const index = buildRelationTargetIndex(
    externalFrame,
    config.displayField ? [config.displayField] : LEGACY_DISPLAY_FALLBACKS
  );
  const allowedIds = config.targetSubBaseFilter
    ? new Set(applyFilter(externalFrame, config.targetSubBaseFilter).records.map((record) => record.id))
    : undefined;
  const records = frame.records.map((record) => {
    const resolutions = resolveRelationValue(record.values[fieldName], index);
    if (resolutions.length === 0) return record;
    const resolved = resolvedRecords(resolutions, index).filter((target) => !allowedIds || allowedIds.has(target.id));
    return { ...record, values: { ...record.values, [derivedName]: resolved as unknown as DataValue } };
  });
  const fields: DataField[] = frame.fields.some((field) => field.name === derivedName)
    ? frame.fields
    : [...frame.fields, {
      name: derivedName,
      type: frame.fields.find((field) => field.name === fieldName)?.type ?? DataFieldType.Relation,
      identifier: false,
      derived: true,
      repeated: true,
      typeConfig: {},
    }];
  return { ...frame, fields, records };
}

/**
 * Enrich every relation field of the frame for which an external frame was
 * loaded. A relation whose target frame is absent is skipped silently: the
 * target project may simply not be open yet, and that is not an error here —
 * it is the state #136/#162 taught us to render rather than to guess through.
 */
export function enrichFrameWithAllRelations(
  frame: DataFrame,
  externalFrames: ReadonlyMap<string, DataFrame>
): DataFrame {
  let enriched = frame;
  for (const field of frame.fields) {
    const relation = field.typeConfig?.relation as RelationFieldConfig | undefined;
    if (!relation) continue;
    const target = externalFrames.get(relation.targetProjectId);
    if (target) enriched = enrichFrameWithRelations(enriched, field.name, relation, target);
  }
  return enriched;
}

/** The name of the derived column for a relation field: `__resolved__<field>`. */
export function derivedFieldName(fieldName: string): string {
  return DERIVED_PREFIX + fieldName;
}

export type { RelationFieldConfig, RollupFieldConfig };
