/**
 * REFACTOR-201 — R2.1b rollup invariant + fn↔mode migration.
 *
 * Pins:
 *  - `defaultModeForFunction` round-trip for every kernel.
 *  - `isRollupInvariantValid` / `assertRollupInvariant` semantics
 *    (consistent / inconsistent / partial / presentational mode).
 *  - settings v3 resolver backfills `rollup.mode` from `rollup.function`
 *    on legacy saves; idempotent on already-migrated saves.
 *
 * Anchored in: docs/PHASE_3_TICKETS.md REFACTOR-201; ARCHITECTURE_V4 §1
 * (R2.1b invariant).
 */

import {
  defaultModeForFunction,
  isRollupInvariantValid,
  assertRollupInvariant,
  ROLLUP_MODES,
  getRollupMode,
} from "src/lib/database/rollupMode";
import type { RollupFunction } from "src/lib/engine/aggregate";
import { resolve as v3Resolve } from "src/settings/v3/settings";

describe("REFACTOR-201 — rollup mode↔fn migration", () => {
  // ── kernel-level helpers ─────────────────────────────────
  describe("defaultModeForFunction", () => {
    test("every fn-bearing mode round-trips through defaultModeForFunction", () => {
      for (const mode of ROLLUP_MODES) {
        if (!mode.fn) continue;
        const back = defaultModeForFunction(mode.fn);
        expect(back).not.toBeNull();
        // The resolved mode must reference the same underlying fn.
        const desc = getRollupMode(back!);
        expect(desc?.fn).toBe(mode.fn);
      }
    });

    test("returns deterministic canonical mode for shared kernels", () => {
      // `min` is reused by both `min` and `earliest`; canonical order
      // pins `min` as the default (declared first in ROLLUP_MODES).
      expect(defaultModeForFunction("min")).toBe("min");
      expect(defaultModeForFunction("max")).toBe("max");
    });

    test("known kernels resolve", () => {
      expect(defaultModeForFunction("sum")).toBe("sum");
      expect(defaultModeForFunction("avg")).toBe("average");
      expect(defaultModeForFunction("median")).toBe("median");
      expect(defaultModeForFunction("range")).toBe("range");
      expect(defaultModeForFunction("count_unique")).toBe("count_unique");
    });
  });

  // ── invariant ────────────────────────────────────────────
  describe("isRollupInvariantValid", () => {
    test("empty config is valid", () => {
      expect(isRollupInvariantValid({})).toBe(true);
    });
    test("only function set is valid", () => {
      expect(isRollupInvariantValid({ function: "sum" })).toBe(true);
    });
    test("only mode set is valid", () => {
      expect(isRollupInvariantValid({ mode: "sum" })).toBe(true);
    });
    test("matching mode and fn is valid", () => {
      expect(
        isRollupInvariantValid({ function: "sum", mode: "sum" }),
      ).toBe(true);
    });
    test("inconsistent mode and fn is invalid", () => {
      expect(
        isRollupInvariantValid({ function: "sum", mode: "average" }),
      ).toBe(false);
    });
    test("presentational mode (fn=null) is always valid", () => {
      expect(
        isRollupInvariantValid({
          function: "sum" as RollupFunction,
          mode: "show_original",
        }),
      ).toBe(true);
    });
    test("unknown mode id is invalid", () => {
      expect(
        isRollupInvariantValid({
          function: "sum",
          mode: "bogus" as never,
        }),
      ).toBe(false);
    });
    test("earliest mode pairs only with min kernel", () => {
      expect(
        isRollupInvariantValid({ function: "min", mode: "earliest" }),
      ).toBe(true);
      expect(
        isRollupInvariantValid({ function: "max", mode: "earliest" }),
      ).toBe(false);
    });
  });

  describe("assertRollupInvariant", () => {
    test("does not throw on valid config", () => {
      expect(() =>
        assertRollupInvariant({ function: "sum", mode: "sum" }),
      ).not.toThrow();
    });
    test("throws on inconsistent config", () => {
      expect(() =>
        assertRollupInvariant({ function: "sum", mode: "average" }),
      ).toThrow(/R2\.1b violation/);
    });
  });

  // ── v3 resolver backfill ─────────────────────────────────
  describe("v3 resolver — rollup.mode backfill", () => {
    const baseProject = {
      version: 3 as const,
      projects: [
        {
          name: "P",
          id: "p",
          fieldConfig: {
            total: {
              rollup: {
                relationField: "tasks",
                targetField: "amount",
                function: "sum" as RollupFunction,
                // mode missing — legacy save
              },
            },
            average: {
              rollup: {
                relationField: "tasks",
                targetField: "amount",
                function: "avg" as RollupFunction,
                mode: "average" as const, // already migrated
              },
            },
            plain: { hideInTable: true } as const,
          },
        },
      ],
    };

    test("populates missing mode from function", () => {
      const out = v3Resolve(baseProject as never);
      const fc = out.projects[0]?.fieldConfig["total"];
      expect(fc?.rollup?.mode).toBe("sum");
      expect(fc?.rollup?.function).toBe("sum");
    });

    test("does not overwrite an existing mode", () => {
      const out = v3Resolve(baseProject as never);
      const fc = out.projects[0]?.fieldConfig["average"];
      expect(fc?.rollup?.mode).toBe("average");
    });

    test("leaves non-rollup fieldConfig unchanged", () => {
      const out = v3Resolve(baseProject as never);
      const fc = out.projects[0]?.fieldConfig["plain"];
      expect(fc?.rollup).toBeUndefined();
    });

    test("idempotent — second resolve yields same shape", () => {
      const once = v3Resolve(baseProject as never);
      const twice = v3Resolve({
        version: 3,
        projects: once.projects,
      } as never);
      expect(twice.projects[0]?.fieldConfig["total"]?.rollup?.mode).toBe("sum");
    });

    test("missing fieldConfig is tolerated", () => {
      const out = v3Resolve({
        version: 3,
        projects: [{ name: "Q", id: "q" }],
      } as never);
      expect(out.projects[0]?.fieldConfig).toEqual({});
    });
  });
});
