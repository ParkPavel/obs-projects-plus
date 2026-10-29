// Pure shared formula syntax; callable names come from the executable registry.
import { FORMULA_FUNCTION_NAMES } from "./catalog";


// ============================================
// AST Types
// ============================================

export type FormulaNode =
  | { type: 'function'; name: string; args: FormulaNode[] }
  | { type: 'operator'; operator: string; left: FormulaNode; right: FormulaNode }
  | { type: 'field'; name: string }
  | { type: 'column_ref'; name: string }
  | { type: 'literal'; value: string | number | boolean | null }
  | { type: 'array'; items: FormulaNode[] };

/**
 * Optional source-position offsets into the ORIGINAL formula string
 * (before escape processing). `formula.slice(start, end)` recovers the
 * raw fragment. Optional → backward compatible with all consumers.
 */
type Span = { start?: number; end?: number };

export type Token =
  | ({ type: 'FUNCTION'; value: string } & Span)
  | ({ type: 'FIELD'; value: string } & Span)
  | ({ type: 'STRING'; value: string } & Span)
  | ({ type: 'NUMBER'; value: number } & Span)
  | ({ type: 'BOOLEAN'; value: boolean } & Span)
  | ({ type: 'NULL'; value: null } & Span)
  | ({ type: 'OPERATOR'; value: string } & Span)
  | ({ type: 'LPAREN'; value: '(' } & Span)
  | ({ type: 'RPAREN'; value: ')' } & Span)
  | ({ type: 'LBRACKET'; value: '[' } & Span)
  | ({ type: 'RBRACKET'; value: ']' } & Span)
  | ({ type: 'COMMA'; value: ',' } & Span)
  | ({ type: 'EOF'; value: '' } & Span);

// ============================================
// Tokenizer
// ============================================

const OPERATORS = ['>=', '<=', '!=', '=', '>', '<', '+', '-', '*', '/'];
const FUNCTIONS = FORMULA_FUNCTION_NAMES;

/**
 * i3-final — a field name is letters of any script, digits and `_`. ASCII
 * only (as before) meant a property named «сумма» or «客户» could not be
 * written in a formula at all, neither bare nor as `@column`. A name with
 * spaces or punctuation still goes through PROP("…").
 */
const IDENT_START = /[\p{L}_]/u;
const IDENT_PART = /[\p{L}\p{N}_]/u;

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

    const tokenStart = i;

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
      tokens.push({ type: 'STRING', value, start: tokenStart, end: i });
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

      // coercion-exempt: Class B — lexing source text, not interpreting user
      // data. The scanner above has already consumed exactly the `[\d.]` run
      // that makes up this token, so the whole-string question `toNumber` asks
      // has been answered by the scan itself. This is also what lets the
      // evaluator route its argument coercion wholesale: a numeric literal is
      // a JS number before evaluation, so `toNumber` is a no-op on it (#180a).
      tokens.push({ type: 'NUMBER', value: parseFloat(value), start: tokenStart, end: i });
      continue;
    }

    // Operators (multi-char first)
    let foundOperator = false;
    for (const op of OPERATORS) {
      if (formula.substring(i, i + op.length) === op) {
        i += op.length;
        tokens.push({ type: 'OPERATOR', value: op, start: tokenStart, end: i });
        foundOperator = true;
        break;
      }
    }
    if (foundOperator) continue;

    // Parentheses and brackets
    if (char === '(') {
      i++;
      tokens.push({ type: 'LPAREN', value: '(', start: tokenStart, end: i });
      continue;
    }
    if (char === ')') {
      i++;
      tokens.push({ type: 'RPAREN', value: ')', start: tokenStart, end: i });
      continue;
    }
    if (char === '[') {
      i++;
      tokens.push({ type: 'LBRACKET', value: '[', start: tokenStart, end: i });
      continue;
    }
    if (char === ']') {
      i++;
      tokens.push({ type: 'RBRACKET', value: ']', start: tokenStart, end: i });
      continue;
    }
    if (char === ',') {
      i++;
      tokens.push({ type: 'COMMA', value: ',', start: tokenStart, end: i });
      continue;
    }

    // @column reference (cross-record)
    if (char === '@') {
      i++; // skip @
      let value = '';
      while (i < formula.length) {
        const ch = formula[i];
        if (!ch || !IDENT_PART.test(ch)) break;
        value += ch;
        i++;
      }
      if (value) {
        tokens.push({ type: 'FIELD', value: `@${value}`, start: tokenStart, end: i });
      }
      continue;
    }

    // Identifiers (functions, fields, booleans, null)
    if (IDENT_START.test(char)) {
      let value = '';
      while (i < formula.length) {
        const ch = formula[i];
        if (!ch || !IDENT_PART.test(ch)) break;
        value += ch;
        i++;
      }

      const upperValue = value.toUpperCase();

      // Keywords
      if (upperValue === 'TRUE') {
        tokens.push({ type: 'BOOLEAN', value: true, start: tokenStart, end: i });
      } else if (upperValue === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: false, start: tokenStart, end: i });
      } else if (upperValue === 'NULL') {
        tokens.push({ type: 'NULL', value: null, start: tokenStart, end: i });
      } else if (FUNCTIONS.includes(upperValue)) {
        tokens.push({ type: 'FUNCTION', value: upperValue, start: tokenStart, end: i });
      } else {
        // Field reference
        tokens.push({ type: 'FIELD', value, start: tokenStart, end: i });
      }
      continue;
    }

    throw new Error(`Unexpected character at position ${i}: ${char}`);
  }

  tokens.push({ type: 'EOF', value: '', start: i, end: i });
  return tokens;
}

// ============================================
// Parser
// ============================================

class Parser {
  private tokens: Token[];
  private current = 0;
  private nesting = 0;
  private readonly maxDepth: number;

  constructor(tokens: Token[], maxDepth = Infinity) {
    this.tokens = tokens;
    this.maxDepth = maxDepth;
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
    let left = this.parseAdditive();

    while (this.peek().type === 'OPERATOR' && ['=', '!=', '>', '<', '>=', '<='].includes(this.peek().value as string)) {
      const operator = this.advance().value as string;
      const right = this.parseAdditive();
      left = { type: 'operator', operator, left, right };
    }

    return left;
  }

  private parseAdditive(): FormulaNode {
    let left = this.parseMultiplicative();

    while (this.peek().type === 'OPERATOR' && ['+', '-'].includes(this.peek().value as string)) {
      const operator = this.advance().value as string;
      const right = this.parseMultiplicative();
      left = { type: 'operator', operator, left, right };
    }

    return left;
  }

  private parseMultiplicative(): FormulaNode {
    let left = this.parseTerm();

    while (this.peek().type === 'OPERATOR' && ['*', '/'].includes(this.peek().value as string)) {
      const operator = this.advance().value as string;
      const right = this.parseTerm();
      left = { type: 'operator', operator, left, right };
    }

    return left;
  }

  private parseTerm(): FormulaNode {
    if (++this.nesting > this.maxDepth) { this.nesting--; throw new Error("Formula parsing limit exceeded"); }
    try {
    const token = this.peek();

    if (token.type === 'FUNCTION') {
      return this.parseFunction();
    }

    if (token.type === 'FIELD') {
      this.advance();
      if (typeof token.value === 'string' && token.value.startsWith('@')) {
        return { type: 'column_ref', name: token.value.substring(1) };
      }
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
  } finally { this.nesting--; }
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

export function parseFormula(formula: string, maxDepth?: number): FormulaNode {
  const tokens = tokenize(formula);
  const parser = new Parser(tokens, maxDepth);
  return parser.parse();
}
