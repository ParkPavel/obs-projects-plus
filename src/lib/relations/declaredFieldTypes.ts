import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import type { PropertyType } from "src/lib/visualizer/propertyTypes";
import type { FieldConfig, ProjectPropertyType } from "src/settings/base/settings";

/**
 * The part of a project's field config this needs: which fields are declared
 * relations, formulas, or properties of a given type.
 */
export type DeclaredRelations = Record<
  string,
  Pick<FieldConfig, "relation" | "formula" | "formulaVersion" | "type" | "autoTime" | "uniqueIdPrefix"> | undefined
>;

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
  const storedFields = applyDeclaredStoredTypes(frame.fields, fieldConfig);
  let changed = storedFields !== frame.fields;
  const fields = storedFields.map((field) => {
    const cfg = fieldConfig[field.name];
    if (!field.identifier && (cfg?.formula || cfg?.type === "formula")) {
      const current = field.typeConfig as Record<string, unknown> | undefined;
      if (field.type === DataFieldType.Formula && field.derived && !field.repeated &&
        Object.entries(cfg).every(([key, value]) => Object.is(current?.[key], value))) return field;
      changed = true;
      return { ...field, type: DataFieldType.Formula, derived: true, repeated: false, typeConfig: { ...cfg } };
    }
    if (!field.identifier && (cfg?.type === "autotime" || cfg?.type === "unique_id")) {
      const type = cfg.type === "autotime" ? DataFieldType.AutoTime : DataFieldType.UniqueId;
      const current = field.typeConfig as Record<string, unknown> | undefined;
      if (field.type === type && field.derived === (type === DataFieldType.AutoTime) && !field.repeated &&
        Object.entries(cfg).every(([key, value]) => Object.is(current?.[key], value))) return field;
      changed = true;
      return { ...field, type, derived: type === DataFieldType.AutoTime, repeated: false, typeConfig: { ...field.typeConfig, ...cfg } };
    }
    if (field.type === DataFieldType.Relation) return field;
    if (!fieldConfig[field.name]?.relation?.targetProjectId) return field;
    changed = true;
    return { ...field, type: DataFieldType.Relation };
  });
  // i2-safety: a property created without a value lives in the base's
  // settings only — no note carries its key, so `detectFields` cannot see it.
  // It joins the frame here, the one frame every view and the schema read
  // (and the list `updateFieldConfig` prunes against).
  const present = new Set(fields.map((f) => f.name));
  for (const [name, cfg] of Object.entries(fieldConfig)) {
    if (!cfg || present.has(name)) continue;
    const declared = declaredField(name, cfg);
    if (!declared) continue;
    fields.push(declared);
    changed = true;
  }
  return changed ? { ...frame, fields } : frame;
}

const STORED_TYPES: Partial<Record<PropertyType, DataFieldType>> = {
  string: DataFieldType.String,
  number: DataFieldType.Number,
  boolean: DataFieldType.Boolean,
  date: DataFieldType.Date,
  datetime: DataFieldType.Date,
  list: DataFieldType.List,
  tags: DataFieldType.List,
  select: DataFieldType.Select,
  status: DataFieldType.Status,
  color: DataFieldType.String,
  url: DataFieldType.String,
  email: DataFieldType.String,
  phone: DataFieldType.String,
};

/** Explicit stored-property declarations precede value parsing, unlike inference. */
export function applyDeclaredStoredTypes(fields: DataField[], config: DeclaredRelations | undefined): DataField[] {
  if (!config) return fields;
  let changed = false;
  const result = fields.map(field => {
    const cfg = config[field.name];
    // IDs are opaque stored values, even when their prefix makes one look
    // like a date. Parsing it first would hide it from collision checking.
    const type = cfg?.type === "unique_id" ? DataFieldType.UniqueId : cfg?.type ? STORED_TYPES[cfg.type as PropertyType] : undefined;
    if (!type || field.identifier || [DataFieldType.AutoTime, DataFieldType.Formula, DataFieldType.Rollup].includes(field.type) ||
      (field.derived && (field.name === "name" || field.name === "path"))) return field;
    const typeConfig = { ...field.typeConfig, ...cfg, ...(cfg?.type === "datetime" ? { time: true } : {}) };
    const repeated = type === DataFieldType.List || field.repeated;
    const current = field.typeConfig as Record<string, unknown> | undefined;
    if (field.type === type && field.repeated === repeated &&
      Object.entries(typeConfig).every(([key, value]) => Object.is(current?.[key], value))) return field;
    changed = true;
    return { ...field, type, repeated, typeConfig };
  });
  return changed ? result : fields;
}

/**
 * The field a config entry declares, or undefined when it declares none. A
 * rollup is left to `applyRollupColumns`, which also computes its values.
 */
function declaredField(
  name: string,
  cfg: NonNullable<DeclaredRelations[string]>
): DataField | undefined {
  const base = { name, identifier: false, derived: false, repeated: false, typeConfig: {} };
  if (cfg.type === "autotime" || cfg.type === "unique_id") {
    return { ...base, type: cfg.type === "autotime" ? DataFieldType.AutoTime : DataFieldType.UniqueId,
      derived: cfg.type === "autotime", typeConfig: { ...cfg } };
  }
  if (cfg.relation?.targetProjectId || cfg.type === "relation") {
    return { ...base, type: DataFieldType.Relation, repeated: true };
  }
  if (cfg.formula || cfg.type === "formula") {
    return { ...base, type: DataFieldType.Formula, derived: true, typeConfig: { ...cfg } };
  }
  const stored = cfg.type ? STORED_TYPES[cfg.type] : undefined;
  if (!stored) return undefined;
  return {
    ...base,
    type: stored,
    repeated: stored === DataFieldType.List,
    typeConfig: { ...cfg, ...(cfg.type === "datetime" ? { time: true } : {}) },
  };
}

/**
 * i2-safety — a value that is not written into notes when a property is
 * created: the property is declared in the base's settings instead.
 */
export function isEmptyFieldValue(value: Optional<DataValue>): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

const DECLARED_TYPES: Partial<Record<DataFieldType, ProjectPropertyType>> = {
  [DataFieldType.String]: "string",
  [DataFieldType.Number]: "number",
  [DataFieldType.Boolean]: "boolean",
  [DataFieldType.Date]: "date",
  [DataFieldType.List]: "list",
  [DataFieldType.Select]: "select",
  [DataFieldType.Status]: "status",
  [DataFieldType.Formula]: "formula",
  [DataFieldType.Relation]: "relation",
  [DataFieldType.AutoTime]: "autotime",
  [DataFieldType.UniqueId]: "unique_id",
};

/**
 * The property type to declare for a field created without a value, so the
 * frame lists it although no note carries its key. A rollup declares itself
 * through its own config; a field typed otherwise declares nothing.
 */
export function declaredPropertyType(field: DataField): ProjectPropertyType | undefined {
  if (field.type === DataFieldType.Date && field.typeConfig?.time) return "datetime";
  return DECLARED_TYPES[field.type];
}

/** The base's formula properties, as the formula pass takes them (R3). */
export function formulaPropertiesOf(
  fieldConfig: DeclaredRelations | undefined
): { name: string; expression: string; formulaVersion?: string }[] {
  if (!fieldConfig) return [];
  return Object.entries(fieldConfig)
    .filter(([, cfg]) => typeof cfg?.formula === "string" && cfg.formula.trim() !== "")
    .map(([name, cfg]) => ({ name, expression: cfg!.formula!, ...(cfg!.formulaVersion !== undefined ? { formulaVersion: cfg!.formulaVersion } : {}) }));
}
