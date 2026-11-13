import type { TransformContext, TransformStopReason } from "./transformTypes";
const MAX_TRANSFORM_WORK = 2_000_000;
const TRANSFORM_DEADLINE_MS = 2000;
/** Cooperative checks between bounded units; cannot interrupt a native call. */
export function createTransformBudget(context: TransformContext | undefined, started: number) {
  const requested = context?.workLimit ?? MAX_TRANSFORM_WORK;
  let remaining = Math.min(MAX_TRANSFORM_WORK, requested);
  const shared = context?.budget;
  let failure: (Error & { reason: TransformStopReason }) | undefined;
  function check(): void {
    try { shared?.check(); } finally { failure = shared?.failure ?? failure; }
    if (!failure) {
      const reason: TransformStopReason | null = context?.signal?.aborted ? "cancelled" :
        !Number.isFinite(remaining) || remaining < 0 ? "work-limit" :
        performance.now() - started > TRANSFORM_DEADLINE_MS ? "deadline" : null;
      if (reason) failure = Object.assign<Error, { reason: TransformStopReason }>(new Error(`Pipeline aborted: ${reason === "work-limit" ? "work limit exceeded" : reason === "deadline" ? "deadline exceeded" : reason}`), { reason });
    }
    if (failure) throw failure;
  }
  const charge = (work = 1): void => {
    remaining -= Number.isFinite(work) && work >= 0 ? work : Infinity;
    try { shared?.charge(work); } finally { check(); }
  };
  return { charge, check, get failure() { return failure; }, get stopped() { return failure?.reason; } };
}
export type TransformBudget = ReturnType<typeof createTransformBudget>;
