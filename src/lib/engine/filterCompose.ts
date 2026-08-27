// Filter-definition algebra: how two stored filters combine into one.
//
// Extracted from legacyMigration (#118) when #125 needed the same rule for a
// second caller. Keeping one implementation matters more here than usual: the
// tricky half is not the AND, it is refusing to flatten an `or`, and a second
// copy of that judgement is a second chance to get it wrong.

import type { FilterDefinition } from "src/settings/base/settings";

/** True when the definition would actually remove something. */
export function hasFilterEffect(
  filter: FilterDefinition | undefined
): filter is FilterDefinition {
  if (!filter) return false;
  // `conditions` is required by the type, but these values come from persisted
  // JSON where an older or hand-edited config may not carry it.
  return (filter.conditions?.length ?? 0) > 0 || (filter.groups?.length ?? 0) > 0;
}

/**
 * AND-compose filter definitions, narrowing with each one.
 *
 * Plain AND definitions are flattened into a single condition list. Nesting
 * them as groups would be equivalent for the engine but produces a
 * `conditions: []` shape, which every "is this filter empty?" guard in the UI
 * reads as no filter at all.
 *
 * An `or` definition is never flattened. Appending a condition to an `or`
 * list would widen the result instead of narrowing it — the opposite of what
 * composing two filters means — so it becomes a nested group whose internal
 * disjunction is preserved.
 */
export function andComposeFilters(
  defs: readonly (FilterDefinition | undefined)[]
): FilterDefinition | undefined {
  const meaningful = defs.filter(hasFilterEffect);
  if (meaningful.length === 0) return undefined;
  if (meaningful.length === 1) return meaningful[0] as FilterDefinition;

  const flattenable = meaningful.every(
    (d) => d.conjunction !== "or" && (d.groups?.length ?? 0) === 0
  );
  if (flattenable) {
    return {
      conjunction: "and",
      conditions: meaningful.flatMap((d) => [...(d.conditions ?? [])]),
    };
  }
  return { conjunction: "and", conditions: [], groups: [...meaningful] };
}
