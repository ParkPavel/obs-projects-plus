import type { FormulaFn } from "./computedFunctions";
import { workdayDistance } from "./calendarMath";

/** Explicit new-profile corrections; compatibility implementations stay separate. */
export const UNIFIED_FUNCTIONS: Readonly<Record<string, FormulaFn>> = {
  WORKDAYS: (args, evaluate, _range, chargeWork) => workdayDistance(evaluate(args[0]!), evaluate(args[1]!), chargeWork),
};
