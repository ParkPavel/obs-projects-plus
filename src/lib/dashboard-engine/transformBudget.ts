import type { TransformContext } from "./transformTypes";

const MAX_TRANSFORM_WORK = 2_000_000;
const TRANSFORM_DEADLINE_MS = 2000;

/** Cooperative checks between bounded units; cannot interrupt a native call. */
export function createTransformBudget(context: TransformContext | undefined, started: number) {
  const requested = context?.workLimit ?? MAX_TRANSFORM_WORK;
  let remaining = Math.min(MAX_TRANSFORM_WORK, requested);
  let failure: Error | undefined;
  function check(): void {
    if (!failure) {
      const reason = context?.signal?.aborted ? "cancelled" :
        !Number.isFinite(remaining) || remaining < 0 ? "work limit exceeded" :
        performance.now() - started > TRANSFORM_DEADLINE_MS ? "deadline exceeded" : null;
      if (reason) failure = new Error(`Pipeline aborted: ${reason}`);
    }
    if (failure) throw failure;
  }
  const charge = (work = 1): void => {
    remaining -= Number.isFinite(work) && work >= 0 ? work : Infinity;
    check();
  };
  return { charge, check, get failure() { return failure; } };
}
export type TransformBudget = ReturnType<typeof createTransformBudget>;
