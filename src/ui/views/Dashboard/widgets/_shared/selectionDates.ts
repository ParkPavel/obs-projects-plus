import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { FilterCondition } from "src/settings/settings";
import { dateBucket, type DateGranularity } from "src/lib/dashboard-engine/dateBucket";
import { matchesCondition } from "src/lib/engine/filterEvaluator";

/** Project the original field through GROUP BY, then use the canonical filter. */
export function filterSelectionDates(records: readonly DataRecord[], condition: FilterCondition, grouping: DateGranularity): DataRecord[] {
  return records.filter(record => matchesCondition(condition, {
    ...record, values: { ...record.values, [condition.field]: dateBucket(record.values[condition.field], grouping) },
  }));
}
