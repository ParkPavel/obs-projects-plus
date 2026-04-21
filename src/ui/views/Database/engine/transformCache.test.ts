// src/ui/views/Database/engine/transformCache.test.ts

import {
  executeTransformCached,
  invalidateTransformCache,
  invalidatePipelineCache,
  getTransformCacheSize,
} from "./transformCache";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { TransformPipeline } from "./transformTypes";

// ── Helpers ──────────────────────────────────────────────────

function makeFrame(n: number = 3): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
      { name: "value", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: Array.from({ length: n }, (_, i) => ({
      id: `r${i}`,
      values: { name: `item-${i}`, value: i * 10 },
    })),
  };
}

const simplePipeline: TransformPipeline = {
  steps: [
    {
      type: "compute",
      columns: [
        {
          name: "doubled",
          expression: "value * 2",
        },
      ],
    },
  ],
};

// ── Cache Tests ──────────────────────────────────────────────

describe("transformCache", () => {
  beforeEach(() => {
    invalidateTransformCache();
  });

  test("returns valid TransformResult", () => {
    const result = executeTransformCached(makeFrame(), simplePipeline);

    expect(result.data).toBeDefined();
    expect(result.data.fields).toBeDefined();
    expect(result.data.records).toBeDefined();
    expect(result.meta).toBeDefined();
  });

  test("cache size increases after first call", () => {
    expect(getTransformCacheSize()).toBe(0);

    executeTransformCached(makeFrame(), simplePipeline);
    expect(getTransformCacheSize()).toBe(1);
  });

  test("same input returns cached result", () => {
    const frame = makeFrame();
    const r1 = executeTransformCached(frame, simplePipeline);
    const r2 = executeTransformCached(frame, simplePipeline);

    // Same object reference = cache hit
    expect(r1).toBe(r2);
    expect(getTransformCacheSize()).toBe(1);
  });

  test("different input creates new cache entry", () => {
    executeTransformCached(makeFrame(3), simplePipeline);
    executeTransformCached(makeFrame(5), simplePipeline);

    expect(getTransformCacheSize()).toBe(2);
  });

  test("different pipeline creates new cache entry", () => {
    const frame = makeFrame();
    const otherPipeline: TransformPipeline = {
      steps: [
        {
          type: "compute",
          columns: [
            {
              name: "incremented",
              expression: "value + 1",
            },
          ],
        },
      ],
    };

    executeTransformCached(frame, simplePipeline);
    executeTransformCached(frame, otherPipeline);

    expect(getTransformCacheSize()).toBe(2);
  });

  test("invalidateTransformCache clears all entries", () => {
    executeTransformCached(makeFrame(3), simplePipeline);
    executeTransformCached(makeFrame(5), simplePipeline);

    expect(getTransformCacheSize()).toBe(2);
    invalidateTransformCache();
    expect(getTransformCacheSize()).toBe(0);
  });

  test("invalidatePipelineCache clears specific pipeline entries", () => {
    const otherPipeline: TransformPipeline = {
      steps: [
        {
          type: "compute",
          columns: [
            {
              name: "incremented",
              expression: "value + 1",
            },
          ],
        },
      ],
    };

    executeTransformCached(makeFrame(), simplePipeline);
    executeTransformCached(makeFrame(), otherPipeline);

    expect(getTransformCacheSize()).toBe(2);
    invalidatePipelineCache(simplePipeline);
    // At least one entry removed
    expect(getTransformCacheSize()).toBeLessThan(2);
  });

  test("output data is correct", () => {
    const result = executeTransformCached(makeFrame(3), simplePipeline);

    // COMPUTE step should create 'doubled' field
    const hasDoubled = result.data.fields.some((f) => f.name === "doubled");
    expect(hasDoubled).toBe(true);

    // Values should be doubled
    for (const record of result.data.records) {
      const original = record.values["value"] as number;
      const doubled = record.values["doubled"] as number;
      expect(doubled).toBe(original * 2);
    }
  });
});
