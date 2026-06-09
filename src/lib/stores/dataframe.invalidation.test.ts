// Regression test for #016 — reactive loop fix (Option A).
//
// Scenario: a record outside the sampling window of `hashDataFrame()` is
// modified via `dataFrame.merge()`. Before the fix, the transform cache was
// invalidated by a 300 ms-debounced listener in App.svelte that ran AFTER
// the Svelte store had already propagated the new frame to consumers →
// `executeTransformCached` saw an unchanged sampling hash and returned a
// stale cached `TransformResult`.
//
// After the fix, every dataFrame mutator calls `notifyDataFrameInvalidation()`
// synchronously BEFORE `update()`. Any consumer that registered an invalidation
// callback (in production: `invalidateAll()` from transformCache) therefore
// sees the cache cleared before the first subscriber re-evaluates.
//
// This test does not require Obsidian/Svelte runtime — it verifies the
// invariant directly on the store mutators.

import { get } from "svelte/store";
import {
  dataFrame,
  registerDataFrameInvalidation,
  __clearDataFrameInvalidationCallbacks,
} from "src/lib/stores/dataframe";
import {
  DataFieldType,
  type DataField,
  type DataRecord,
} from "src/lib/dataframe/dataframe";
import {
  executeTransformCached,
  invalidateAll,
  invalidateTransformCache,
  getTransformCacheSize,
} from "src/lib/dashboard-engine/transformCache";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";

function makeRecord(id: string, progress: number): DataRecord {
  return {
    id,
    values: { name: id, progress },
  };
}

const fields: DataField[] = [
  { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
  { name: "progress", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
];

const emptyPipeline: TransformPipeline = { steps: [] };

function resetState(): void {
  invalidateTransformCache();
  __clearDataFrameInvalidationCallbacks();
  dataFrame.set({ fields: [], records: [] });
}

describe("dataFrame invalidation hook (#016 regression)", () => {
  beforeEach(() => {
    resetState();
  });

  afterAll(() => {
    resetState();
  });

  test("registerDataFrameInvalidation fires callback synchronously before update()", () => {
    const order: string[] = [];

    const unsubscribe = registerDataFrameInvalidation(() => {
      order.push("invalidate");
    });

    const sub = dataFrame.subscribe(() => {
      order.push("subscribe");
    });
    // The initial subscribe call fires once with the current value — drop it.
    order.length = 0;

    dataFrame.merge({
      fields,
      records: [makeRecord("a", 10), makeRecord("b", 20)],
    });

    expect(order[0]).toBe("invalidate");
    expect(order).toContain("subscribe");
    expect(order.indexOf("invalidate")).toBeLessThan(order.indexOf("subscribe"));

    sub();
    unsubscribe();
  });

  test("unsubscribe removes the callback", () => {
    const cb = jest.fn();
    const unsubscribe = registerDataFrameInvalidation(cb);

    dataFrame.addRecord(makeRecord("a", 1));
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();
    dataFrame.addRecord(makeRecord("b", 2));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("all mutators trigger invalidation", () => {
    const cb = jest.fn();
    const off = registerDataFrameInvalidation(cb);

    // seed
    dataFrame.set({ fields, records: [makeRecord("seed", 0)] });
    cb.mockReset();

    dataFrame.addRecord(makeRecord("r1", 1));
    dataFrame.updateRecord(makeRecord("r1", 2));
    dataFrame.updateRecords([makeRecord("r1", 3)]);
    dataFrame.deleteRecord("r1");
    dataFrame.addField({ name: "extra", type: DataFieldType.String, repeated: false, identifier: false, derived: false });
    dataFrame.updateField({ name: "extra2", type: DataFieldType.String, repeated: false, identifier: false, derived: false }, "extra");
    dataFrame.deleteField("extra2");
    dataFrame.merge({ fields, records: [makeRecord("m", 9)] });

    expect(cb).toHaveBeenCalledTimes(8);

    off();
  });

  test("a buggy callback does not break subsequent mutations", () => {
    const ok = jest.fn();
    const boom = jest.fn(() => {
      throw new Error("listener exploded");
    });

    const offBoom = registerDataFrameInvalidation(boom);
    const offOk = registerDataFrameInvalidation(ok);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => dataFrame.addRecord(makeRecord("x", 0))).not.toThrow();
    expect(boom).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();

    offBoom();
    offOk();
  });

  test("middle-record edit invalidates transform cache before next pipeline call", () => {
    // Wire production invalidation: transformCache.invalidateAll() registered
    // on dataFrame, exactly as App.svelte does.
    const off = registerDataFrameInvalidation(invalidateAll);

    // Five-record frame: hashDataFrame samples idx 0, 2 (middle), 4 (last).
    // Record at idx 1 is OUTSIDE the sample window — this is the scenario
    // that produced the stale-hit bug before #016 was fixed.
    const initialRecords: DataRecord[] = [
      makeRecord("a", 10),
      makeRecord("b", 20), // outside sample window
      makeRecord("c", 30),
      makeRecord("d", 40),
      makeRecord("e", 50),
    ];
    dataFrame.set({ fields, records: initialRecords });

    const frame1 = get(dataFrame);
    const result1 = executeTransformCached(frame1, emptyPipeline);
    expect(getTransformCacheSize()).toBe(1);

    // Cache hit on the same frame — same identity reference.
    const result1b = executeTransformCached(frame1, emptyPipeline);
    expect(result1b).toBe(result1);

    // Simulate a mid-list edit via the production path: events.ts calls
    // dataFrame.merge({...}) with the new record.
    dataFrame.merge({ fields, records: [makeRecord("b", 999)] });
    // Cache must be empty IMMEDIATELY (synchronously) after the mutator
    // returns — no timer, no microtask delay.
    expect(getTransformCacheSize()).toBe(0);

    const frame2 = get(dataFrame);
    const result2 = executeTransformCached(frame2, emptyPipeline);
    // Sanity: record "b" now has progress 999 in the resulting frame.
    const recB = result2.data.records.find((r: DataRecord) => r.id === "b");
    expect(recB?.values["progress"]).toBe(999);

    off();
  });
});
