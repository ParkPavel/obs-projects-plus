import type { AggregationFunction, TransformStep } from "src/lib/dashboard-engine/transformTypes";
import type { ViewInspectionTools } from "./projectViewCheck";
import { projectShapeChecks, type ProjectShapeRule, type SchemaLocation } from "./projectShapeCheck";

const functions: Record<AggregationFunction, true> = { SUM: true, AVG: true, MEDIAN: true, MIN: true, MAX: true, RANGE: true, COUNT: true, COUNT_DISTINCT: true, FIRST: true, LAST: true, STD_DEV: true, PCT_EMPTY: true, PCT_NOT_EMPTY: true };

/** Inspect stored pipeline shape without compiling patterns, evaluating formulas or resolving joins. */
export function projectTransformRule(tools: ViewInspectionTools, filter: (value: unknown, at: SchemaLocation) => void): ProjectShapeRule {
  const s = projectShapeChecks(tools), r = s.required, str = s.string;
  const aggregation = s.enumeration(Object.keys(functions));
  const steps: Record<TransformStep["type"], ProjectShapeRule> = {
    unnest: s.shape({ type: r(s.enumeration(["unnest"])), disabled: s.boolean, field: r(str), fields: s.array(str), prefix: str, keepOriginal: s.boolean }),
    unpivot: s.shape({ type: r(s.enumeration(["unpivot"])), disabled: s.boolean, fieldGroups: r(s.array(s.shape({ pattern: r(str), outputName: r(str) }))), keepFields: r(s.array(str)) }),
    compute: s.shape({ type: r(s.enumeration(["compute"])), disabled: s.boolean, columns: r(s.array(s.shape({ name: r(str), expression: r(str), formulaVersion: s.enumeration(["unified-v1"]) }))) }),
    filter: s.shape({ type: r(s.enumeration(["filter"])), disabled: s.boolean, conditions: r(s.rule(filter)) }),
    "group-by": s.shape({ type: r(s.enumeration(["group-by"])), disabled: s.boolean, fields: r(s.array(str)), dateGrouping: s.shape({ field: r(str), granularity: r(s.enumeration(["day", "week", "month", "quarter", "year"])), outputField: str }) }),
    aggregate: s.shape({ type: r(s.enumeration(["aggregate"])), disabled: s.boolean, columns: r(s.array(s.shape({ sourceField: r(str), outputName: r(str), function: r(aggregation) }))) }),
    pivot: s.shape({ type: r(s.enumeration(["pivot"])), disabled: s.boolean, categoryField: r(str), valueField: r(str), aggregation: r(aggregation) }),
    join: s.shape({ type: r(s.enumeration(["join"])), disabled: s.boolean, rightSourceId: r(str), on: r(s.shape({ leftKey: r(str), rightKey: r(str) })), how: r(s.enumeration(["inner", "left"])), aggregation, suffix: str }),
  };
  const step = s.rule((value, at) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) { tools.issue(at, "invalid-type"); return; }
    const type = (value as Record<string, unknown>)['type'];
    if (typeof type !== "string") { tools.issue([...at, "type"], "invalid-type"); return; }
    // Own lookup: input may contain prototype-looking discriminator strings.
    if (!Object.prototype.hasOwnProperty.call(steps, type)) { tools.issue([...at, "type"], "unknown-kind"); return; }
    steps[type as TransformStep["type"]].inspect(value, at);
  });
  return s.shape({ steps: r(s.array(step)) });
}
