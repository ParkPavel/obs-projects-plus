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

export function normalizeRelationValue(value: Optional<DataValue>): string[] {
  return normalizeContractRelationValue(value);
}

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

export function derivedFieldName(fieldName: string): string {
  return DERIVED_PREFIX + fieldName;
}

export type { RelationFieldConfig, RollupFieldConfig };
