// src/ui/views/Database/engine/formulaSerializer.ts
// Converts FormulaNode AST back to expression string.

import type { FormulaNode } from "src/lib/helpers/formulaParser";

/**
 * Serialize a FormulaNode back into a human-readable expression string.
 */
export function serializeNode(node: FormulaNode): string {
  switch (node.type) {
    case "function":
      return `${node.name}(${node.args.map(serializeNode).join(", ")})`;

    case "operator": {
      const left = serializeNode(node.left);
      const right = serializeNode(node.right);
      // Wrap nested operators in parens for clarity
      const wrapL = node.left.type === "operator" ? `(${left})` : left;
      const wrapR = node.right.type === "operator" ? `(${right})` : right;
      return `${wrapL} ${node.operator} ${wrapR}`;
    }

    case "field":
      return node.name;

    case "literal":
      if (node.value === null) return "null";
      if (typeof node.value === "string") return `"${node.value}"`;
      return String(node.value);

    case "array":
      return `[${node.items.map(serializeNode).join(", ")}]`;

    default:
      return "";
  }
}

/** Categorize a function name for visual color coding. */
export type FunctionCategory =
  | "logic"
  | "math"
  | "string"
  | "date"
  | "comparison"
  | "conversion";

const CATEGORY_MAP: Record<string, FunctionCategory> = {
  IF: "logic", IFS: "logic", SWITCH: "logic",
  AND: "logic", OR: "logic", NOT: "logic", EMPTY: "logic",

  ROUND: "math", CEIL: "math", FLOOR: "math", ABS: "math",
  SQRT: "math", POWER: "math", LOG: "math", SIGN: "math",

  TRIM: "string", LOWER: "string", UPPER: "string", LENGTH: "string",
  SUBSTRING: "string", REPLACE: "string", SPLIT: "string", FORMAT: "string",

  TODAY: "date", NOW: "date", TOMORROW: "date", YESTERDAY: "date",
  DATE_ADD: "date", DATE_SUB: "date", DATE_BETWEEN: "date",
  FORMAT_DATE: "date", PARSE_DATE: "date",
  YEAR: "date", MONTH: "date", DAY: "date", HOUR: "date",
  MINUTE: "date", WEEK: "date",

  IS_EMPTY: "comparison", IS_NOT_EMPTY: "comparison",
  CONTAINS: "comparison", NOT_CONTAINS: "comparison",
  STARTS_WITH: "comparison", ENDS_WITH: "comparison",
  IS_TODAY: "comparison", IS_THIS_WEEK: "comparison", IS_THIS_MONTH: "comparison",
  IS_BEFORE: "comparison", IS_AFTER: "comparison",
  IS_ON_AND_BEFORE: "comparison", IS_ON_AND_AFTER: "comparison",
  IS_OVERDUE: "comparison", IS_UPCOMING: "comparison",
  HAS_ANY_OF: "comparison", HAS_ALL_OF: "comparison", HAS_NONE_OF: "comparison",

  TO_NUMBER: "conversion", TO_TEXT: "conversion", TO_DATE: "conversion",
};

export function getFunctionCategory(name: string): FunctionCategory {
  return CATEGORY_MAP[name] ?? "logic";
}
