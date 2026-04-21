// src/ui/views/Database/engine/transformCache.ts
// Transform result caching with hash-based invalidation.

import type { DataFrame, DataField, DataRecord } from "src/lib/dataframe/dataframe";
import type { TransformPipeline, TransformResult } from "./transformTypes";
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
 */
export function executeTransformCached(
  source: DataFrame,
  pipeline: TransformPipeline
): TransformResult {
  const key = computeCacheKey(source, pipeline);
  const now = Date.now();

  const existing = cache.get(key);
  if (existing && (now - existing.timestamp) < CACHE_TTL_MS) {
    return existing.result;
  }

  const result = executeTransform(source, pipeline);

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

function computeCacheKey(df: DataFrame, pipeline: TransformPipeline): string {
  const sourceHash = hashDataFrame(df);
  const configHash = stableStringify(pipeline.steps);
  return `${sourceHash}__${configHash}`;
}

function hashDataFrame(df: DataFrame): string {
  // Hash based on: field names, record count, sample of values
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
