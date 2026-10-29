import type { FormulaNode } from "./syntax";

// New-profile limits are explicit; compatibility parsing remains unchanged.
export const MAX_FORMULA_DEPTH = 64;
export const MAX_FORMULA_INPUT_LENGTH = 50_000;
export const MAX_FORMULA_AST_NODES = 100_000;
export const MAX_FORMULA_LIST_ITEMS = 10_000;
export const MAX_FORMULA_EVALUATION_STEPS = 100_000;

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
