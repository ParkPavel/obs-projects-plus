import type { TransformStep } from "src/lib/dashboard-engine/transformTypes";
import type { FilterCondition } from "src/settings/base/settings";

// #105 — pure, immutable step reducers. Steps come from immer `produce()` and
// are Object.freeze'd; index-writes (`steps[i] = …`) throw in strict mode.
// Every reducer returns a fresh array and never mutates its input.

export function updateStep(
  steps: TransformStep[],
  index: number,
  step: TransformStep
): TransformStep[] {
  return steps.map((s, i) => (i === index ? step : s));
}

export function toggleDisableStep(steps: TransformStep[], index: number): TransformStep[] {
  const step = steps[index];
  if (!step) return steps;
  return updateStep(steps, index, { ...step, disabled: !step.disabled });
}

export function addFilterCondition(
  steps: TransformStep[],
  index: number,
  condition: FilterCondition
): TransformStep[] {
  const step = steps[index];
  if (!step || step.type !== "filter") return steps;
  return updateStep(steps, index, {
    ...step,
    conditions: {
      ...step.conditions,
      conditions: [...step.conditions.conditions, condition],
    },
  });
}
