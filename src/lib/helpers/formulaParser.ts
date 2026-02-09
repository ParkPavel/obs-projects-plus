/**
 * Formula Parser (v3.1.0)
 * 
 * Advanced filter mode with formula-based filtering
 * Supports logical expressions, built-in functions, and field references
 * 
 * Example formulas:
 * - AND(status = "Active", priority > 5)
 * - OR(IS_EMPTY(dueDate), IS_OVERDUE(dueDate))
 * - AND(CONTAINS(tags, "urgent"), date >= TODAY())
 */

import type { DataRecord } from 'src/lib/dataframe/dataframe';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// ============================================
// AST Types
// ============================================

export type FormulaNode =
  | { type: 'function'; name: string; args: FormulaNode[] }
  | { type: 'operator'; operator: string; left: FormulaNode; right: FormulaNode }
  | { type: 'field'; name: string }
  | { type: 'literal'; value: string | number | boolean | null }
  | { type: 'array'; items: FormulaNode[] };

export type Token = 
  | { type: 'FUNCTION'; value: string }
  | { type: 'FIELD'; value: string }
  | { type: 'STRING'; value: string }
  | { type: 'NUMBER'; value: number }
  | { type: 'BOOLEAN'; value: boolean }
  | { type: 'NULL'; value: null }
  | { type: 'OPERATOR'; value: string }
  | { type: 'LPAREN'; value: '(' }
  | { type: 'RPAREN'; value: ')'}
  | { type: 'LBRACKET'; value: '[' }
  | { type: 'RBRACKET'; value: ']' }
  | { type: 'COMMA'; value: ',' }
  | { type: 'EOF'; value: '' };

// ============================================
// Tokenizer
// ============================================

const OPERATORS = ['>=', '<=', '!=', '=', '>', '<', '+', '-', '*', '/'];
const FUNCTIONS = [
  'AND', 'OR', 'NOT', 
  'IS_EMPTY', 'IS_NOT_EMPTY',
  'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH',
  'TODAY', 'NOW', 'TOMORROW', 'YESTERDAY',
  'IS_TODAY', 'IS_THIS_WEEK', 'IS_THIS_MONTH',
  'IS_BEFORE', 'IS_AFTER', 'IS_ON_AND_BEFORE', 'IS_ON_AND_AFTER',
  'IS_OVERDUE', 'IS_UPCOMING',
  'DATE_ADD', 'DATE_SUB',
  'HAS_ANY_OF', 'HAS_ALL_OF', 'HAS_NONE_OF',
];

export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];
    if (!char) break;

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Comments (from # to end of line)
    if (char === '#') {
      while (i < formula.length && formula[i] !== '\n') {
        i++;
      }
      continue;
    }

    // String literals (double or single quotes)
    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      i++; // Skip opening quote
      
      while (i < formula.length && formula[i] !== quote) {
        if (formula[i] === '\\' && i + 1 < formula.length) {
          // Escape sequences
          i++;
          const escaped = formula[i];
          switch (escaped) {
            case 'n': value += '\n'; break;
            case 't': value += '\t'; break;
            case '\\': value += '\\'; break;
            case quote: value += quote; break;
            default: value += escaped;
          }
        } else {
          value += formula[i];
        }
        i++;
      }
      
      i++; // Skip closing quote
      tokens.push({ type: 'STRING', value });
      continue;
    }

    // Numbers
    const nextChar = formula[i + 1];
    if (/\d/.test(char) || (char === '-' && nextChar && /\d/.test(nextChar))) {
      let value = '';
      if (char === '-') {
        value += char;
        i++;
      }
      
      while (i < formula.length) {
        const ch = formula[i];
        if (!ch || !/[\d.]/.test(ch)) break;
        value += ch;
        i++;
      }
      
      tokens.push({ type: 'NUMBER', value: parseFloat(value) });
      continue;
    }

    // Operators (multi-char first)
    let foundOperator = false;
    for (const op of OPERATORS) {
      if (formula.substring(i, i + op.length) === op) {
        tokens.push({ type: 'OPERATOR', value: op });
        i += op.length;
        foundOperator = true;
        break;
      }
    }
    if (foundOperator) continue;

    // Parentheses and brackets
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }
    if (char === '[') {
      tokens.push({ type: 'LBRACKET', value: '[' });
      i++;
      continue;
    }
    if (char === ']') {
      tokens.push({ type: 'RBRACKET', value: ']' });
      i++;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Identifiers (functions, fields, booleans, null)
    if (/[a-zA-Z_]/.test(char)) {
      let value = '';
      while (i < formula.length) {
        const ch = formula[i];
        if (!ch || !/[a-zA-Z0-9_]/.test(ch)) break;
        value += ch;
        i++;
      }

      const upperValue = value.toUpperCase();

      // Keywords
      if (upperValue === 'TRUE') {
        tokens.push({ type: 'BOOLEAN', value: true });
      } else if (upperValue === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: false });
      } else if (upperValue === 'NULL') {
        tokens.push({ type: 'NULL', value: null });
      } else if (FUNCTIONS.includes(upperValue)) {
        tokens.push({ type: 'FUNCTION', value: upperValue });
      } else {
        // Field reference
        tokens.push({ type: 'FIELD', value });
      }
      continue;
    }

    throw new Error(`Unexpected character at position ${i}: ${char}`);
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

// ============================================
// Parser
// ============================================

class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    const token = this.tokens[this.current];
    if (!token) throw new Error('Unexpected end of input');
    return token;
  }

  private advance(): Token {
    const token = this.tokens[this.current++];
    if (!token) throw new Error('Unexpected end of input');
    return token;
  }

  private expect(type: Token['type']): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(`Expected ${type} but got ${token.type}`);
    }
    return this.advance();
  }

  parse(): FormulaNode {
    const result = this.parseExpression();
    this.expect('EOF');
    return result;
  }

  private parseExpression(): FormulaNode {
    return this.parseComparison();
  }

  private parseComparison(): FormulaNode {
    let left = this.parseTerm();

    while (this.peek().type === 'OPERATOR') {
      const operator = this.advance().value as string;
      const right = this.parseTerm();
      left = { type: 'operator', operator, left, right };
    }

    return left;
  }

  private parseTerm(): FormulaNode {
    const token = this.peek();

    if (token.type === 'FUNCTION') {
      return this.parseFunction();
    }

    if (token.type === 'FIELD') {
      this.advance();
      return { type: 'field', name: token.value };
    }

    if (token.type === 'STRING') {
      this.advance();
      return { type: 'literal', value: token.value };
    }

    if (token.type === 'NUMBER') {
      this.advance();
      return { type: 'literal', value: token.value };
    }

    if (token.type === 'BOOLEAN') {
      this.advance();
      return { type: 'literal', value: token.value };
    }

    if (token.type === 'NULL') {
      this.advance();
      return { type: 'literal', value: null };
    }

    if (token.type === 'LPAREN') {
      this.advance(); // Skip (
      const expr = this.parseExpression();
      this.expect('RPAREN');
      return expr;
    }

    if (token.type === 'LBRACKET') {
      return this.parseArray();
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }

  private parseFunction(): FormulaNode {
    const funcToken = this.expect('FUNCTION');
    const name = typeof funcToken.value === 'string' ? funcToken.value : String(funcToken.value);
    
    this.expect('LPAREN');
    
    const args: FormulaNode[] = [];
    
    if (this.peek().type !== 'RPAREN') {
      args.push(this.parseExpression());
      
      while (this.peek().type === 'COMMA') {
        this.advance(); // Skip comma
        args.push(this.parseExpression());
      }
    }
    
    this.expect('RPAREN');
    
    return { type: 'function', name, args };
  }

  private parseArray(): FormulaNode {
    this.expect('LBRACKET');
    
    const items: FormulaNode[] = [];
    
    if (this.peek().type !== 'RBRACKET') {
      items.push(this.parseExpression());
      
      while (this.peek().type === 'COMMA') {
        this.advance();
        items.push(this.parseExpression());
      }
    }
    
    this.expect('RBRACKET');
    
    return { type: 'array', items };
  }
}

export function parseFormula(formula: string): FormulaNode {
  const tokens = tokenize(formula);
  const parser = new Parser(tokens);
  return parser.parse();
}

// ============================================
// Evaluator
// ============================================

export function evaluateFormula(
  node: FormulaNode,
  record: DataRecord,
  baseDate?: Date
): boolean {
  const base = baseDate ? dayjs(baseDate) : dayjs();

  /**
   * Smart equality: case-insensitive strings, type coercion, date-aware.
   * Matches behavior of visual-mode 'is' operator for consistency.
   */
  function smartEquals(left: any, right: any): boolean {
    // Both null/undefined
    if (left == null && right == null) return true;
    if (left == null || right == null) return false;

    // Both strings → case-insensitive, trimmed
    if (typeof left === 'string' && typeof right === 'string') {
      const l = left.trim().toLowerCase();
      const r = right.trim().toLowerCase();
      if (l === r) return true;
      // Date-aware: both look like dates → compare as day
      const dl = dayjs(left);
      const dr = dayjs(right);
      if (dl.isValid() && dr.isValid() && isDateLikeStr(left) && isDateLikeStr(right)) {
        return dl.isSame(dr, 'day');
      }
      return false;
    }

    // Number ↔ String coercion
    if (typeof left === 'number' && typeof right === 'string') {
      const num = Number(right);
      if (!isNaN(num)) return left === num;
      return false;
    }
    if (typeof left === 'string' && typeof right === 'number') {
      const num = Number(left);
      if (!isNaN(num)) return num === right;
      return false;
    }

    // Boolean ↔ String coercion
    if (typeof left === 'boolean' && typeof right === 'string') {
      return left === (right.toLowerCase() === 'true');
    }
    if (typeof left === 'string' && typeof right === 'boolean') {
      return (left.toLowerCase() === 'true') === right;
    }

    return left === right;
  }

  /** Check if string looks like a date (ISO format or YYYY-MM-DD) */
  function isDateLikeStr(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}/.test(s.trim());
  }

  /**
   * Smart comparison for >, <, >=, <=.
   * Numbers compared numerically; dates compared by day; strings by locale.
   * Returns negative, zero, or positive like compareTo.
   */
  function smartCompare(left: any, right: any): number {
    // Both null → equal
    if (left == null && right == null) return 0;
    if (left == null) return -1;
    if (right == null) return 1;

    // Number ↔ Number
    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }

    // Number ↔ String coercion
    if (typeof left === 'number' && typeof right === 'string') {
      const num = Number(right);
      if (!isNaN(num)) return left - num;
    }
    if (typeof left === 'string' && typeof right === 'number') {
      const num = Number(left);
      if (!isNaN(num)) return num - right;
    }

    // Date strings
    if (typeof left === 'string' && typeof right === 'string') {
      const dl = dayjs(left);
      const dr = dayjs(right);
      if (dl.isValid() && dr.isValid() && isDateLikeStr(left) && isDateLikeStr(right)) {
        return dl.valueOf() - dr.valueOf();
      }
      // Fallback: locale-aware string compare
      return left.localeCompare(right, undefined, { sensitivity: 'base' });
    }

    // Fallback to string coercion
    return String(left).localeCompare(String(right));
  }

  // Helper to safely get argument
  function getArg(args: FormulaNode[], index: number): FormulaNode {
    const arg = args[index];
    if (!arg) throw new Error(`Missing argument at index ${index}`);
    return arg;
  }

  /**
   * Evaluate formula node to dynamic value
   * @returns any - Formula values can be: string | number | boolean | Date | null
   *                Type depends on runtime expression, cannot be statically determined
   */
  function evaluate(n: FormulaNode): any {
    switch (n.type) {
      case 'literal':
        return n.value;

      case 'field': {
        const value = record.values[n.name];
        if (value === undefined) return null;
        // Strip wiki-link syntax: [[path|display]] → display
        if (typeof value === 'string') {
          const m = value.match(/^\[\[([^\]]+)\]\]$/);
          if (m && m[1]) {
            const inner = m[1];
            const pipeIdx = inner.indexOf('|');
            return pipeIdx >= 0 ? inner.substring(pipeIdx + 1) : inner;
          }
        }
        return value;
      }

      case 'array':
        return n.items.map(item => evaluate(item));

      case 'operator': {
        const left = evaluate(n.left);
        const right = evaluate(n.right);

        switch (n.operator) {
          case '=': return smartEquals(left, right);
          case '!=': return !smartEquals(left, right);
          case '>': return smartCompare(left, right) > 0;
          case '<': return smartCompare(left, right) < 0;
          case '>=': return smartCompare(left, right) >= 0;
          case '<=': return smartCompare(left, right) <= 0;
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return left / right;
          default: throw new Error(`Unknown operator: ${n.operator}`);
        }
      }

      case 'function': {
        const funcName = n.name;
        const args = n.args;

        // Logical functions
        if (funcName === 'AND') {
          return args.every(arg => evaluate(arg) === true);
        }
        if (funcName === 'OR') {
          return args.some(arg => evaluate(arg) === true);
        }
        if (funcName === 'NOT') {
          if (args.length !== 1) throw new Error('NOT expects 1 argument');
          return !evaluate(getArg(args, 0));
        }

        // Empty checks
        if (funcName === 'IS_EMPTY') {
          if (args.length !== 1) throw new Error('IS_EMPTY expects 1 argument');
          const val = evaluate(getArg(args, 0));
          return val === null || val === undefined || val === '' || 
                 (Array.isArray(val) && val.length === 0);
        }
        if (funcName === 'IS_NOT_EMPTY') {
          if (args.length !== 1) throw new Error('IS_NOT_EMPTY expects 1 argument');
          const val = evaluate(getArg(args, 0));
          return !(val === null || val === undefined || val === '' || 
                   (Array.isArray(val) && val.length === 0));
        }

        // String functions
        if (funcName === 'CONTAINS') {
          if (args.length !== 2) throw new Error('CONTAINS expects 2 arguments');
          const haystack = String(evaluate(getArg(args, 0)) ?? '').toLowerCase();
          const needle = String(evaluate(getArg(args, 1)) ?? '').toLowerCase();
          return haystack.includes(needle);
        }
        if (funcName === 'NOT_CONTAINS') {
          if (args.length !== 2) throw new Error('NOT_CONTAINS expects 2 arguments');
          const haystack = String(evaluate(getArg(args, 0)) ?? '').toLowerCase();
          const needle = String(evaluate(getArg(args, 1)) ?? '').toLowerCase();
          return !haystack.includes(needle);
        }
        if (funcName === 'STARTS_WITH') {
          if (args.length !== 2) throw new Error('STARTS_WITH expects 2 arguments');
          const str = String(evaluate(getArg(args, 0)) ?? '');
          const prefix = String(evaluate(getArg(args, 1)) ?? '');
          return str.startsWith(prefix);
        }
        if (funcName === 'ENDS_WITH') {
          if (args.length !== 2) throw new Error('ENDS_WITH expects 2 arguments');
          const str = String(evaluate(getArg(args, 0)) ?? '');
          const suffix = String(evaluate(getArg(args, 1)) ?? '');
          return str.endsWith(suffix);
        }

        // Date constants
        if (funcName === 'TODAY') {
          return base.format('YYYY-MM-DD');
        }
        if (funcName === 'NOW') {
          return base.toISOString();
        }
        if (funcName === 'TOMORROW') {
          return base.add(1, 'day').format('YYYY-MM-DD');
        }
        if (funcName === 'YESTERDAY') {
          return base.subtract(1, 'day').format('YYYY-MM-DD');
        }

        // Date comparisons
        if (funcName === 'IS_TODAY') {
          if (args.length !== 1) throw new Error('IS_TODAY expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val);
          return date.isValid() && date.isSame(base, 'day');
        }
        if (funcName === 'IS_THIS_WEEK') {
          if (args.length !== 1) throw new Error('IS_THIS_WEEK expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val);
          return date.isValid() && date.isSame(base, 'week');
        }
        if (funcName === 'IS_THIS_MONTH') {
          if (args.length !== 1) throw new Error('IS_THIS_MONTH expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val);
          return date.isValid() && date.isSame(base, 'month');
        }
        if (funcName === 'IS_BEFORE') {
          if (args.length !== 2) throw new Error('IS_BEFORE expects 2 arguments');
          const date1 = dayjs(evaluate(getArg(args, 0)));
          const date2 = dayjs(evaluate(getArg(args, 1)));
          return date1.isValid() && date2.isValid() && date1.isBefore(date2, 'day');
        }
        if (funcName === 'IS_AFTER') {
          if (args.length !== 2) throw new Error('IS_AFTER expects 2 arguments');
          const date1 = dayjs(evaluate(getArg(args, 0)));
          const date2 = dayjs(evaluate(getArg(args, 1)));
          return date1.isValid() && date2.isValid() && date1.isAfter(date2, 'day');
        }
        if (funcName === 'IS_ON_AND_BEFORE') {
          if (args.length !== 2) throw new Error('IS_ON_AND_BEFORE expects 2 arguments');
          const date1 = dayjs(evaluate(getArg(args, 0)));
          const date2 = dayjs(evaluate(getArg(args, 1)));
          return date1.isValid() && date2.isValid() && date1.isSameOrBefore(date2, 'day');
        }
        if (funcName === 'IS_ON_AND_AFTER') {
          if (args.length !== 2) throw new Error('IS_ON_AND_AFTER expects 2 arguments');
          const date1 = dayjs(evaluate(getArg(args, 0)));
          const date2 = dayjs(evaluate(getArg(args, 1)));
          return date1.isValid() && date2.isValid() && date1.isSameOrAfter(date2, 'day');
        }
        if (funcName === 'IS_OVERDUE') {
          if (args.length !== 1) throw new Error('IS_OVERDUE expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val);
          return date.isValid() && date.isBefore(base, 'day');
        }
        if (funcName === 'IS_UPCOMING') {
          if (args.length !== 1) throw new Error('IS_UPCOMING expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val);
          return date.isValid() && date.isAfter(base, 'day');
        }

        // Date arithmetic
        if (funcName === 'DATE_ADD') {
          if (args.length !== 3) throw new Error('DATE_ADD expects 3 arguments (date, amount, unit)');
          const date = dayjs(evaluate(getArg(args, 0)));
          const amount = evaluate(getArg(args, 1));
          const unit = evaluate(getArg(args, 2));
          // @ts-ignore: dayjs.add() accepts ManipulateType union, but TypeScript narrows string to literal
          // Runtime: unit is string from formula evaluation (validated at parse time)
          return date.add(amount, unit as any).format('YYYY-MM-DD');
        }
        if (funcName === 'DATE_SUB') {
          if (args.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, amount, unit)');
          const date = dayjs(evaluate(getArg(args, 0)));
          const amount = evaluate(getArg(args, 1));
          const unit = evaluate(getArg(args, 2));
          // @ts-ignore: dayjs.subtract() accepts ManipulateType union, but TypeScript narrows string to literal
          // Runtime: unit is string from formula evaluation (validated at parse time)
          return date.subtract(amount, unit as any).format('YYYY-MM-DD');
        }

        // Array/Tag functions
        if (funcName === 'HAS_ANY_OF') {
          if (args.length !== 2) throw new Error('HAS_ANY_OF expects 2 arguments');
          const arr1 = evaluate(getArg(args, 0));
          const arr2 = evaluate(getArg(args, 1));
          if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
          return arr1.some(item => arr2.includes(item));
        }
        if (funcName === 'HAS_ALL_OF') {
          if (args.length !== 2) throw new Error('HAS_ALL_OF expects 2 arguments');
          const arr1 = evaluate(getArg(args, 0));
          const arr2 = evaluate(getArg(args, 1));
          if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
          return arr2.every(item => arr1.includes(item));
        }
        if (funcName === 'HAS_NONE_OF') {
          if (args.length !== 2) throw new Error('HAS_NONE_OF expects 2 arguments');
          const arr1 = evaluate(getArg(args, 0));
          const arr2 = evaluate(getArg(args, 1));
          if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
          return !arr1.some(item => arr2.includes(item));
        }

        throw new Error(`Unknown function: ${funcName}`);
      }

      default:
        // @ts-ignore: Exhaustive switch check - accessing .type on never for error reporting
        // This branch should never execute if all FormulaNode types handled above
        throw new Error(`Unknown node type: ${(n as any).type}`);
    }
  }

  const result = evaluate(node);
  return Boolean(result);
}

// ============================================
// Validator
// ============================================

export type ValidationError = {
  message: string;
  position?: number;
};

export function validateFormula(formula: string, availableFields: string[]): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const tokens = tokenize(formula);
    const parser = new Parser(tokens);
    const ast = parser.parse();

    // Check for undefined fields
    function checkFields(node: FormulaNode) {
      if (node.type === 'field') {
        if (!availableFields.includes(node.name)) {
          errors.push({
            message: `Unknown field: ${node.name}`,
          });
        }
      } else if (node.type === 'function') {
        node.args.forEach(checkFields);
      } else if (node.type === 'operator') {
        checkFields(node.left);
        checkFields(node.right);
      } else if (node.type === 'array') {
        node.items.forEach(checkFields);
      }
    }

    checkFields(ast);

  } catch (error) {
    errors.push({
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return errors;
}
