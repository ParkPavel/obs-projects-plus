// One formula traversal. Existing exports keep the computed compatibility profile.
import type { DataRecord, DataValue, DataFrame, Optional } from "src/lib/dataframe/dataframe";
import { humanFormulaError, resolveFieldName } from "./formulaErrors";
import { parseFormula, type FormulaNode } from "./syntax";
import { buildSafeClass, operandNumber, isAbsentOperand, type FormulaResult } from "./computedFunctions";
import { getFormulaDefinition, formulaFunctionNames, isFormulaSemantics, type FormulaSemantics } from "./catalog";
import { legacyEquals, legacyCompare } from "./legacyFunctions";
import { sharedEquals, sharedCompare } from "./sharedSemantics";
import { toNumbers } from "src/lib/engine/numeric";
import { MAX_FORMULA_DEPTH as MAX_EVAL_DEPTH, MAX_FORMULA_INPUT_LENGTH, MAX_FORMULA_EVALUATION_STEPS, MAX_FORMULA_LIST_ITEMS as MAX_LIST_ITEMS, assertFormulaLimits, freezeParsedFormula, consumeFinancialWork } from "./limits";
import { validateFormulaRaw } from "./validation";
export { isStyledValue } from "./computedFunctions";
export type { StyledValue, FormulaResult } from "./computedFunctions";


// ── Public API ───────────────────────────────────────────────

/**
 * i2-perf (A4 H3): an expression is parsed once, not once per record — 54 ms
 * per 5000 records went to re-parsing the same text. A parse error is kept
 * too, so a broken formula costs one throw per record instead of a parse.
 */
const AST_CACHE_LIMIT = 256;
const astCache = new Map<string, FormulaNode | Error>();
const parserOwnedRoots = new WeakSet<FormulaNode>();
const checkedParsedRoots = new WeakSet<FormulaNode>();
function parsedFormula(expression: string, bounded = false): FormulaNode {
  if (bounded && expression.length > MAX_FORMULA_INPUT_LENGTH) throw new Error("Formula input limit exceeded");
  // Prefix BOTH profiles: arbitrary source cannot impersonate the other key space.
  const key = (bounded ? "unified:" : "legacy:") + expression;
  let entry = astCache.get(key);
  if (entry === undefined) {
    try {
      entry = parseFormula(expression, bounded ? MAX_EVAL_DEPTH : undefined);
      if (bounded) {
        assertFormulaLimits(entry);
      }
      // Legacy roots can also escape through public pass keys; do not let
      // mutation poison the shared parse/shape caches for future callers.
      freezeParsedFormula(entry);
      if (bounded) checkedParsedRoots.add(entry);
      parserOwnedRoots.add(entry);
    } catch (e) { entry = e instanceof Error ? e : new Error(String(e)); }
    if (astCache.size >= AST_CACHE_LIMIT) astCache.delete(astCache.keys().next().value as string);
    astCache.set(key, entry);
  }
  if (entry instanceof Error) throw entry;
  return entry;
}

/**
 * i3-final: one evaluation pass over a frame — every record of a formula
 * column, computed against the SAME frame object. `SUM(@amount)` has one value
 * for the whole pass, yet it used to be recomputed for each record: O(N²),
 * seconds on a 2000-row table. A pass remembers, keyed by the parsed
 * expression's node (the AST cache keeps it stable) within this frame:
 *   - each column read by `@name`, raw and numeric;
 *   - the value of every call that reads columns and nothing record-specific.
 * The caller owns the lifetime: a new pass for a new or changed frame.
 */
export interface FormulaPass {
  readonly frame: DataFrame | undefined;
  readonly semantics?: FormulaSemantics;
  readonly referenceTime?: number;
  readonly rawColumns: Map<string, readonly unknown[]>;
  readonly numericColumns: Map<string, readonly number[]>;
  readonly frameValues: Map<FormulaNode, Optional<DataValue>>;
}

interface RuntimePass extends FormulaPass {
  readonly semantics: FormulaSemantics;
  readonly referenceTime: number;
}

export function createFormulaPass(frame?: DataFrame, semantics: FormulaSemantics = "legacy-computed", referenceDate?: Date): RuntimePass {
  return { frame, semantics, referenceTime: referenceDate?.getTime() ?? Date.now(), rawColumns: new Map(), numericColumns: new Map(), frameValues: new Map() };
}

export interface FormulaEvaluationContext {
  readonly record: DataRecord;
  readonly frame?: DataFrame;
  readonly semantics: FormulaSemantics;
  readonly referenceDate?: Date;
  readonly pass?: FormulaPass;
}

function passFor(context: FormulaEvaluationContext): RuntimePass {
  const { pass, frame, semantics } = context;
  if (!isFormulaSemantics(semantics)) {
    throw new Error("Unknown formula semantics");
  }
  const matches = pass && pass.frame === frame && (pass.semantics ?? "legacy-computed") === semantics;
  const referenceTime = context.referenceDate?.getTime() ?? (matches ? pass.referenceTime ?? Date.now() : Date.now());
  if (semantics === "unified-v1" && !Number.isFinite(referenceTime)) throw new Error("Invalid formula reference date");
  if (matches && (pass.referenceTime === referenceTime || (pass.referenceTime === undefined && semantics === "legacy-computed"))) return { ...pass, semantics, referenceTime };
  return createFormulaPass(frame, semantics, new Date(referenceTime));
}

/** Explicit context API. Nothing selects the new rules without naming its profile. */
export function evaluateExpression(expression: string, context: FormulaEvaluationContext): FormulaResult {
  try {
    return { value: evaluateFormulaNode(parsedFormula(expression, context.semantics === "unified-v1"), context) };
  } catch (error) {
    return { value: null, error: humanFormulaError(error instanceof Error ? error.message : String(error), Object.keys(context.record.values)) };
  }
}

/** AST entry also serves the old boolean wrapper; it preserves its thrown errors. */
export function evaluateFormulaNode(node: FormulaNode, context: FormulaEvaluationContext): Optional<DataValue> {
  const pass = passFor(context);
  if (pass.semantics === "unified-v1" && !checkedParsedRoots.has(node)) assertFormulaLimits(node);
  return evaluateNode(node, context.record, context.frame, undefined, 0, pass, {
    remaining: MAX_FORMULA_EVALUATION_STEPS,
    cacheAst: pass.semantics === "unified-v1" ? checkedParsedRoots.has(node) : parserOwnedRoots.has(node),
  });
}

export function evaluateFormulaValue(
  expression: string,
  record: DataRecord,
  dataFrame?: DataFrame,
  pass?: FormulaPass
): Optional<DataValue> {
  return evaluateFormulaWithError(expression, record, dataFrame, pass).value;
}

export function evaluateFormulaWithError(
  expression: string,
  record: DataRecord,
  dataFrame?: DataFrame,
  pass?: FormulaPass
): FormulaResult {
  try {
    const ast = parsedFormula(expression);
    // A pass built for another frame would answer for the wrong rows.
    const own: RuntimePass = pass && pass.frame === dataFrame && (pass.semantics ?? "legacy-computed") === "legacy-computed"
      ? { ...pass, semantics: "legacy-computed", referenceTime: pass.referenceTime ?? Date.now() } : createFormulaPass(dataFrame);
    const value = evaluateNode(ast, record, dataFrame, undefined, 0, own, { remaining: MAX_FORMULA_EVALUATION_STEPS, cacheAst: true });
    return { value };
  } catch (e) {
    // i3-final: the preview's error is shown to the person — in their language.
    return {
      value: null,
      error: humanFormulaError(e instanceof Error ? e.message : String(e), Object.keys(record.values)),
    };
  }
}

export function validateFormulaExpression(
  expression: string,
  availableFields: string[]
): string[] {
  return validateFormulaRaw(expression, availableFields, "legacy-computed", true).map(raw => humanFormulaError(raw, availableFields));
}

export function getFormulaFunctions(): string[] {
  return formulaFunctionNames("legacy-computed");
}

// ── Internal ─────────────────────────────────────────────────

interface EvaluationBudget { remaining: number; readonly cacheAst: boolean }

/** Calls whose value can differ between records even when no field is named. */
const RECORD_BOUND = new Set(["ID", "PROP", "RANDOM_INT", "LET", "LETS", "MAP", "FILTER", "REDUCE"]);
const INTERNAL_WORK_FUNCTIONS = new Set(["CUMPRINC", "CUMIPMT", "IRR", "RATE", "NPV", "WORKDAYS"]);

type NodeShape = { readonly constant: boolean; readonly readsColumn: boolean };
const shapeMemo = new WeakMap<FormulaNode, NodeShape>();

/**
 * i3-final: whether a node has ONE value for the whole frame (it names no
 * field and no record-bound function) and reads a column — the calls a pass
 * computes once. A scope variable (LET, MAP) is a `field` node, so anything
 * that uses one is record-bound by construction.
 */
function shapeOf(n: FormulaNode): NodeShape {
  const memo = shapeMemo.get(n);
  if (memo) return memo;
  let shape: NodeShape;
  switch (n.type) {
    case "literal": shape = { constant: true, readsColumn: false }; break;
    case "column_ref": shape = { constant: true, readsColumn: true }; break;
    case "field": shape = { constant: false, readsColumn: false }; break;
    default: {
      const kids = n.type === "operator" ? [n.left, n.right] : n.type === "array" ? n.items : n.args;
      const shapes = kids.map(shapeOf);
      shape = {
        constant: shapes.every((s) => s.constant) && !(n.type === "function" && RECORD_BOUND.has(n.name)),
        readsColumn: shapes.some((s) => s.readsColumn),
      };
    }
  }
  shapeMemo.set(n, shape);
  return shape;
}

function evaluateNode(
  node: FormulaNode,
  record: DataRecord,
  dataFrame: DataFrame | undefined,
  scope: Map<string, DataValue> | undefined,
  depth: number,
  pass: RuntimePass,
  budget: EvaluationBudget
): Optional<DataValue> {
  if (depth > MAX_EVAL_DEPTH) return null;

  // i3-final: a column is read once per pass, in the frame's own key spelling.
  function rawColumn(name: string): readonly unknown[] {
    let col = pass.rawColumns.get(name);
    if (!col) {
      if (!dataFrame) return [];
      const key = resolveFieldName(name, dataFrame.fields.map((f) => f.name)) ?? name;
      // Frozen: the pass's own snapshot, which lets criteria remember scans.
      col = Object.freeze(dataFrame.records.map((r) => r.values[key]));
      pass.rawColumns.set(name, col);
    }
    return col;
  }

  function resolveColumn(name: string): number[] {
    let col = pass.numericColumns.get(name);
    if (!col) {
      // A whole column of user data — the plainest Class-A site in the file.
      col = toNumbers(rawColumn(name));
      pass.numericColumns.set(name, col);
    }
    // A copy: the value may be stored in a record, and records must not share it.
    return col.slice();
  }

  function rangeOf(n: FormulaNode): readonly unknown[] | null {
    if (n.type === "column_ref") return rawColumn(n.name);
    const v = evaluate(n);
    return Array.isArray(v) ? v : null;
  }

  function evaluate(n: FormulaNode): Optional<DataValue> {
    if (pass.semantics === "unified-v1" && --budget.remaining < 0) throw new Error("Formula evaluation limit exceeded");
    switch (n.type) {
      case "literal":
        return n.value;

      case "field": {
        if (scope?.has(n.name)) return scope.get(n.name);
        // D20: `Paid` reaches the property `paid` — names match without case.
        const key = pass.semantics === "legacy-filter" ? n.name :
          (pass.semantics === "unified-v1" ? Object.prototype.hasOwnProperty.call(record.values, n.name) : n.name in record.values)
            ? n.name : resolveFieldName(n.name, Object.keys(record.values)) ?? n.name;
        if (pass.semantics === "unified-v1" && !Object.prototype.hasOwnProperty.call(record.values, key)) return null;
        const val = record.values[key];
        if (val === undefined) return null;
        if (typeof val === "string") {
          const m = val.match(/^\[\[([^\]]+)\]\]$/);
          if (m?.[1]) {
            const inner = m[1];
            const pipe = inner.indexOf("|");
            return pipe >= 0 ? inner.substring(pipe + 1) : inner;
          }
        }
        return val;
      }

      case "column_ref":
        if (pass.semantics === "legacy-filter") throw new Error('Unknown node type: "column_ref"');
        return resolveColumn(n.name);

      case "array":
        return n.items.map((item) => evaluate(item));

      case "operator": {
        const left = evaluate(n.left);
        const right = evaluate(n.right);
        if (pass.semantics === "legacy-filter") {
          switch (n.operator) {
            case "=": return legacyEquals(left, right);
            case "!=": return !legacyEquals(left, right);
            case ">": return legacyCompare(left, right) > 0;
            case "<": return legacyCompare(left, right) < 0;
            case ">=": return legacyCompare(left, right) >= 0;
            case "<=": return legacyCompare(left, right) <= 0;
            // Saved filter formulas retain their original JS arithmetic.
            case "+": return (left as number) + (right as number);
            case "-": return (left as number) - (right as number);
            case "*": return (left as number) * (right as number);
            case "/": return (left as number) / (right as number);
            default: throw new Error(`Unknown operator: ${n.operator}`);
          }
        }
        if (pass.semantics === "unified-v1") {
          if (n.operator === "=") return sharedEquals(left, right);
          if (n.operator === "!=") return !sharedEquals(left, right);
          if ([">", "<", ">=", "<="].includes(n.operator)) {
            const comparison = sharedCompare(left, right);
            if (comparison === null) return false;
            if (n.operator === ">") return comparison > 0;
            if (n.operator === "<") return comparison < 0;
            if (n.operator === ">=") return comparison >= 0;
            return comparison <= 0;
          }
        }
        switch (n.operator) {
          case "=": return smartEq(left, right);
          case "!=": return !smartEq(left, right);
          case ">": return toNum(left) > toNum(right);
          case "<": return toNum(left) < toNum(right);
          case ">=": return toNum(left) >= toNum(right);
          case "<=": return toNum(left) <= toNum(right);
          case "+": {
            // `+` is numeric as soon as ONE side is a number; an absent operand
            // contributes 0. Only when neither side is a number does it
            // concatenate, so two absent fields give "" rather than a silent 0.
            //
            // Before #180a this operator disagreed with itself about an absent
            // field: `null` arrived as 0 through `Number(null)` while
            // `undefined` arrived as NaN and concatenated. Making both
            // concatenate would have removed that disagreement and created a
            // larger one — `-`, `*` and `/` read an absent operand as 0 through
            // `toNum`, so `a - 1` would be -1 while `a + 1` was the string "1".
            // Excel and Airtable read a blank cell as 0 in arithmetic while
            // ignoring it inside AVERAGE; those are different questions and
            // SPEC_MATH_SPREADSHEET_2026-09-02 §2.2 answers the second one.
            // A PRESENT non-numeric value ("abc") still concatenates.
            const ln = operandNumber(left), rn = operandNumber(right);
            if (ln !== null && rn !== null) return ln + rn;
            if (ln !== null && isAbsentOperand(right)) return ln;
            if (rn !== null && isAbsentOperand(left)) return rn;
            return String(left ?? "") + String(right ?? "");
          }
          case "-": return toNum(left) - toNum(right);
          case "*": return toNum(left) * toNum(right);
          case "/": {
            const d = toNum(right);
            return d === 0 ? null : toNum(left) / d;
          }
          default: return null;
        }
      }

      case "function": {
        if (pass.semantics === "legacy-filter" || !budget.cacheAst) return callFunction(n);
        const shape = shapeOf(n);
        if (!shape.constant || !shape.readsColumn) return callFunction(n);
        // i3-final: once per pass. Only a plain value is kept — a list would
        // be one array shared by every record that stores it.
        if (pass.frameValues.has(n)) return pass.frameValues.get(n);
        const value = callFunction(n);
        if (value === null || typeof value !== "object") pass.frameValues.set(n, value);
        return value;
      }

      default:
        if (pass.semantics === "legacy-filter") throw new Error(`Unknown node type: ${JSON.stringify((n as { type?: unknown }).type)}`);
        return null;
    }
  }

  function iterationList(value: Optional<DataValue>): unknown[] {
    const list: unknown[] = Array.isArray(value) ? value : value != null ? [value] : [];
    if (list.length > MAX_LIST_ITEMS && pass.semantics === "unified-v1") throw new Error("Formula list limit exceeded");
    return list.length > MAX_LIST_ITEMS ? list.slice(0, MAX_LIST_ITEMS) : list;
  }

  function callFunction(n: Extract<FormulaNode, { type: "function" }>): Optional<DataValue> {
    const definition = n.name === n.name.toUpperCase() ? getFormulaDefinition(n.name, pass.semantics) : undefined;
    if (!definition) {
      if (pass.semantics === "legacy-computed") return null;
      throw new Error(`Unknown function: ${n.name}`);
    }
    if (pass.semantics === "legacy-filter") return definition.invoke(n.args, evaluate, rangeOf, pass);
    if (n.name === "LET") {
      if (n.args.length < 3) return null;
      const nameNode = n.args[0] as FormulaNode;
      const varName =
        nameNode.type === "literal" ? String(nameNode.value) :
        nameNode.type === "field" ? nameNode.name : null;
      if (!varName) return null;
      const value = evaluate(n.args[1] as FormulaNode);
      const childScope = new Map<string, DataValue>(scope ?? []);
      childScope.set(varName, value as DataValue);
      return evaluateNode(n.args[2] as FormulaNode, record, dataFrame, childScope, depth + 1, pass, budget);
    }

    if (n.name === "PROP") {
      // PROP("FieldName") — Notion 2.0 alias for a field reference
      if (n.args.length < 1) return null;
      const nameArg = n.args[0] as FormulaNode;
      const fieldName =
        nameArg.type === "literal" ? String(nameArg.value) :
        nameArg.type === "field" ? nameArg.name : null;
      if (!fieldName) return null;
      if (scope?.has(fieldName)) return scope.get(fieldName);
      if (pass.semantics === "unified-v1") return evaluate({ type: "field", name: fieldName });
      const v = record.values[fieldName];
      return (v === undefined ? null : v);
    }

    if (n.name === "ID") {
      // ID() — returns the unique identifier of the current record
      return record.id;
    }

    if (n.name === "LETS") {
      // LETS(name1, val1, name2, val2, ..., expr) — multi-bind LET
      // requires at least 3 args and odd total count
      if (n.args.length < 3 || n.args.length % 2 === 0) return null;
      let currentScope = new Map<string, DataValue>(scope ?? []);
      const pairCount = (n.args.length - 1) / 2;
      for (let p = 0; p < pairCount; p++) {
        const nameNode = n.args[p * 2] as FormulaNode;
        const varName =
          nameNode.type === "literal" ? String(nameNode.value) :
          nameNode.type === "field" ? nameNode.name : null;
        if (!varName) return null;
        const val = evaluateNode(n.args[p * 2 + 1] as FormulaNode, record, dataFrame, currentScope, depth + 1, pass, budget);
        currentScope = new Map<string, DataValue>(currentScope);
        currentScope.set(varName, val as DataValue);
      }
      return evaluateNode(n.args[n.args.length - 1] as FormulaNode, record, dataFrame, currentScope, depth + 1, pass, budget);
    }

    if (n.name === "STYLE") {
      if (n.args.length < 1) return null;
      const text = String(evaluate(n.args[0] as FormulaNode) ?? "");
      const color = n.args[1] ? String(evaluate(n.args[1]) ?? "") : undefined;
      const weight = n.args[2] ? String(evaluate(n.args[2]) ?? "") : undefined;
      const cssClass = buildSafeClass(color, weight);
      return { __styled: true, text, cssClass } as unknown as DataValue;
    }

    if (n.name === "MAP") {
      if (n.args.length < 3) return null;
      const listVal = evaluate(n.args[0] as FormulaNode);
      const list = iterationList(listVal);
      const iterNameNode = n.args[1] as FormulaNode;
      const iterName =
        iterNameNode.type === "literal" ? String(iterNameNode.value) :
        iterNameNode.type === "field" ? iterNameNode.name : "item";
      return list.map(item => {
        const iterScope = new Map<string, DataValue>(scope ?? []);
        iterScope.set(iterName, item as DataValue);
        return evaluateNode(n.args[2] as FormulaNode, record, dataFrame, iterScope, depth + 1, pass, budget);
      });
    }

    if (n.name === "FILTER") {
      if (n.args.length < 3) return null;
      const listVal = evaluate(n.args[0] as FormulaNode);
      const list = iterationList(listVal);
      const iterNameNode = n.args[1] as FormulaNode;
      const iterName =
        iterNameNode.type === "literal" ? String(iterNameNode.value) :
        iterNameNode.type === "field" ? iterNameNode.name : "item";
      return list.filter(item => {
        const iterScope = new Map<string, DataValue>(scope ?? []);
        iterScope.set(iterName, item as DataValue);
        return Boolean(evaluateNode(n.args[2] as FormulaNode, record, dataFrame, iterScope, depth + 1, pass, budget));
      }) as unknown as DataValue;
    }

    if (n.name === "REDUCE") {
      if (n.args.length < 5) return null;
      const listVal = evaluate(n.args[0] as FormulaNode);
      const list = iterationList(listVal);
      const iterNameNode = n.args[1] as FormulaNode;
      const iterName =
        iterNameNode.type === "literal" ? String(iterNameNode.value) :
        iterNameNode.type === "field" ? iterNameNode.name : "item";
      const accNameNode = n.args[2] as FormulaNode;
      const accName =
        accNameNode.type === "literal" ? String(accNameNode.value) :
        accNameNode.type === "field" ? accNameNode.name : "acc";
      let acc: DataValue = evaluate(n.args[3] as FormulaNode) as DataValue;
      for (const item of list) {
        const iterScope = new Map<string, DataValue>(scope ?? []);
        iterScope.set(iterName, item as DataValue);
        iterScope.set(accName, acc);
        acc = evaluateNode(n.args[4] as FormulaNode, record, dataFrame, iterScope, depth + 1, pass, budget) as DataValue;
      }
      return acc;
    }

    if (INTERNAL_WORK_FUNCTIONS.has(n.name)) {
      return definition.invoke(n.args, evaluate, rangeOf, {
        semantics: pass.semantics,
        referenceTime: pass.referenceTime,
        chargeWork(steps) {
          budget.remaining = consumeFinancialWork(budget.remaining, steps);
        },
      });
    }
    return definition.invoke(n.args, evaluate, rangeOf, pass);
  }

  return evaluate(node);
}

function smartEq(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "string" && typeof b === "string") {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return a === b;
}

/**
 * Operand for `>`, `<`, `>=`, `<=`, `-`, `*`, `/`. A non-number is 0 here, as
 * it always has been — #180a routes the coercion without touching that
 * fallback, which is the empty-input policy and belongs to #180b.
 */
function toNum(val: unknown): number {
  return operandNumber(val) ?? 0;
}
