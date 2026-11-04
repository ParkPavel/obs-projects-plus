// src/ui/views/Dashboard/engine/transformExecutor.ts

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
  TransformContext,
  UnnestStep,
  UnpivotStep,
  ComputeStep,
  FilterStep,
  GroupByStep,
  AggregateStep,
  PivotStep,
  JoinStep,
  AggregationFunction,
} from "./transformTypes";
import { matchesFilterConditions } from "src/lib/engine/filterEvaluator";
import { isNumeric, toNumber, toNumbers } from "src/lib/engine/numeric";
import { aggregate, type RollupFunction } from "src/lib/engine/aggregate";
import { createFormulaPass, evaluateFormulaValue } from "./formulaEngine";
import { evaluateFormulaValue as evaluateCanonicalFormulaValue } from "src/lib/formula";
import { evaluateVersionedFormula } from "src/lib/formula/version";
import { compileSafeRegex } from "src/lib/helpers/regexSafety";
import { joinKey } from "./joinKey";
import { dateBucket as truncateDate } from "./dateBucket";
import { createTransformBudget, type TransformBudget } from "./transformBudget";

/** Canonical step order for validation */
const STEP_ORDER: Record<TransformStep["type"], number> = {
  unnest: 0,
  unpivot: 0,
  join: 0,
  compute: 1,
  filter: 2,
  "group-by": 3,
  aggregate: 4,
  pivot: 5,
};

const MAX_OUTPUT_RECORDS = 100_000;
const MAX_UNPIVOT_FIELD_NAME_LENGTH = 256;

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
  pipeline: TransformPipeline,
  context?: TransformContext
): TransformResult {
  const startTime = performance.now();
  const budget = createTransformBudget(context, startTime);
  const warnings: string[] = [];

  // #099 — disabled steps are skipped non-destructively (they remain in the
  // pipeline so the user can re-enable). Filter once; validation and execution
  // both operate on the active steps so counts/meta stay consistent.
  const activeSteps = pipeline.steps.filter((s) => !s.disabled);

  // Validate step order
  warnings.push(...validatePipelineOrder(activeSteps));

  let current = source;
  let stepsExecuted = 0;

  for (const step of activeSteps) {
    try {
      budget.charge();
      const next = executeStep(current, step, warnings, budget, context);
      // Formula surfaces may catch evaluation errors; retain the terminal
      // budget failure and never publish a partially evaluated step.
      budget.check();
      current = next;
      stepsExecuted++;
    } catch (error) {
      if (!budget.failure) throw error;
      warnings.push(budget.failure.message);
      break;
    }
  }

  const derivedFields = current.fields.filter(
    (f) => !source.fields.some((sf) => sf.name === f.name)
  );

  return {
    data: current,
    derivedFields,
    meta: {
      ...(budget.stopped ? { stopped: budget.stopped } : {}),
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
  warnings: string[],
  budget: TransformBudget,

  context?: TransformContext
): DataFrame {
  switch (step.type) {
    case "unnest":
      return executeUnnest(df, step, warnings, budget);
    case "unpivot":
      return executeUnpivot(df, step, warnings, budget);
    case "compute":
      return executeCompute(df, step, warnings, budget);
    case "filter":
      return executeFilter(df, step, warnings, budget);
    case "group-by":
      return executeGroupBy(df, step, warnings, budget);
    case "aggregate":
      return executeAggregate(df, step, warnings, budget);
    case "pivot":
      return executePivot(df, step, warnings, budget);
    case "join":
      return executeJoin(df, step, warnings, budget, context);
  }
}

// ── UNNEST ───────────────────────────────────────────────────

/**
 * Expand a field containing an array of objects into multiple rows.
 *
 * Given a record with field "exercises" = `[{name:"Bench", sets:3}, {name:"Squat", sets:4}]`,
 * UNNEST("exercises") produces 2 rows, each inheriting parent fields plus
 * "name" and "sets" as new scalar columns.
 *
 * If the field contains a flat array (not objects), each element becomes a single
 * "_value" column.
 */
function executeUnnest(
  df: DataFrame,
  step: UnnestStep,
  warnings: string[],
  budget: TransformBudget
): DataFrame {
  const sourceField = step.field;
  const prefix = step.prefix ?? "";
  const keepOriginal = step.keepOriginal ?? false;
  const pickFields = step.fields ? new Set(step.fields) : null;

  // Discover all sub-keys from nested objects across all records
  const discoveredKeys = new Set<string>();
  const arrayData: Array<{ record: DataRecord; items: unknown[] }> = [];

  for (const record of df.records) {
    budget.charge();
    const raw = record.values[sourceField];
    if (!Array.isArray(raw) || raw.length === 0) {
      // Non-array or empty → keep as single row with nulls for nested fields
      arrayData.push({ record, items: [null] });
      continue;
    }
    arrayData.push({ record, items: raw });
    for (const item of raw) {
      budget.charge();
      if (item != null && typeof item === "object" && !Array.isArray(item) && !(item instanceof Date)) {
        for (const key of Object.keys(item)) {
          budget.charge();
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
    (f) => {
      budget.charge();
      return keepOriginal || f.name !== sourceField;
    }
  );
  const newFields: DataField[] = [
    ...parentFields,
    { name: `${prefix}_index`, type: DataFieldType.Number, repeated: false, identifier: false, derived: true },
    ...newFieldNames.map((key): DataField => {
      budget.charge();
      return ({
      name: `${prefix}${key}`,
      type: DataFieldType.Unknown,
      repeated: false,
      identifier: false,
      derived: true,
    });
    }),
  ];

  // Build expanded records
  const newRecords: DataRecord[] = [];
  let rowIdx = 0;

  for (const { record, items } of arrayData) {
    budget.charge();
    for (let i = 0; i < items.length; i++) {
      budget.charge();
      const item = items[i];
      const parentValues: Record<string, DataValue | undefined> = {};

      // Copy parent fields
      for (const f of parentFields) {
        budget.charge();
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
          budget.charge();
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

function safeRegexExec(
  regex: RegExp,
  input: string
): RegExpExecArray | null {
  if (input.length > MAX_UNPIVOT_FIELD_NAME_LENGTH) return null;
  return regex.exec(input);
}

function findFieldByIndex(
  fields: readonly DataField[],
  regex: RegExp,
  index: string,

  budget: TransformBudget
): string | null {
  for (const field of fields) {
    budget.charge();
    const match = safeRegexExec(regex, field.name);
    if (match?.[1] === index) {
      return field.name;
    }
  }
  return null;
}

function executeUnpivot(
  df: DataFrame,
  step: UnpivotStep,
  warnings: string[],
  budget: TransformBudget
): DataFrame {
  const compiledPatterns = step.fieldGroups.map((fg) => {
    budget.charge();
    const result = compileSafeRegex(fg.pattern, "", { fullMatch: true });
    if (!result.ok) {
      warnings.push(
        `Unpivot: skipped regex pattern ${JSON.stringify(fg.pattern.slice(0, 80))} (${result.issue})`
      );
    }
    return {
      pattern: fg.pattern,
      regex: result.ok ? result.regex : null,
    };
  });

  if (
    compiledPatterns.some((pattern) => {
      budget.charge();
      return pattern.regex;
    }) &&
    df.fields.some((field) => {
      budget.charge();
      return field.name.length > MAX_UNPIVOT_FIELD_NAME_LENGTH;
    })
  ) {
    warnings.push(
      `Unpivot: field names longer than ${MAX_UNPIVOT_FIELD_NAME_LENGTH} characters were skipped`
    );
  }

  // Discover all indices
  const indicesSet = new Set<string>();
  for (const field of df.fields) {
    budget.charge();
    for (const cp of compiledPatterns) {
      budget.charge();
      if (!cp.regex) continue;
      const match = safeRegexExec(cp.regex, field.name);
      if (match?.[1]) {
        indicesSet.add(match[1]);
      }
    }
  }

  const indices = [...indicesSet].sort();
  if (indices.length === 0) {
    warnings.push(
      `Unpivot: no fields matched patterns ${step.fieldGroups.map((g) => {
        budget.charge();
        return g.pattern;
      }).join(", ")}`
    );
    return df;
  }

  // Pre-compute field name mapping: [groupIdx][indexStr] → fieldName
  // Eliminates repeated regex matching inside the hot loop
  const fieldMap = new Map<string, string | null>();
  for (const fg of compiledPatterns) {
    budget.charge();
    for (const idx of indices) {
      budget.charge();
      const key = `${fg.pattern}\0${idx}`;
      fieldMap.set(key, fg.regex ? findFieldByIndex(df.fields, fg.regex, idx, budget) : null);
    }
  }

  const newRecords: DataRecord[] = [];

  for (const record of df.records) {
    budget.charge();
    for (const idx of indices) {
      budget.charge();
      // Skip if all group fields are empty for this index
      const allEmpty = step.fieldGroups.every((fg) => {
        budget.charge();
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
        budget.charge();
        newValues[kf] = record.values[kf];
      }

      // Map group fields
      for (const fg of step.fieldGroups) {
        budget.charge();
        const fieldName = fieldMap.get(`${fg.pattern}\0${idx}`);
        newValues[fg.outputName] = fieldName
          ? record.values[fieldName]
          : undefined;
      }

      // Metadata fields
      newValues["_source_record"] = record.id;
      // coercion-exempt: Class C - `idx` is this loop's own counter, already a number
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

  const newFields = buildUnpivotFields(df.fields, step, budget);
  return { fields: newFields, records: newRecords };
}

function buildUnpivotFields(
  originalFields: readonly DataField[],
  step: UnpivotStep, budget: TransformBudget
): DataField[] {
  const fields: DataField[] = [];

  // Keep fields (preserve original types)
  for (const kf of step.keepFields) {
    budget.charge();
    const orig = originalFields.find((f) => {
      budget.charge();
      return f.name === kf;
    });
    if (orig) {
      fields.push({ ...orig });
    }
  }

  // Output fields from groups
  for (const fg of step.fieldGroups) {
    budget.charge();
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
  warnings: string[],
  budget: TransformBudget
): DataFrame {
  if (step.columns.some(column => {
    budget.charge();
    return column.formulaVersion !== undefined;
  })) {
    return executeVersionedCompute(df, step, warnings, budget);
  }
  // First pass: compute all values to infer types
  const columnValues: (DataValue | undefined | null)[][] = step.columns.map(() => {
    budget.charge();
    return [];
  });
  // i3-final: `df` is not changed while this step runs, so a column aggregate
  // (`SUM(@amount)`) is computed once for the step instead of once per record.
  const pass = createFormulaPass(df, "legacy-computed", undefined, budget.charge);

  const newRecords = df.records.map((record) => {
    budget.charge();
    const newValues = { ...record.values };

    for (let ci = 0; ci < step.columns.length; ci++) {
      budget.charge();
      const col = step.columns[ci]!;
      try {
        // Build a DataRecord that includes previously computed columns in this step
        const evalRecord: DataRecord = { id: record.id, values: newValues };
        const result = evaluateFormulaValue(col.expression, evalRecord, df, pass);
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
      budget.charge();
      const firstVal = columnValues[ci]!.find((v) => {
        budget.charge();
        return v != null;
      });
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

/** New columns see complete earlier columns; legacy aggregates still read the input frame. */
function executeVersionedCompute(df: DataFrame, step: ComputeStep, warnings: string[], budget: TransformBudget): DataFrame {
  let records = df.records.map(record => {
    budget.charge();
    return ({ ...record, values: { ...record.values } });
  });
  const fields = [...df.fields];
  const referenceDate = new Date();
  const legacyPass = createFormulaPass(df, "legacy-computed", referenceDate, budget.charge);
  for (const column of step.columns) {
    budget.charge();
    const unified = column.formulaVersion === "unified-v1";
    const frame = unified ? { fields: [...fields], records } : df;
    const pass = unified ? createFormulaPass(frame, "unified-v1", referenceDate, budget.charge) : legacyPass;
    records = records.map(record => {
      budget.charge();
      const result = column.formulaVersion === undefined
        ? { value: evaluateFormulaValue(column.expression, record, df, legacyPass) }
        : evaluateVersionedFormula(column.expression, column.formulaVersion, { record, frame, pass, referenceDate });
      if (result.error) warnings.push(`Compute error for '${column.name}' on record '${record.id}': ${result.error}`);
      return { ...record, values: { ...record.values, [column.name]: result.value } };
    });
    fields.push({ name: column.name, type: inferFieldType(records.find(record => {
      budget.charge();
      return record.values[column.name] != null;
    })?.values[column.name]), repeated: false, identifier: false, derived: true });
  }
  return { fields, records };
}

/**
 * @deprecated Compatibility adapter for the old numeric-only API. Arithmetic
 * evaluation is delegated to the canonical formula runtime.
 */
export function evaluateExpression(
  expression: string,
  values: Record<string, DataValue | undefined | null>
): number | null {
  // Tokenize: split by operators, preserving them
  const tokens = expression
    .trim()
    .split(/\s*([+\-*/()])\s*/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0 || tokens.includes("(") || tokens.includes(")")) return null;

  // Simple two-pass evaluator (no parentheses for Phase 1)
  const resolvedTokens: (number | string)[] = tokens.map((token) => {
    // Numeric literal. The token comes from the user's expression text, but the
    // grammar it must satisfy is the same one their data satisfies, so there is
    // no reason for this to be a second rule — and it was: this branch carried
    // a `token !== ""` guard that the field-reference branch ten lines below
    // did not (#180a).
    const literal = toNumber(token);
    if (literal !== null) return literal;

    // Operator
    if (["+", "-", "*", "/"].includes(token)) return token;

    // Field reference
    const fieldValue = toNumber(values[token]);
    if (fieldValue !== null) return fieldValue;

    return NaN;
  });

  // Evaluate: first pass * and /, second pass + and -
  return evaluateArithmeticCompatibility(resolvedTokens);
}

function evaluateArithmeticCompatibility(tokens: (number | string)[]): number | null {
  if (tokens.length === 0 || tokens.length % 2 === 0) return null;

  const parts: string[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (index % 2 === 0) {
      if (typeof token !== "number" || !Number.isFinite(token)) return null;
      parts.push(String(token));
    } else {
      if (typeof token !== "string" || !["+", "-", "*", "/"].includes(token)) return null;
      parts.push(token);
    }
  }

  const result = evaluateCanonicalFormulaValue(parts.join(" "), { id: "", values: {} });
  return typeof result === "number" && Number.isFinite(result) ? result : null;
}

// ── FILTER ───────────────────────────────────────────────────

/**
 * Apply FilterDefinition to DataFrame.
 * Reuses existing filter engine from filterFunctions.ts.
 */
function executeFilter(
  df: DataFrame,
  step: FilterStep,
  warnings: string[],
  budget: TransformBudget
): DataFrame {
  if (!step.conditions.conditions.length && !step.conditions.groups?.length) {
    warnings.push("Filter step: empty conditions, returning unchanged data");
    return df;
  }

  const filtered = df.records.filter((record) => {
    budget.charge();
    return matchesFilterConditions(step.conditions, record, undefined, { chargeWork: budget.charge });
  });

  return { fields: df.fields, records: filtered };
}

// ── GROUP BY ─────────────────────────────────────────────────

/**
 * Compute a group key for a record.
 */
function computeGroupKey(
  record: DataRecord,
  fields: readonly string[],
  dateGrouping: GroupByStep["dateGrouping"], budget: TransformBudget
): string {
  const parts: string[] = [];

  for (const field of fields) {
    budget.charge();
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
  warnings: string[],
  budget: TransformBudget
): DataFrame {
  if (step.fields.length === 0) {
    warnings.push("Group-by step: no fields specified, returning unchanged data");
    return df;
  }

  const groups = new Map<string, DataRecord[]>();

  for (const record of df.records) {
    budget.charge();
    const key = computeGroupKey(record, step.fields, step.dateGrouping, budget);
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
    budget.charge();
    const orig = df.fields.find((f) => {
      budget.charge();
      return f.name === fieldName;
    });
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
    .filter((f) => {
      budget.charge();
      return !step.fields.includes(f.name);
    })
    .map((f) => {
      budget.charge();
      return f.name;
    });

  for (const fn of nonGroupFieldNames) {
    budget.charge();
    const orig = df.fields.find((f) => {
      budget.charge();
      return f.name === fn;
    });
    if (orig) {
      outFields.push({ ...orig, repeated: true, identifier: false });
    }
  }

  // Build output records
  const outRecords: DataRecord[] = [];
  for (const [key, records] of groups) {
    budget.charge();
    const representative = records[0] as DataRecord;
    const values: Record<string, DataValue | undefined | null> = {};

    for (const fieldName of step.fields) {
      budget.charge();
      if (dateOutputField && step.dateGrouping && fieldName === step.dateGrouping.field) {
        values[dateOutputField] = truncateDate(representative.values[fieldName], step.dateGrouping.granularity);
      } else {
        values[fieldName] = representative.values[fieldName];
      }
    }

    values["_group_size"] = records.length;

    // Collect arrays for non-group fields
    for (const fn of nonGroupFieldNames) {
      budget.charge();
      values[fn] = records.map((r) => {
        budget.charge();
        return r.values[fn];
      });
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
 * Which kernel operator each pipeline name means.
 *
 * The pipeline's vocabulary is UPPERCASE and is STORED in `widget.transform`,
 * so it cannot be renamed without a migration over the one structure
 * `MANUAL_TESTING_PIPELINE.md` §4a records as silently swallowing a malformed
 * step. It is mapped instead — read-time, write-time untouched.
 *
 * `COUNT` → `count_total` and not `count_values`: it has always been
 * `arr.length`, nulls included, and `chartDataPipeline.ts` maps `count_total`
 * to it, so every chart stands on that meaning.
 */
const KERNEL_FN: Partial<Record<AggregationFunction, RollupFunction>> = {
  COUNT: "count_total",
  COUNT_DISTINCT: "count_unique",
  SUM: "sum",
  AVG: "avg",
  MEDIAN: "median",
  MIN: "min",
  MAX: "max",
  RANGE: "range",
  PCT_EMPTY: "percent_empty",
  PCT_NOT_EMPTY: "percent_not_empty",
};

/**
 * Compute a single aggregation function on a value array.
 *
 * Since #180 T3 this is an ADAPTER, not a third implementation. It was the
 * project's third answer to "reduce a list to a number" — after the kernel and
 * the table footer — and the three disagreed in the ways #180a and #180b spent
 * their reviews on. What is left here is only what the kernel does not have:
 *
 *   - `FIRST` / `LAST` — positional, not statistical.
 *   - `STD_DEV` — no kernel equivalent. Population sigma, as before.
 *
 * The parity snapshot (`__tests__/aggregationParity.test.ts`) is what made the
 * change reviewable: it recorded every answer before the delegation, so the
 * flips are a diff rather than a claim.
 */
function computeAggFn(
  fn: AggregationFunction,
  val: DataValue | undefined | null,
  warnings: string[],
  budget: TransformBudget
): DataValue | null {
  const arr = Array.isArray(val) ? val : (val != null ? [val] : []);
  // Native/kernel reductions are charged before entering them, including sort work.
  budget.charge(arr.length * (fn === "MEDIAN" ? Math.max(1, Math.ceil(Math.log2(arr.length + 1))) : 1));

  const kernelFn = KERNEL_FN[fn];
  if (kernelFn) {
    // An empty ARRAY is a value to the kernel and an empty CELL to this
    // pipeline — a multi-value field with nothing in it. Normalising it to
    // null at the boundary keeps `PCT_EMPTY` answering what it always has,
    // which is the one place the two vocabularies genuinely differed.
    const normalised = arr.map((v) => {
      budget.charge();
      return (Array.isArray(v) && v.length === 0 ? null : v);
    });
    const result = aggregate(normalised, {
      relationField: "",
      targetField: "",
      function: kernelFn,
    });
    return result.value;
  }

  switch (fn) {
    case "FIRST":
      return arr.length > 0 ? (arr[0] ?? null) : null;

    case "LAST":
      return arr.length > 0 ? (arr[arr.length - 1] ?? null) : null;

    case "STD_DEV": {
      const nums = toNumbers(arr);
      if (nums.length === 0) return null;
      const avg = nums.reduce((a, b) => {
        budget.charge();
        return a + b;
      }, 0) / nums.length;
      const variance = nums.reduce((sum, x) => {
        budget.charge();
        return sum + (x - avg) ** 2;
      }, 0) / nums.length;
      return Math.sqrt(variance);
    }

    default:
      warnings.push(`Unknown aggregation function: ${fn as string}`);
      return null;
  }
}

/** The row-count column group-by writes; its presence marks a grouped frame. */
const GROUP_SIZE_FIELD = "_group_size";

/**
 * Fold every record into a single group row holding, per aggregated column,
 * the list of all its values — exactly what a group-by on one shared key
 * builds, so the two roads give the same number. A list inside a record stays
 * one element of that list, as it does after a group-by; flattening it made
 * [[1,2], 3] sum to 6 here and to 3 everywhere else (math-review). Non-
 * aggregated fields are dropped: across the table they have no single value.
 */
function collapseToOneGroup(df: DataFrame, step: AggregateStep, budget: TransformBudget): DataFrame {
  const sources = [...new Set(step.columns.map((c) => {
    budget.charge();
    return c.sourceField;
  }))];
  const values: Record<string, DataValue | undefined | null> = { [GROUP_SIZE_FIELD]: df.records.length };
  for (const name of sources) {
    budget.charge();
    values[name] = df.records.map((r) => {
      budget.charge();
      return r.values[name];
    });
  }
  const fields: DataField[] = [
    { name: GROUP_SIZE_FIELD, type: DataFieldType.Number, repeated: false, identifier: false, derived: true },
    ...sources.map((name) => {
      budget.charge();
      const orig = df.fields.find((f) => {
        budget.charge();
        return f.name === name;
      });
      return { ...(orig ?? { name, type: DataFieldType.Number, identifier: false, derived: false }), repeated: true };
    }),
  ];
  return { fields, records: [{ id: "group__all", values }] };
}

/**
 * AGGREGATE step: replaces grouped array fields with computed aggregations.
 * Best used after GROUP BY, but can also work on ungrouped data (treats all records as one group).
 */
function executeAggregate(
  df: DataFrame,
  step: AggregateStep,
  warnings: string[],
  budget: TransformBudget
): DataFrame {
  if (step.columns.length === 0) {
    warnings.push("Aggregate step: no columns specified");
    return df;
  }

  // Without a group-by the whole frame is one group, as documented above: a
  // total over the table, not a per-row "sum of one value" (math oracles,
  // 2026-09-26). The one exception is a single record whose aggregated
  // fields each hold a list: that list is the population to reduce (the
  // "sum this record's list" case). A single scalar — null included — is a
  // population of one, and collapses like any other frame (math-recheck2).
  const grouped = df.fields.some((f) => {
    budget.charge();
    return f.name === GROUP_SIZE_FIELD;
  });
  const listRow =
    df.records.length === 1 &&
    step.columns.every((c) => {
      budget.charge();
      return Array.isArray(df.records[0]!.values[c.sourceField]);
    });
  const input = grouped || listRow ? df : collapseToOneGroup(df, step, budget);

  // Build new fields: keep existing non-aggregated fields, add aggregated ones
  const aggregatedSourceFields = new Set(step.columns.map((c) => {
    budget.charge();
    return c.sourceField;
  }));
  const keptFields = input.fields.filter((f) => {
    budget.charge();
    return !aggregatedSourceFields.has(f.name);
  });

  const newFields: DataField[] = [
    ...keptFields,
    ...step.columns.map((col) => {
      budget.charge();
      return ({
      name: col.outputName,
      type: DataFieldType.Number,
      repeated: false,
      identifier: false,
      derived: true,
    });
    }),
  ];

  const newRecords = input.records.map((record) => {
    budget.charge();
    const values: Record<string, DataValue | undefined | null> = {};

    // Copy non-aggregated fields
    for (const f of keptFields) {
      budget.charge();
      values[f.name] = record.values[f.name];
    }

    // Compute aggregations
    for (const col of step.columns) {
      budget.charge();
      values[col.outputName] = computeAggFn(
        col.function,
        record.values[col.sourceField],
        warnings, budget
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
  warnings: string[],
  budget: TransformBudget
): DataFrame {
  if (!step.categoryField || !step.valueField) {
    warnings.push("Pivot step: categoryField and valueField are required");
    return df;
  }

  const catFieldExists = df.fields.some((f) => {
    budget.charge();
    return f.name === step.categoryField;
  });
  const valFieldExists = df.fields.some((f) => {
    budget.charge();
    return f.name === step.valueField;
  });

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
    budget.charge();
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
    {
      budget.charge();
    return a.localeCompare(b, undefined, { numeric: true });
  }
  );

  // 2. Identify row-key fields (everything except category + value fields)
  const rowKeyFieldNames = df.fields
    .filter((f) => {
      budget.charge();
      return f.name !== step.categoryField && f.name !== step.valueField;
    })
    .map((f) => {
      budget.charge();
      return f.name;
    });

  // 3. Group records by row-key
  const rowKeyMap = new Map<string, Map<string, (DataValue | undefined | null)[]>>();
  const rowKeyValues = new Map<string, Record<string, DataValue | undefined | null>>();

  for (const record of df.records) {
    budget.charge();
    const keyParts = rowKeyFieldNames.map((fn) => {
      budget.charge();
      const v = record.values[fn];
      return v == null ? "__null__" : String(v);
    });
    const rowKey = keyParts.join("|");

    if (!rowKeyMap.has(rowKey)) {
      rowKeyMap.set(rowKey, new Map());
      const kv: Record<string, DataValue | undefined | null> = {};
      for (const fn of rowKeyFieldNames) {
        budget.charge();
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
    (f) => {
      budget.charge();
      return f.name !== step.categoryField && f.name !== step.valueField;
    }
  );

  const newFields: DataField[] = [
    ...rowKeyFields,
    ...sortedCategories.map((cat) => {
      budget.charge();
      return ({
      name: cat,
      type: DataFieldType.Number,
      repeated: false,
      identifier: false,
      derived: true,
    });
    }),
  ];

  // 5. Build output records
  const newRecords: DataRecord[] = [];
  let rowIdx = 0;

  for (const [rowKey, catMap] of rowKeyMap) {
    budget.charge();
    const baseValues = rowKeyValues.get(rowKey)!;
    const values: Record<string, DataValue | undefined | null> = { ...baseValues };

    for (const cat of sortedCategories) {
      budget.charge();
      const cellValues = catMap.get(cat);
      if (!cellValues || cellValues.length === 0) {
        values[cat] = null;
      } else {
        values[cat] = computeAggFn(step.aggregation, cellValues, warnings, budget);
      }
    }

    newRecords.push({
      id: `pivot_${rowIdx++}`,
      values,
    });
  }

  return { fields: newFields, records: newRecords };
}

// ── JOIN (Pillar 5 — cross-type correlation) ─────────────────

const MAX_JOIN_OUTPUT_RECORDS = MAX_OUTPUT_RECORDS;

/**
 * Normalise a key value for equality comparison.
 * Delegates to shared `joinKey` — dates and ISO-date strings share one key,
 * callers can pre-project for finer-grained joins via FORMAT_DATE compute.
 */
function joinKeyOf(v: DataValue | undefined | null): string {
  return joinKey(v);
}

/**
 * JOIN step: hash-join the pipeline's DataFrame (left) with a pre-resolved
 * right-hand DataFrame looked up from `context.rightFrames[step.rightSourceId]`.
 *
 * Output schema: left fields (unchanged) ⊕ right fields (left-key excluded,
 * colliding names suffixed by `step.suffix ?? "__r"`).
 *
 * Semantics:
 *  - `how: "inner"` drops left rows with no right match.
 *  - `how: "left"` keeps unmatched left rows (right fields filled with null).
 *  - `aggregation` set → each left row gets at most one merged right row: numeric
 *    right columns are reduced via the aggregation fn; non-numeric columns take FIRST match.
 *  - `aggregation` unset → cartesian expansion (one output row per match pair).
 */
function executeJoin(
  df: DataFrame,
  step: JoinStep,
  warnings: string[],
  budget: TransformBudget,

  context?: TransformContext
): DataFrame {
  const rightFrame = context?.rightFrames?.get(step.rightSourceId);
  if (!rightFrame) {
    warnings.push(
      `Join step: right-hand frame '${step.rightSourceId}' not resolved; skipping`
    );
    return df;
  }

  const { leftKey, rightKey } = step.on;
  const suffix = step.suffix ?? "__r";

  if (!df.fields.some((f) => {
    budget.charge();
    return f.name === leftKey;
  })) {
    warnings.push(`Join step: leftKey '${leftKey}' not found in current frame`);
    return df;
  }
  if (!rightFrame.fields.some((f) => {
    budget.charge();
    return f.name === rightKey;
  })) {
    warnings.push(
      `Join step: rightKey '${rightKey}' not found in right frame '${step.rightSourceId}'`
    );
    return df;
  }

  // Build new field list: left ⊕ right (excluding right-key, suffixing collisions).
  const leftNames = new Set(df.fields.map((f) => {
    budget.charge();
    return f.name;
  }));
  const rightOutFields: DataField[] = [];
  const rightNameMap = new Map<string, string>(); // original → output
  for (const f of rightFrame.fields) {
    budget.charge();
    if (f.name === rightKey) continue;
    const outName = leftNames.has(f.name) ? `${f.name}${suffix}` : f.name;
    rightNameMap.set(f.name, outName);
    rightOutFields.push({ ...f, name: outName, derived: true });
  }
  const newFields: DataField[] = [...df.fields, ...rightOutFields];

  // Build hash index on right frame.
  const bucket = new Map<string, DataRecord[]>();
  for (const r of rightFrame.records) {
    budget.charge();
    const k = joinKeyOf(r.values[rightKey]);
    const list = bucket.get(k);
    if (list) list.push(r);
    else bucket.set(k, [r]);
  }

  const newRecords: DataRecord[] = [];
  let joinedRowIdx = 0;

  for (const left of df.records) {
    budget.charge();
    const k = joinKeyOf(left.values[leftKey]);
    const matches = bucket.get(k);

    if (!matches || matches.length === 0) {
      if (step.how === "left") {
        const values: Record<string, DataValue | undefined | null> = { ...left.values };
        for (const [, outName] of rightNameMap) { budget.charge(); values[outName] = null; }
        newRecords.push({ id: `${left.id}__joinL`, values });
      }
      continue;
    }

    if (step.aggregation) {
      // Reduce matches → single merged row.
      const values: Record<string, DataValue | undefined | null> = { ...left.values };
      for (const [orig, outName] of rightNameMap) {
        budget.charge();
        const gathered: DataValue[] = [];
        for (const m of matches) {
          budget.charge();
          const v = m.values[orig];
          if (v != null) gathered.push(v);
        }
        if (gathered.length === 0) {
          values[outName] = null;
          continue;
        }
        // #180a: was its own numeric-ness expression, which is how a fifth
        // implementation appears. A join that aggregates must agree with the
        // aggregate about what a number is.
        const allNumeric = gathered.every(isNumeric);
        values[outName] = allNumeric
          ? computeAggFn(step.aggregation, gathered, warnings, budget)
          : (gathered[0] ?? null);
      }
      newRecords.push({ id: `${left.id}__joinA`, values });
    } else {
      // Cartesian expansion.
      for (const right of matches) {
        budget.charge();
        if (newRecords.length >= MAX_JOIN_OUTPUT_RECORDS) {
          warnings.push(
            `Join truncated: output exceeds ${MAX_JOIN_OUTPUT_RECORDS} records`
          );
          return { fields: newFields, records: newRecords };
        }
        const values: Record<string, DataValue | undefined | null> = { ...left.values };
        for (const [orig, outName] of rightNameMap) {
          budget.charge();
          values[outName] = right.values[orig];
        }
        newRecords.push({ id: `${left.id}__join_${joinedRowIdx++}`, values });
      }
    }
  }

  return { fields: newFields, records: newRecords };
}
