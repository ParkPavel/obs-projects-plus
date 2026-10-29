import { parseFormula, tokenize, type FormulaNode } from "./syntax";
import { getFormulaDefinition, isFormulaSemantics, type FormulaSemantics } from "./catalog";
import { humanFormulaError, resolveFieldName } from "./formulaErrors";
import { MAX_FORMULA_DEPTH, MAX_FORMULA_INPUT_LENGTH, assertFormulaLimits } from "./limits";

function bindingName(node: FormulaNode | undefined, fallback?: string): string | undefined {
  return node?.type === "field" ? node.name : node?.type === "literal" ? String(node.value) : fallback;
}

/** One validator walk; compatibility adapters retain their old diagnostics. */
export function validateFormulaRaw(expression: string, fields: string[], semantics: FormulaSemantics, compatibility = false): string[] {
  const errors: string[] = [];
  const shared = semantics === "unified-v1";
  try {
    if (!isFormulaSemantics(semantics)) throw new Error("Unknown formula semantics");
    if (shared && expression.length > MAX_FORMULA_INPUT_LENGTH) throw new Error("Formula input limit exceeded");
    for (const token of tokenize(expression, shared ? "strict" : "legacy")) {
      // The old filter validator checked syntax/fields only, even for a
      // recognised but unsupported computed function. Preserve that API.
      if (!(compatibility && semantics === "legacy-filter") && token.type === "FUNCTION" && !getFormulaDefinition(token.value, semantics)) {
        errors.push(`Unknown function: ${token.value}`);
      }
    }
    const ast = parseFormula(expression, shared ? MAX_FORMULA_DEPTH : undefined, shared ? "strict" : "legacy");
    if (shared) assertFormulaLimits(ast);
    function check(node: FormulaNode, scope: ReadonlySet<string>): void {
      if (node.type === "field" || (shared && node.type === "column_ref")) {
        if (node.type === "field" && scope.has(node.name)) return;
        const found = semantics === "legacy-filter" ? fields.includes(node.name) : resolveFieldName(node.name, fields) !== undefined;
        if (!found) errors.push(`Unknown field: ${node.name}`);
      } else if (node.type === "operator") {
        if (!shared) { check(node.left, scope); check(node.right, scope); }
        else {
          const pending: FormulaNode[] = [node];
          while (pending.length) {
            const next = pending.pop()!;
            if (next.type === "operator") pending.push(next.right, next.left);
            else check(next, scope);
          }
        }
      } else if (node.type === "array") {
        node.items.forEach(item => check(item, scope));
      } else if (node.type === "function") {
        if (shared && (node.name === "LET" || node.name === "LETS")) {
          const local = new Set(scope);
          const pairs = node.name === "LET" ? 1 : Math.floor((node.args.length - 1) / 2);
          for (let index = 0; index < pairs; index++) {
            const value = node.args[index * 2 + 1];
            if (value) check(value, local);
            const name = bindingName(node.args[index * 2]);
            if (name) local.add(name);
          }
          const result = node.args[node.name === "LET" ? 2 : node.args.length - 1];
          if (result) check(result, local);
        } else if (shared && (node.name === "MAP" || node.name === "FILTER" || node.name === "REDUCE")) {
          const input = node.args[0]; if (input) check(input, scope);
          const local = new Set(scope);
          local.add(bindingName(node.args[1], "item")!);
          if (node.name === "REDUCE") {
            local.add(bindingName(node.args[2], "acc")!);
            if (node.args[3]) check(node.args[3], scope);
          }
          const result = node.args[node.name === "REDUCE" ? 4 : 2];
          if (result) check(result, local);
        } else node.args.forEach(arg => check(arg, scope));
      }
    }
    check(ast, new Set());
  } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  return errors;
}

/** Explicit profile validation for new callers, driven by the executable catalog. */
export function validateExpression(expression: string, fields: string[], semantics: FormulaSemantics): string[] {
  return validateFormulaRaw(expression, fields, semantics).map(message => humanFormulaError(message, fields));
}
