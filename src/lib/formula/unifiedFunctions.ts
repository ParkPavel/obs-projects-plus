import type { FormulaFn } from "./computedFunctions";
import { workdayDistance } from "./calendarMath";
import { createStandaloneFinancialBudget } from "./limits";

/** Explicit new-profile corrections; compatibility implementations stay separate. */
export const UNIFIED_FUNCTIONS: Readonly<Record<string, FormulaFn>> = {
  WORKDAYS: (args, evaluate, _range, chargeWork) => workdayDistance(evaluate(args[0]!), evaluate(args[1]!), chargeWork),
  COUNT: (args, evaluate, _range, chargeWork) => {
    const charge = chargeWork ?? createStandaloneFinancialBudget();
    charge(args.length);
    let count = 0;
    for (const arg of args) {
      const value = evaluate(arg);
      if (Array.isArray(value)) {
        charge(value.length);
        for (const item of value) if (item != null) count++;
      } else if (value != null) count++;
    }
    return count;
  },
};
