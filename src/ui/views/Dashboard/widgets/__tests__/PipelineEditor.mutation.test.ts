import { updateStep, toggleDisableStep, addFilterCondition } from "../pipelineSteps";
import type {
  TransformStep,
  FilterStep,
  GroupByStep,
} from "src/lib/dashboard-engine/transformTypes";
import type { FilterCondition } from "src/settings/base/settings";

// #105 — PipelineEditor crashed in `updateStep` doing `steps[index] = step` on
// an immer-frozen array (TypeError: Cannot assign to read only property). These
// reducers must stay pure: never write into the (possibly frozen) input.

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function makeFrozenSteps(): TransformStep[] {
  const groupStep: GroupByStep = { type: "group-by", fields: ["status"] };
  const filterStep: FilterStep = {
    type: "filter",
    conditions: { conjunction: "and", conditions: [] },
  };
  return deepFreeze([groupStep, filterStep] as TransformStep[]);
}

describe("pipelineSteps reducers on frozen input (#105)", () => {
  // Proves the fixture is genuinely frozen so the reducer tests are meaningful.
  // Forced strict context: an index-write to a frozen array throws only in
  // strict mode (Svelte components compile to strict ES modules, like the real
  // crash site); under the Jest transform the test module itself is sloppy.
  function strictIndexWrite(arr: TransformStep[]): void {
    "use strict";
    arr[0] = { type: "group-by", fields: ["x"] };
  }

  it("sanity: the fixture really is frozen (direct index-write throws)", () => {
    const frozen = makeFrozenSteps();
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() => strictIndexWrite(frozen)).toThrow(TypeError);
  });

  it("disable-toggle does not throw, returns a new array, replaces only the toggled step", () => {
    const frozen = makeFrozenSteps();
    let next!: TransformStep[];
    expect(() => {
      next = toggleDisableStep(frozen, 0);
    }).not.toThrow();
    expect(next).not.toBe(frozen);
    expect(next[0]).not.toBe(frozen[0]);
    expect(next[0]!.disabled).toBe(true);
    expect(next[1]).toBe(frozen[1]);
  });

  it("group-by change replaces the step immutably", () => {
    const frozen = makeFrozenSteps();
    const replacement: GroupByStep = { type: "group-by", fields: ["client"] };
    let next!: TransformStep[];
    expect(() => {
      next = updateStep(frozen, 0, replacement);
    }).not.toThrow();
    expect(next).not.toBe(frozen);
    expect(next[0]).toBe(replacement);
    expect(next[1]).toBe(frozen[1]);
  });

  it("add-condition appends to the filter step without mutating frozen subarrays", () => {
    const frozen = makeFrozenSteps();
    const cond: FilterCondition = {
      field: "status",
      operator: "is-empty",
      value: "",
      enabled: true,
    };
    let next!: TransformStep[];
    expect(() => {
      next = addFilterCondition(frozen, 1, cond);
    }).not.toThrow();
    expect(next).not.toBe(frozen);
    expect(next[1]).not.toBe(frozen[1]);
    expect(next[0]).toBe(frozen[0]);
    const filter = next[1] as FilterStep;
    expect(filter.conditions.conditions).toHaveLength(1);
    expect(filter.conditions.conditions[0]).toBe(cond);
    // original frozen filter step is untouched
    expect((frozen[1] as FilterStep).conditions.conditions).toHaveLength(0);
  });
});
