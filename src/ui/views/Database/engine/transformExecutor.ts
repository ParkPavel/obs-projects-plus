// src/ui/views/Database/engine/transformExecutor.ts

import type {
  DataFrame,
  DataField,
  DataRecord,
  DataValue,
} from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type {
  TransformPipeline,
  TransformResult,
  TransformStep,
  UnnestStep,
  UnpivotStep,
  ComputeStep,
  FilterStep,
  GroupByStep,
  AggregateStep,
  PivotStep,
  AggregationFunction,
} from "./transformTypes";
import { matchesFilterConditions } from "src/ui/app/filterFunctions";
import { evaluateFormulaValue } from "./formulaEngine";
import { isUnsafePattern } from "src/lib/helpers/regexSafety";

/** Canonical step order for validation */
const STEP_ORDER: Record<TransformStep["type"], number> = {
  unnest: 0,
  unpivot: 0,
  compute: 1,
  filter: 2,
  "group-by": 3,
  aggregate: 4,
  pivot: 5,
};

const PIPELINE_TIMEOUT_MS = 2000;
const MAX_OUTPUT_RECORDS = 100_000;

/**
 * Validate that pipeline steps follow canonical order.
 * Returns warnings for out-of-order steps.
 */
function validatePipelineOrder(steps: readonly TransformStep[]): string[] {
  const warnings: string[] = [];
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1] as TransformStep;
    const curr = steps[i] as TransformStep;
    if (STEP_ORDER[curr.type] < STEP_ORDER[prev.type]) {
      warnings.push(
        `Step order warning: ${curr.type} after ${prev.type}`
      );
    }
  }
  return warnings;
}

/**
 * Execute a transform pipeline on a DataFrame.
 * Input: Enriched DataFrame (after Relation/Formula/Rollup + project-level Filter/Sort).
 */
export function executeTransform(
  source: DataFrame,
  pipeline: TransformPipeline
): TransformResult {
  const startTime = performance.now();
  const warnings: string[] = [];

  // Validate step order
  warnings.push(...validatePipelineOrder(pipeline.steps));

  let current = source;
  let stepsExecuted = 0;

  for (const step of pipeline.steps) {
    // Failsafe timeout
    if (performance.now() - startTime > PIPELINE_TIMEOUT_MS) {
      warnings.push(
        `Pipeline aborted: exceeded ${PIPELINE_TIMEOUT_MS}ms timeout after ${stepsExecuted} steps`
      );
      break;
    }

    current = executeStep(current, step, warnings);
    stepsExecuted++;
  }

  const derivedFields = current.fields.filter(
    (f) => !source.fields.some((sf) => sf.name === f.name)
  );

  return {
    data: current,
    derivedFields,
    meta: {
      stepsExecuted,
      executionTimeMs: performance.now() - startTime,
      inputRowCount: source.records.length,
      outputRowCount: current.records.length,
      warnings,
    },
  };
}

function executeStep(
  df: DataFrame,
  step: TransformStep,
  warnings: string[]
): DataFrame {
  switch (step.type) {
    case "unnest":
      return executeUnnest(df, step, warnings);
    case "unpivot":
      return executeUnpivot(df, step, warnings);
    case "compute":
      return executeCompute(df, step, warnings);
    case "filter":
      return executeFilter(df, step, warnings);
    case "group-by":
      return executeGroupBy(df, step, warnings);
    case "aggregate":
      return executeAggregate(df, step, warnings);
    case "pivot":
      return executePivot(df, step, warnings);
  }
}

// ── UNNEST ───────────────────────────────────────────────────

/**
 * Expand a field containing an array of objects into multiple rows.
 *
 * Given a record with field "exercises" = [{name:"Bench", sets:3}, {name:"Squat", sets:4}],
 * UNNEST("exercises") produces 2 rows, each inheriting parent fields plus
 * "name" and "sets" as new scalar columns.
 *
 * If the field contains a flat array (not objects), each element becomes a single
 * "_value" column.
 */
function executeUnnest(
  df: DataFrame,
  step: UnnestStep,
  warnings: string[]
): DataFrame {
  const sourceField = step.field;
  const prefix = step.prefix ?? "";
  const keepOriginal = step.keepOriginal ?? false;
  const pickFields = step.fields ? new Set(step.fields) : null;

  // Discover all sub-keys from nested objects across all records
  const discoveredKeys = new Set<string>();
  const arrayData: Array<{ record: DataRecord; items: unknown[] }> = [];

  for (const record of df.records) {
    const raw = record.values[sourceField];
    if (!Array.isArray(raw) || raw.length === 0) {
      // Non-array or empty → keep as single row with nulls for nested fields
      arrayData.push({ record, items: [null] });
      continue;
    }
    arrayData.push({ record, items: raw });
    for (const item of raw) {
      if (item != null && typeof item === "object" && !Array.isArray(item) && !(item instanceof Date)) {
        for (const key of Object.keys(item as Record<string, unknown>)) {
          if (!pickFields || pickFields.has(key)) {
            discoveredKeys.add(key);
          }
        }
      }
    }
  }

  // If no object keys found, treat as flat array → single "_value" column
  const isObjectArray = discoveredKeys.size > 0;
  const newFieldNames = isObjectArray
    ? [...discoveredKeys].sort()
    : ["_value"];

  // Build new fields list
  const parentFields = df.fields.filter(
    (f) => keepOriginal || f.name !== sourceField
  );
  const newFields: DataField[] = [
    ...parentFields,
    { name: `${prefix}_index`, type: DataFieldType.Number, repeated: false, identifier: false, derived: true },
    ...newFieldNames.map((key): DataField => ({
      name: `${prefix}${key}`,
      type: DataFieldType.Unknown,
      repeated: false,
      identifier: false,
      derived: true,
    })),
  ];

  // Build expanded records
  const newRecords: DataRecord[] = [];
  let rowIdx = 0;

  for (const { record, items } of arrayData) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const parentValues: Record<string, DataValue | undefined> = {};

      // Copy parent fields
      for (const f of parentFields) {
        parentValues[f.name] = record.values[f.name] as DataValue | undefined;
      }

      // Add index
      parentValues[`${prefix}_index`] = i;

      // Extract nested values
      if (item == null) {
        // null item → all nested fields undefined
      } else if (isObjectArray && typeof item === "object" && !Array.isArray(item) && !(item instanceof Date)) {
        const obj = item as Record<string, unknown>;
        for (const key of newFieldNames) {
          const val = obj[key];
          if (val !== undefined && (typeof val === "string" || typeof val === "number" || typeof val === "boolean")) {
            parentValues[`${prefix}${key}`] = val;
          } else if (val instanceof Date) {
            parentValues[`${prefix}${key}`] = val;
          }
          // Complex nested objects are silently dropped (not supported in DataValue)
        }
      } else {
        // Flat array item → _value column
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          parentValues[`${prefix}_value`] = item;
        }
      }

      if (newRecords.length >= MAX_OUTPUT_RECORDS) {
        warnings.push(
          `UNNEST truncated: output exceeds ${MAX_OUTPUT_RECORDS} records`
        );
        return { fields: newFields, records: newRecords };
      }

      newRecords.push({
        id: `${record.id}__unnest_${rowIdx++}`,
        values: parentValues,
      });
    }
  }

  return { fields: newFields, records: newRecords };
}

// ── UNPIVOT ──────────────────────────────────────────────────

/**
 * Safe regex execution with ReDoS mitigation.
 */
function safeRegexExec(
  pattern: string,
  input: string
): RegExpExecArray | null {
  // Check pattern safety BEFORE constructing RegExp
  if (isUnsafePattern(pattern)) return null;

  // Field names should be short
  if (input.length > 256) return null;

  let regex: RegExp;
  try {
    regex = new RegExp(`^${pattern}$`);
  } catch {
    return null;
  }

  return regex.exec(input);
}

function findFieldByIndex(
  fields: readonly DataField[],
  pattern: string,
  index: string
): string | null {
  for (const field of fields) {
    const match = safeRegexExec(pattern, field.name);
    if (match?.[1] === index) {
      return field.name;
    }
  }
  return null;
}

function executeUnpivot(
  df: DataFrame,
  step: UnpivotStep,
  warnings: string[]
): DataFrame {
  const compiledPatterns = step.fieldGroups.map((fg) => ({
    regex: safeRegexCompile(fg.pattern),
    outputName: fg.outputName,
  }));

  // Discover all indices
  const indicesSet = new Set<string>();
  for (const field of df.fields) {
    for (const cp of compiledPatterns) {
      if (!cp.regex) continue;
      const match = cp.regex.exec(field.name);
      if (match?.[1]) {
        indicesSet.add(match[1]);
      }
    }
  }

  const indices = [...indicesSet].sort();
  if (indices.length === 0) {
    warnings.push(
      `Unpivot: no fields matched patterns ${step.fieldGroups.map((g) => g.pattern).join(", ")}`
    );
    return df;
  }

  // Pre-compute field name mapping: [groupIdx][indexStr] → fieldName
  // Eliminates repeated regex matching inside the hot loop
  const fieldMap = new Map<string, string | null>();
  for (const fg of step.fieldGroups) {
    for (const idx of indices) {
      const key = `${fg.pattern}\0${idx}`;
      fieldMap.set(key, findFieldByIndex(df.fields, fg.pattern, idx));
    }
  }

  const newRecords: DataRecord[] = [];

  for (const record of df.records) {
    for (const idx of indices) {
      // Skip if all group fields are empty for this index
      const allEmpty = step.fieldGroups.every((fg) => {
        const fieldName = fieldMap.get(`${fg.pattern}\0${idx}`);
        return (
          fieldName == null ||
          record.values[fieldName] == null ||
          record.values[fieldName] === ""
        );
      });

      if (allEmpty) continue;

      const newValues: Record<string, DataValue | undefined | null> = {};

      // Copy keepFields
      for (const kf of step.keepFields) {
        newValues[kf] = record.values[kf];
      }

      // Map group fields
      for (const fg of step.fieldGroups) {
        const fieldName = fieldMap.get(`${fg.pattern}\0${idx}`);
        newValues[fg.outputName] = fieldName
          ? record.values[fieldName]
          : undefined;
      }

      // Metadata fields
      newValues["_source_record"] = record.id;
      newValues["_group_index"] = Number(idx);

      newRecords.push({
        id: `${record.id}__${idx}`,
        values: newValues,
      });

      if (newRecords.length >= MAX_OUTPUT_RECORDS) {
        warnings.push(`Unpivot: output capped at ${MAX_OUTPUT_RECORDS} records`);
        break;
      }
    }
    if (newRecords.length >= MAX_OUTPUT_RECORDS) break;
  }

  const newFields = buildUnpivotFields(df.fields, step);
  return { fields: newFields, records: newRecords };
}

function safeRegexCompile(pattern: string): RegExp | null {
  try {
    if (isUnsafePattern(pattern)) return null;
    return new RegExp(`^${pattern}$`);
  } catch {
    return null;
  }
}

function buildUnpivotFields(
  originalFields: readonly DataField[],
  step: UnpivotStep
): DataField[] {
  const fields: DataField[] = [];

  // Keep fields (preserve original types)
  for (const kf of step.keepFields) {
    const orig = originalFields.find((f) => f.name === kf);
    if (orig) {
      fields.push({ ...orig });
    }
  }

  // Output fields from groups
  for (const fg of step.fieldGroups) {
    fields.push({
      name: fg.outputName,
      type: DataFieldType.String,
      repeated: false,
      identifier: false,
      derived: true,
    });
  }

  // Metadata fields
  fields.push({
    name: "_source_record",
    type: DataFieldType.String,
    repeated: false,
    identifier: false,
    derived: true,
  });
  fields.push({
    name: "_group_index",
    type: DataFieldType.Number,
    repeated: false,
    identifier: false,
    derived: true,
  });

  return fields;
}

// ── COMPUTE ──────────────────────────────────────────────────

/**
 * Infer DataFieldType from a computed value.
 */
function inferFieldType(value: DataValue | undefined | null): DataFieldType {
  if (value == null) return DataFieldType.String;
  if (typeof value === "number") return DataFieldType.Number;
  if (typeof value === "boolean") return DataFieldType.Boolean;
  if (value instanceof Date) return DataFieldType.Date;
  return DataFieldType.String;
}

function executeCompute(
  df: DataFrame,
  step: ComputeStep,
  warnings: string[]
): DataFrame {
  // First pass: compute all values to infer types
  const columnValues: (DataValue | undefined | null)[][] = step.columns.map(() => []);

  const newRecords = df.records.map((record) => {
    const newValues = { ...record.values };

    for (let ci = 0; ci < step.columns.length; ci++) {
      const col = step.columns[ci]!;
      try {
        // Build a DataRecord that includes previously computed columns in this step
        const evalRecord: DataRecord = { id: record.id, values: newValues };
        const result = evaluateFormulaValue(col.expression, evalRecord, df);
        newValues[col.name] = result;
        columnValues[ci]!.push(result);
      } catch {
        newValues[col.name] = undefined;
        columnValues[ci]!.push(undefined);
        warnings.push(
          `Compute error for '${col.name}' on record '${record.id}': invalid expression`
        );
      }
    }

    return { ...record, values: newValues };
  });

  // Infer field types from first non-null value
  const newFields: DataField[] = [
    ...df.fields,
    ...step.columns.map((col, ci) => {
      const firstVal = columnValues[ci]!.find((v) => v != null);
      return {
        name: col.name,
        type: inferFieldType(firstVal),
        repeated: false,
        identifier: false,
        derived: true,
      };
    }),
  ];

  return { fields: newFields, records: newRecords };
}

/**
 * @deprecated Legacy arithmetic evaluator — kept for backward compatibility.
 * New code should use evaluateFormulaValue() from formulaEngine.
 */
export function evaluateExpression(
  expression: string,
  values: Record<string, DataValue | undefined | null>
): number | null {
  // Tokenize: split by operators, preserving them
  const tokens = expression
    .trim()
    .split(/\s*([\+\-\*\/\(\)])\s*/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return null;

  // Simple two-pass evaluator (no parentheses for Phase 1)
  const resolvedTokens: (number | string)[] = tokens.map((token) => {
    // Numeric literal
    const num = Number(token);
    if (!isNaN(num) && token !== "") return num;

    // Operator
    if (["+", "-", "*", "/"].includes(token)) return token;

    // Field reference
    const val = values[token];
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const parsed = Number(val);
      if (!isNaN(parsed)) return parsed;
    }

    return NaN;
  });

  // Evaluate: first pass * and /, second pass + and -
  return evaluateTokens(resolvedTokens);
}

function evaluateTokens(tokens: (number | string)[]): number | null {
  // Convert to numbers and operators
  const nums: number[] = [];
  const ops: string[] = [];

  for (const token of tokens) {
    if (typeof token === "number") {
      nums.push(token);
    } else if (typeof token === "string" && ["+", "-", "*", "/"].includes(token)) {
      ops.push(token);
    } else {
      return null; // Invalid token
    }
  }

  if (nums.length === 0) return null;
  if (nums.length !== ops.length + 1) return null;

  // First pass: * and /
  let i = 0;
  while (i < ops.length) {
    if (ops[i] === "*" || ops[i] === "/") {
      const left = nums[i] as number;
      const right = nums[i + 1] as number;
      if (ops[i] === "/" && right === 0) return null; // Division by zero
      nums[i] = ops[i] === "*" ? left * right : left / right;
      nums.splice(i + 1, 1);
      ops.splice(i, 1);
    } else {
      i++;
    }
  }

  // Second pass: + and -
  let result = nums[0] as number;
  for (let j = 0; j < ops.length; j++) {
    const right = nums[j + 1] as number;
    result = ops[j] === "+" ? result + right : result - right;
  }

  return isNaN(result) ? null : result;
}

// ── FILTER ───────────────────────────────────────────────────

/**
 * Apply FilterDefinition to DataFrame.
 * Reuses existing filter engine from filterFunctions.ts.
 */
function executeFilter(
  df: DataFrame,
  step: FilterStep,
  warnings: string[]
): DataFrame {
  if (!step.conditions.conditions.length && !step.conditions.groups?.length) {
    warnings.push("Filter step: empty conditions, returning unchanged data");
    return df;
  }

  const filtered = df.records.filter((record) =>
    matchesFilterConditions(step.conditions, record)
  );

  return { fields: df.fields, records: filtered };
}

// ── GROUP BY ─────────────────────────────────────────────────

/**
 * Truncate a date to the specified granularity.
 */
function truncateDate(dateVal: DataValue | undefined | null, granularity: string): string {
  if (dateVal == null) return "__empty__";

  const d = dateVal instanceof Date ? dateVal : new Date(String(dateVal));
  if (isNaN(d.getTime())) return "__invalid__";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  switch (granularity) {
    case "year":
      return `${year}`;
    case "quarter":
      return `${year}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
    case "month":
      return `${year}-${month}`;
    case "week": {
      // ISO 8601 week: Thursday rule
      const thu = new Date(d.getTime());
      thu.setDate(thu.getDate() + 3 - ((thu.getDay() + 6) % 7));
      const isoYear = thu.getFullYear();
      const jan4 = new Date(isoYear, 0, 4);
      const weekNum = 1 + Math.round(((thu.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
      return `${isoYear}-W${String(weekNum).padStart(2, "0")}`;
    }
    case "day":
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Compute a group key for a record.
 */
function computeGroupKey(
  record: DataRecord,
  fields: readonly string[],
  dateGrouping: GroupByStep["dateGrouping"]
): string {
  const parts: string[] = [];

  for (const field of fields) {
    if (dateGrouping && field === dateGrouping.field) {
      parts.push(truncateDate(record.values[field], dateGrouping.granularity));
    } else {
      const v = record.values[field];
      parts.push(v == null ? "__empty__" : String(v));
    }
  }

  return parts.join("|");
}

/**
 * GROUP BY step: groups records without aggregation.
 * Output: one record per group with group fields + group size metadata.
 * The grouped records are flattened — use AGGREGATE to compute summaries.
 */
function executeGroupBy(
  df: DataFrame,
  step: GroupByStep,
  warnings: string[]
): DataFrame {
  if (step.fields.length === 0) {
    warnings.push("Group-by step: no fields specified, returning unchanged data");
    return df;
  }

  const groups = new Map<string, DataRecord[]>();

  for (const record of df.records) {
    const key = computeGroupKey(record, step.fields, step.dateGrouping);
    const arr = groups.get(key);
    if (arr) {
      arr.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  // Build output fields: group fields + _group_size
  const outFields: DataField[] = [];
  const dateOutputField = step.dateGrouping?.outputField ??
    (step.dateGrouping ? `${step.dateGrouping.field}_${step.dateGrouping.granularity}` : null);

  for (const fieldName of step.fields) {
    const orig = df.fields.find((f) => f.name === fieldName);
    if (dateOutputField && step.dateGrouping && fieldName === step.dateGrouping.field) {
      // Date grouping produces a derived string field
      outFields.push({
        name: dateOutputField,
        type: DataFieldType.String,
        repeated: false,
        identifier: false,
        derived: true,
      });
    } else if (orig) {
      outFields.push({ ...orig, identifier: false });
    }
  }

  outFields.push({
    name: "_group_size",
    type: DataFieldType.Number,
    repeated: false,
    identifier: false,
    derived: true,
  });

  // Also carry forward all non-group fields as arrays (for AGGREGATE step)
  const nonGroupFieldNames = df.fields
    .filter((f) => !step.fields.includes(f.name))
    .map((f) => f.name);

  for (const fn of nonGroupFieldNames) {
    const orig = df.fields.find((f) => f.name === fn);
    if (orig) {
      outFields.push({ ...orig, repeated: true, identifier: false });
    }
  }

  // Build output records
  const outRecords: DataRecord[] = [];
  for (const [key, records] of groups) {
    const representative = records[0] as DataRecord;
    const values: Record<string, DataValue | undefined | null> = {};

    for (const fieldName of step.fields) {
      if (dateOutputField && step.dateGrouping && fieldName === step.dateGrouping.field) {
        values[dateOutputField] = truncateDate(representative.values[fieldName], step.dateGrouping.granularity);
      } else {
        values[fieldName] = representative.values[fieldName];
      }
    }

    values["_group_size"] = records.length;

    // Collect arrays for non-group fields
    for (const fn of nonGroupFieldNames) {
      values[fn] = records.map((r) => r.values[fn]) as unknown as DataValue;
    }

    outRecords.push({
      id: `group__${key}`,
      values,
    });
  }

  return { fields: outFields, records: outRecords };
}

// ── AGGREGATE ────────────────────────────────────────────────

/**
 * Extract numeric values from an array (grouped field values).
 */
function extractNumericValues(val: DataValue | undefined | null): number[] {
  if (!Array.isArray(val)) {
    if (typeof val === "number") return [val];
    return [];
  }
  const nums: number[] = [];
  for (const v of val) {
    if (typeof v === "number") nums.push(v);
    else if (typeof v === "string") {
      const n = Number(v);
      if (!isNaN(n)) nums.push(n);
    }
  }
  return nums;
}

/**
 * Compute a single aggregation function on a value array.
 */
function computeAggFn(
  fn: AggregationFunction,
  val: DataValue | undefined | null,
  warnings: string[]
): DataValue | null {
  const arr = Array.isArray(val) ? val : (val != null ? [val] : []);

  switch (fn) {
    case "COUNT":
      return arr.length;

    case "COUNT_DISTINCT":
      return new Set(arr.filter((v) => v != null).map(String)).size;

    case "SUM": {
      const nums = extractNumericValues(val);
      return nums.reduce((a, b) => a + b, 0);
    }

    case "AVG": {
      const nums = extractNumericValues(val);
      return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    }

    case "MEDIAN": {
      const nums = extractNumericValues(val).sort((a, b) => a - b);
      if (nums.length === 0) return 0;
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 === 0
        ? ((nums[mid - 1] as number) + (nums[mid] as number)) / 2
        : (nums[mid] as number);
    }

    case "MIN": {
      const nums = extractNumericValues(val);
      return nums.length > 0 ? Math.min(...nums) : null;
    }

    case "MAX": {
      const nums = extractNumericValues(val);
      return nums.length > 0 ? Math.max(...nums) : null;
    }

    case "RANGE": {
      const nums = extractNumericValues(val);
      return nums.length > 0 ? Math.max(...nums) - Math.min(...nums) : null;
    }

    case "FIRST":
      return arr.length > 0 ? (arr[0] ?? null) : null;

    case "LAST":
      return arr.length > 0 ? (arr[arr.length - 1] ?? null) : null;

    case "STD_DEV": {
      const nums = extractNumericValues(val);
      if (nums.length === 0) return 0;
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const variance = nums.reduce((sum, x) => sum + (x - avg) ** 2, 0) / nums.length;
      return Math.sqrt(variance);
    }

    case "PCT_EMPTY": {
      const total = arr.length;
      if (total === 0) return 0;
      const empty = arr.filter(
        (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0)
      ).length;
      return (empty / total) * 100;
    }

    case "PCT_NOT_EMPTY": {
      const total = arr.length;
      if (total === 0) return 0;
      const nonEmpty = arr.filter(
        (v) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0)
      ).length;
      return (nonEmpty / total) * 100;
    }

    default:
      warnings.push(`Unknown aggregation function: ${fn as string}`);
      return null;
  }
}

/**
 * AGGREGATE step: replaces grouped array fields with computed aggregations.
 * Best used after GROUP BY, but can also work on ungrouped data (treats all records as one group).
 */
function executeAggregate(
  df: DataFrame,
  step: AggregateStep,
  warnings: string[]
): DataFrame {
  if (step.columns.length === 0) {
    warnings.push("Aggregate step: no columns specified");
    return df;
  }

  // Build new fields: keep existing non-aggregated fields, add aggregated ones
  const aggregatedSourceFields = new Set(step.columns.map((c) => c.sourceField));
  const keptFields = df.fields.filter((f) => !aggregatedSourceFields.has(f.name));

  const newFields: DataField[] = [
    ...keptFields,
    ...step.columns.map((col) => ({
      name: col.outputName,
      type: DataFieldType.Number as DataFieldType,
      repeated: false,
      identifier: false,
      derived: true,
    })),
  ];

  const newRecords = df.records.map((record) => {
    const values: Record<string, DataValue | undefined | null> = {};

    // Copy non-aggregated fields
    for (const f of keptFields) {
      values[f.name] = record.values[f.name];
    }

    // Compute aggregations
    for (const col of step.columns) {
      values[col.outputName] = computeAggFn(
        col.function,
        record.values[col.sourceField],
        warnings
      );
    }

    return { id: record.id, values };
  });

  return { fields: newFields, records: newRecords };
}

// ── PIVOT ────────────────────────────────────────────────────

/**
 * PIVOT step: transforms long format → wide format.
 * categoryField values become new columns, valueField values populate cells.
 * Aggregation handles multiple values mapping to the same (row, category) pair.
 */
function executePivot(
  df: DataFrame,
  step: PivotStep,
  warnings: string[]
): DataFrame {
  if (!step.categoryField || !step.valueField) {
    warnings.push("Pivot step: categoryField and valueField are required");
    return df;
  }

  const catFieldExists = df.fields.some((f) => f.name === step.categoryField);
  const valFieldExists = df.fields.some((f) => f.name === step.valueField);

  if (!catFieldExists) {
    warnings.push(`Pivot step: categoryField '${step.categoryField}' not found`);
    return df;
  }
  if (!valFieldExists) {
    warnings.push(`Pivot step: valueField '${step.valueField}' not found`);
    return df;
  }

  // 1. Collect unique category values (become column headers)
  const categoryValues = new Set<string>();
  for (const record of df.records) {
    const cv = record.values[step.categoryField];
    if (cv != null) categoryValues.add(String(cv));
  }

  if (categoryValues.size === 0) {
    warnings.push("Pivot step: no category values found");
    return df;
  }

  if (categoryValues.size > 200) {
    warnings.push(`Pivot step: ${categoryValues.size} categories (max 200). Consider filtering first.`);
    return df;
  }

  const sortedCategories = Array.from(categoryValues).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  // 2. Identify row-key fields (everything except category + value fields)
  const rowKeyFieldNames = df.fields
    .filter((f) => f.name !== step.categoryField && f.name !== step.valueField)
    .map((f) => f.name);

  // 3. Group records by row-key
  const rowKeyMap = new Map<string, Map<string, (DataValue | undefined | null)[]>>();
  const rowKeyValues = new Map<string, Record<string, DataValue | undefined | null>>();

  for (const record of df.records) {
    const keyParts = rowKeyFieldNames.map((fn) => {
      const v = record.values[fn];
      return v == null ? "__null__" : String(v);
    });
    const rowKey = keyParts.join("|");

    if (!rowKeyMap.has(rowKey)) {
      rowKeyMap.set(rowKey, new Map());
      const kv: Record<string, DataValue | undefined | null> = {};
      for (const fn of rowKeyFieldNames) {
        kv[fn] = record.values[fn];
      }
      rowKeyValues.set(rowKey, kv);
    }

    const catVal = String(record.values[step.categoryField] ?? "");
    const numVal = record.values[step.valueField];

    const catMap = rowKeyMap.get(rowKey)!;
    if (!catMap.has(catVal)) {
      catMap.set(catVal, []);
    }
    catMap.get(catVal)!.push(numVal);
  }

  // 4. Build output fields: row-key fields + pivoted category columns
  const rowKeyFields = df.fields.filter(
    (f) => f.name !== step.categoryField && f.name !== step.valueField
  );

  const newFields: DataField[] = [
    ...rowKeyFields,
    ...sortedCategories.map((cat) => ({
      name: cat,
      type: DataFieldType.Number as DataFieldType,
      repeated: false,
      identifier: false,
      derived: true,
    })),
  ];

  // 5. Build output records
  const newRecords: DataRecord[] = [];
  let rowIdx = 0;

  for (const [rowKey, catMap] of rowKeyMap) {
    const baseValues = rowKeyValues.get(rowKey)!;
    const values: Record<string, DataValue | undefined | null> = { ...baseValues };

    for (const cat of sortedCategories) {
      const cellValues = catMap.get(cat);
      if (!cellValues || cellValues.length === 0) {
        values[cat] = null;
      } else {
        values[cat] = computeAggFn(step.aggregation, cellValues as unknown as DataValue, warnings);
      }
    }

    newRecords.push({
      id: `pivot_${rowIdx++}`,
      values,
    });
  }

  return { fields: newFields, records: newRecords };
}
