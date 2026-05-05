/**
 * filterFunctions — back-compat facade.
 *
 * REFACTOR-104: canonical filter evaluation logic now lives in
 * `src/lib/engine/filterEvaluator.ts`. This file re-exports the
 * engine surface so that existing imports throughout the UI layer
 * continue to work. New code should import directly from
 * `src/lib/engine/filterEvaluator`.
 */

export {
  matchesCondition,
  matchesFilterConditions,
  evaluateFilter,
  applyFilter,
  baseFns,
  stringFns,
  numberFns,
  booleanFns,
  dateFns,
  listFns,
  listFns_multitext,
  listFns_text,
} from "src/lib/engine/filterEvaluator";