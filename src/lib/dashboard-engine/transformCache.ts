// src/ui/views/Dashboard/engine/transformCache.ts
// Transform result caching with hash-based invalidation.
//
// ⚠️  SAMPLING HASH — known limitation (R5-016):
// `hashDataFrame()` samples only the first, middle, and last record.
// This means changes to records outside the sample window produce an
// identical hash and would return a stale cache hit.
//
// Mitigation (#016 Phase 1, Option A — 2026-05-19):
// `invalidateAll()` is registered as a synchronous callback on the dataFrame
// store via `registerDataFrameInvalidation()` (see App.svelte onMount). The
// callback fires inside every dataFrame mutator (addRecord / updateRecord(s) /
// deleteRecord / add|update|deleteField / merge) BEFORE its `update()` call,
// so by the time any Svelte subscriber re-evaluates `executeTransformCached`
// the cache is already empty.
//
// This replaces the previous design where invalidation was fired from
// App.svelte vault listeners with a 300 ms debounce — which raced the
// un-debounced `dataFrame.merge()` in events.ts and produced stale hits for
// records outside the sampling window.
//
// Invariant: any new dataFrame mutator MUST call `notifyDataFrameInvalidation()`
// at its top, otherwise this cache can return stale data on the next pipeline call.

import type { DataFrame, DataField, DataRecord } from "src/lib/dataframe/dataframe";
import type { TransformPipeline, TransformResult, TransformContext } from "./transformTypes";
import { executeTransform } from "./transformExecutor";

interface CacheEntry {
  readonly cacheKey: string;
  readonly result: TransformResult;
  readonly timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 20;

const cache = new Map<string, CacheEntry>();

/**
 * Execute a transform pipeline with caching.
 * Returns cached result if source data and pipeline haven't changed.
 *
 * Note: when `context.rightFrames` is supplied (e.g. JoinStep), the cache key
 * incorporates a hash of the right frames so that changes to correlated
 * sources invalidate cached joins.
 */
export function executeTransformCached(
  source: DataFrame,
  pipeline: TransformPipeline,
  context?: TransformContext
): TransformResult {
  const key = computeCacheKey(source, pipeline, context);
  const now = Date.now();

  const existing = cache.get(key);
  if (existing && (now - existing.timestamp) < CACHE_TTL_MS) {
    return existing.result;
  }

  const result = executeTransform(source, pipeline, context);

  // Evict if at capacity
  if (cache.size >= MAX_CACHE_ENTRIES) {
    evictOldest();
  }

  cache.set(key, { cacheKey: key, result, timestamp: now });

  return result;
}

/**
 * Invalidate all cached results.
 * Call when source data changes (note edited, created, deleted).
 */
export function invalidateTransformCache(): void {
  cache.clear();
}

/**
 * Explicit alias for vault-event invalidation sites.
 * Semantically identical to `invalidateTransformCache()` — clears every
 * cached transform result so the next pipeline call always re-executes.
 */
export function invalidateAll(): void {
  cache.clear();
}

/**
 * Invalidate cache entries matching a specific pipeline config.
 */
export function invalidatePipelineCache(pipeline: TransformPipeline): void {
  const configHash = stableStringify(pipeline.steps);
  for (const [key, entry] of cache) {
    if (entry.cacheKey.includes(configHash)) {
      cache.delete(key);
    }
  }
}

/**
 * Get the current cache size (for diagnostics).
 */
export function getTransformCacheSize(): number {
  return cache.size;
}

// ── Internal ─────────────────────────────────────────────────

function computeCacheKey(
  df: DataFrame,
  pipeline: TransformPipeline,
  context?: TransformContext
): string {
  const sourceHash = hashDataFrame(df);
  const configHash = stableStringify(pipeline.steps);
  let rightHash = "";
  if (context?.rightFrames && context.rightFrames.size > 0) {
    const entries: string[] = [];
    for (const [id, frame] of context.rightFrames) {
      entries.push(`${id}:${hashDataFrame(frame)}`);
    }
    entries.sort();
    rightHash = `__R__${simpleHash(entries.join("|"))}`;
  }
  return `${sourceHash}__${configHash}${rightHash}`;
}

function hashDataFrame(df: DataFrame): string {
  // Sampling hash: field names + record count + first/middle/last record values.
  // Intentionally cheap — O(1) regardless of dataset size.
  //
  // ⚠️  NOT a full content hash. Records outside the sample window are invisible
  // to the hash function. Example: dataset of 100 records; record #42 changes →
  // hash unchanged → stale cache hit. This is acceptable because
  // `invalidateAll()` is registered on the dataFrame store (see file header)
  // and fires atomically with every mutation, BEFORE Svelte subscribers fire.
  // The hash is a secondary guard for the 5-min TTL window, not the primary
  // freshness mechanism.
  //
  // If you remove the store-level invalidation, you MUST replace this with a
  // full content hash (e.g. hash all record IDs + all values) — accept the O(n) cost.
  const fieldSig = df.fields.map((f) => `${f.name}:${f.type}`).join(",");
  const count = df.records.length;

  // Sample first, middle, last records for change detection
  let sampleSig = "";
  if (count > 0) {
    const indices = [0];
    if (count > 2) indices.push(Math.floor(count / 2));
    if (count > 1) indices.push(count - 1);

    for (const idx of indices) {
      const rec = df.records[idx];
      if (rec) {
        sampleSig += `|${rec.id}:${sampleValues(rec, df.fields)}`;
      }
    }
  }

  return simpleHash(`${fieldSig}|${count}${sampleSig}`);
}

function sampleValues(record: DataRecord, fields: readonly DataField[]): string {
  // Sample up to 5 field values for hash
  const maxFields = Math.min(fields.length, 5);
  const parts: string[] = [];
  for (let i = 0; i < maxFields; i++) {
    const val = record.values[fields[i]!.name];
    parts.push(val == null ? "null" : String(val).slice(0, 32));
  }
  return parts.join(",");
}

function stableStringify(obj: unknown): string {
  return JSON.stringify(obj);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

function evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of cache) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
  }
}
