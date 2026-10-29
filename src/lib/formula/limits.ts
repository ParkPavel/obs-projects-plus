import type { FormulaNode } from "./syntax";

// New-profile limits are explicit; compatibility parsing remains unchanged.
export const MAX_FORMULA_DEPTH = 64;
export const MAX_FORMULA_INPUT_LENGTH = 50_000;
export const MAX_FORMULA_AST_NODES = 100_000;
export const MAX_FORMULA_LIST_ITEMS = 10_000;
export const MAX_FORMULA_EVALUATION_STEPS = 100_000;

export function consumeFinancialWork(remaining: number, steps: number): number {
  if (!Number.isFinite(steps) || steps < 0 || steps > remaining) throw new Error("Formula financial work limit exceeded");
  return remaining - steps;
}

/** Low-level handlers remain bounded even without an evaluator-owned budget. */
export function chargeStandaloneFinancialWork(steps: number): void {
  consumeFinancialWork(MAX_FORMULA_EVALUATION_STEPS, steps);
}

/** Upper bound for a validated cumulative financial loop, including fractional endpoints. */
export function cumulativePeriodWork(start: number, end: number): number {
  // NaN endpoints never enter the old loop; retain its result for that case.
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  if (Math.abs(start) > Number.MAX_SAFE_INTEGER || Math.abs(end) > Number.MAX_SAFE_INTEGER) {
    throw new Error("Formula financial range limit exceeded");
  }
  return Math.max(0, Math.ceil(end - start) + 1);
}

/** Iterative, before validation/evaluation recursively visit the expression. */
export function assertFormulaLimits(root: FormulaNode): void {
  const pending = [{ node: root, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (depth > MAX_FORMULA_DEPTH || ++count > MAX_FORMULA_AST_NODES) throw new Error("Formula evaluation limit exceeded");
    const children = node.type === "function" ? node.args : node.type === "array" ? node.items :
      node.type === "operator" ? [node.left, node.right] : [];
    if (node.type === "array" && children.length > MAX_FORMULA_LIST_ITEMS) throw new Error("Formula list limit exceeded");
    for (const child of children) pending.push({ node: child, depth: depth + 1 });
  }
}

/** Only parser-owned, already checked trees may become reusable guard proofs. */
export function freezeParsedFormula(root: FormulaNode): void {
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type === "function" || node.type === "array") {
      const children = node.type === "function" ? node.args : node.items;
      for (const child of children) pending.push(child);
      Object.freeze(children);
    } else if (node.type === "operator") {
      pending.push(node.left, node.right);
    }
    Object.freeze(node);
  }
}
