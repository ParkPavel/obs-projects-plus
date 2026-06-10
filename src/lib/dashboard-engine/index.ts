// src/lib/dashboard-engine/index.ts
// Public API barrel — re-exports for UI consumers.

export { computeAggregations, computeAggregateValue } from "./aggregation";
export { applyAutoFields } from "./applyAutoFields";
export type { FileStat, GetFileStat } from "./applyAutoFields";
export { applyFormulaFields } from "./applyFormulaFields";
export {
  buildChartPipeline,
  computeChartData,
  chartHeightPx,
  computeScatterData,
} from "./chartDataPipeline";
export {
  computeCellStyle,
  computeRowStyles,
  cellStyleToCSS,
  sanitizeColor,
} from "./conditionalFormat";
export {
  evaluateFormulaValue,
  evaluateFormulaWithError,
  validateFormulaExpression,
  getFormulaFunctions,
  isStyledValue,
} from "./formulaEngine";
export type { StyledValue, FormulaResult } from "./formulaEngine";
export {
  getFormulaMetadata,
  getAllFormulaMetadata,
  findEnclosingCall,
} from "./formulaMetadata";
export type { FormulaMetadata, FormulaCategory } from "./formulaMetadata";
export { joinKey } from "./joinKey";
export {
  extractWikiLinks,
  buildRecordIndex,
  resolveRelationsForValue,
  resolveRelations,
  getRelationTargets,
  getRelationTargetsWithIndex,
  computeBacklinks,
  enrichWithBacklinks,
} from "./relationResolver";
export type {
  ResolvedRelation,
  RelationResult,
  RecordIndex,
  BacklinkResult,
} from "./relationResolver";
export { computeRollup, computeRollupColumn } from "./rollup";
export {
  executeTransformCached,
  invalidateAll,
  invalidateTransformCache,
  getTransformCacheSize,
} from "./transformCache";
export { executeTransform, evaluateExpression } from "./transformExecutor";
export type {
  TransformPipeline,
  TransformStep,
  TransformResult,
  TransformMeta,
  TransformContext,
  AggregationFunction,
  JoinStep,
  GroupByStep,
  AggregateStep,
  PivotStep,
  FilterStep,
  ComputeStep,
  UnnestStep,
  UnpivotStep,
} from "./transformTypes";
export {
  computeVirtualScroll,
  shouldVirtualize,
  getRowHeight,
} from "./virtualScroll";
export { ariaWidget } from "./accessibility";
