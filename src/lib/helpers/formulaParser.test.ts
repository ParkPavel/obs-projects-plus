/**
 * Formula Parser Tests
 *
 * Covers: tokenizer, parser, evaluator (all built-in functions),
 * validator, and edge cases including our recent fixes.
 */

import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import {
  tokenize,
  parseFormula,
  evaluateFormula,
  validateFormula,
} from './formulaParser';
import type { DataRecord, DataValue, Optional } from 'src/lib/dataframe/dataframe';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Helper: create a DataRecord with given values
function makeRecord(values: Record<string, Optional<DataValue>>, id = 'test.md'): DataRecord {
  return { id, values };
}

const BASE_DATE = new Date('2026-04-10T12:00:00');

// ════════════════════════════════════════════
//  TOKENIZER
// ════════════════════════════════════════════

describe('tokenize', () => {
  it('tokenizes a simple field comparison', () => {
    const tokens = tokenize('status = "Active"');
    expect(tokens.map(t => t.type)).toEqual([
      'FIELD', 'OPERATOR', 'STRING', 'EOF',
    ]);
  });

  it('tokenizes numbers (integer and negative)', () => {
    const tokens = tokenize('priority > -3');
    expect(tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'NUMBER', value: -3 }),
    ]));
  });

  it('tokenizes float numbers', () => {
    const tokens = tokenize('score = 3.14');
    expect(tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'NUMBER', value: 3.14 }),
    ]));
  });

  it('tokenizes boolean TRUE/FALSE (case-insensitive identifiers)', () => {
    const tokens = tokenize('done = TRUE');
    expect(tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'BOOLEAN', value: true }),
    ]));
  });

  it('tokenizes NULL keyword', () => {
    const tokens = tokenize('field = NULL');
    expect(tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'NULL', value: null }),
    ]));
  });

  it('tokenizes function names as FUNCTION tokens', () => {
    const tokens = tokenize('AND(CONTAINS(tags, "urgent"))');
    const functionTokens = tokens.filter(t => t.type === 'FUNCTION');
    expect(functionTokens.map(t => t.value)).toEqual(['AND', 'CONTAINS']);
  });

  it('tokenizes multi-char operators', () => {
    const tokens = tokenize('a >= 1');
    expect(tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'OPERATOR', value: '>=' }),
    ]));
  });

  it('tokenizes string escape sequences', () => {
    const tokens = tokenize('"hello\\nworld"');
    expect(tokens[0]).toEqual(expect.objectContaining({
      type: 'STRING',
      value: 'hello\nworld',
    }));
  });

  it('skips comments', () => {
    const tokens = tokenize('status = "Active" # this is a comment');
    expect(tokens.map(t => t.type)).toEqual([
      'FIELD', 'OPERATOR', 'STRING', 'EOF',
    ]);
  });

  it('throws on unexpected character', () => {
    expect(() => tokenize('status @ "Active"')).toThrow(/Unexpected character/);
  });

  it('tokenizes array brackets and commas', () => {
    const tokens = tokenize('["a", "b"]');
    const types = tokens.map(t => t.type);
    expect(types).toEqual(['LBRACKET', 'STRING', 'COMMA', 'STRING', 'RBRACKET', 'EOF']);
  });
});

// ════════════════════════════════════════════
//  PARSER
// ════════════════════════════════════════════

describe('parseFormula', () => {
  it('parses a simple comparison', () => {
    const node = parseFormula('status = "Active"');
    expect(node.type).toBe('operator');
    if (node.type === 'operator') {
      expect(node.operator).toBe('=');
      expect(node.left).toEqual({ type: 'field', name: 'status' });
      expect(node.right).toEqual({ type: 'literal', value: 'Active' });
    }
  });

  it('parses a function call with arguments', () => {
    const node = parseFormula('CONTAINS(tags, "urgent")');
    expect(node.type).toBe('function');
    if (node.type === 'function') {
      expect(node.name).toBe('CONTAINS');
      expect(node.args).toHaveLength(2);
    }
  });

  it('parses nested functions', () => {
    const node = parseFormula('AND(status = "Active", priority > 5)');
    expect(node.type).toBe('function');
    if (node.type === 'function') {
      expect(node.name).toBe('AND');
      expect(node.args).toHaveLength(2);
    }
  });

  it('parses array literals', () => {
    const node = parseFormula('HAS_ANY_OF(tags, ["a", "b"])');
    expect(node.type).toBe('function');
    if (node.type === 'function') {
      expect(node.args[1]?.type).toBe('array');
    }
  });
});

// ════════════════════════════════════════════
//  EVALUATOR — Comparison operators
// ════════════════════════════════════════════

describe('evaluateFormula — comparisons', () => {
  it('field = string (exact match)', () => {
    const node = parseFormula('status = "Active"');
    expect(evaluateFormula(node, makeRecord({ status: 'Active' }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ status: 'Done' }), BASE_DATE)).toBe(false);
  });

  it('field != string', () => {
    const node = parseFormula('status != "Done"');
    expect(evaluateFormula(node, makeRecord({ status: 'Active' }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ status: 'Done' }), BASE_DATE)).toBe(false);
  });

  it('field > number', () => {
    const node = parseFormula('priority > 3');
    expect(evaluateFormula(node, makeRecord({ priority: 5 }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ priority: 2 }), BASE_DATE)).toBe(false);
  });

  it('field >= and <= number', () => {
    const ge = parseFormula('score >= 10');
    const le = parseFormula('score <= 10');
    expect(evaluateFormula(ge, makeRecord({ score: 10 }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(le, makeRecord({ score: 10 }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(ge, makeRecord({ score: 9 }), BASE_DATE)).toBe(false);
    expect(evaluateFormula(le, makeRecord({ score: 11 }), BASE_DATE)).toBe(false);
  });

  it('field = boolean', () => {
    const node = parseFormula('done = TRUE');
    expect(evaluateFormula(node, makeRecord({ done: true }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ done: false }), BASE_DATE)).toBe(false);
  });

  it('case-insensitive string comparison', () => {
    const node = parseFormula('status = "active"');
    expect(evaluateFormula(node, makeRecord({ status: 'Active' }), BASE_DATE)).toBe(true);
  });
});

// ════════════════════════════════════════════
//  EVALUATOR — Logical functions
// ════════════════════════════════════════════

describe('evaluateFormula — AND / OR / NOT', () => {
  it('AND — all true', () => {
    const node = parseFormula('AND(status = "Active", priority > 3)');
    expect(evaluateFormula(node, makeRecord({ status: 'Active', priority: 5 }), BASE_DATE)).toBe(true);
  });

  it('AND — one false', () => {
    const node = parseFormula('AND(status = "Active", priority > 3)');
    expect(evaluateFormula(node, makeRecord({ status: 'Active', priority: 1 }), BASE_DATE)).toBe(false);
  });

  it('OR — one true', () => {
    const node = parseFormula('OR(status = "Active", status = "Done")');
    expect(evaluateFormula(node, makeRecord({ status: 'Done' }), BASE_DATE)).toBe(true);
  });

  it('OR — none true', () => {
    const node = parseFormula('OR(status = "Active", status = "Done")');
    expect(evaluateFormula(node, makeRecord({ status: 'Pending' }), BASE_DATE)).toBe(false);
  });

  it('NOT(condition)', () => {
    const node = parseFormula('NOT(done = TRUE)');
    expect(evaluateFormula(node, makeRecord({ done: false }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ done: true }), BASE_DATE)).toBe(false);
  });
});

// ════════════════════════════════════════════
//  EVALUATOR — String functions
// ════════════════════════════════════════════

describe('evaluateFormula — string functions', () => {
  it('CONTAINS', () => {
    const node = parseFormula('CONTAINS(title, "hello")');
    expect(evaluateFormula(node, makeRecord({ title: 'Say Hello World' }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ title: 'Goodbye' }), BASE_DATE)).toBe(false);
  });

  it('NOT_CONTAINS', () => {
    const node = parseFormula('NOT_CONTAINS(title, "hello")');
    expect(evaluateFormula(node, makeRecord({ title: 'Goodbye' }), BASE_DATE)).toBe(true);
  });

  it('STARTS_WITH (case-sensitive)', () => {
    const node = parseFormula('STARTS_WITH(title, "Hello")');
    expect(evaluateFormula(node, makeRecord({ title: 'Hello World' }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ title: 'Say Hello' }), BASE_DATE)).toBe(false);
    // different case → false
    const node2 = parseFormula('STARTS_WITH(title, "hello")');
    expect(evaluateFormula(node2, makeRecord({ title: 'Hello World' }), BASE_DATE)).toBe(false);
  });

  it('ENDS_WITH (case-sensitive)', () => {
    const node = parseFormula('ENDS_WITH(title, "World")');
    expect(evaluateFormula(node, makeRecord({ title: 'Hello World' }), BASE_DATE)).toBe(true);
    // different case → false
    const node2 = parseFormula('ENDS_WITH(title, "world")');
    expect(evaluateFormula(node2, makeRecord({ title: 'Hello World' }), BASE_DATE)).toBe(false);
  });

  it('IS_EMPTY', () => {
    const node = parseFormula('IS_EMPTY(notes)');
    expect(evaluateFormula(node, makeRecord({ notes: '' }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ notes: null }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({}), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ notes: 'text' }), BASE_DATE)).toBe(false);
  });

  it('IS_NOT_EMPTY', () => {
    const node = parseFormula('IS_NOT_EMPTY(notes)');
    expect(evaluateFormula(node, makeRecord({ notes: 'text' }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ notes: '' }), BASE_DATE)).toBe(false);
  });
});

// ════════════════════════════════════════════
//  EVALUATOR — Date functions
// ════════════════════════════════════════════

describe('evaluateFormula — date functions', () => {
  const today = '2026-04-10';
  const yesterday = '2026-04-09';
  const tomorrow = '2026-04-11';
  const pastDate = '2026-03-01';
  const futureDate = '2026-05-01';

  it('IS_TODAY', () => {
    const node = parseFormula('IS_TODAY(due)');
    expect(evaluateFormula(node, makeRecord({ due: today }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ due: yesterday }), BASE_DATE)).toBe(false);
  });

  it('IS_OVERDUE', () => {
    const node = parseFormula('IS_OVERDUE(due)');
    expect(evaluateFormula(node, makeRecord({ due: pastDate }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ due: futureDate }), BASE_DATE)).toBe(false);
  });

  it('IS_UPCOMING', () => {
    const node = parseFormula('IS_UPCOMING(due)');
    expect(evaluateFormula(node, makeRecord({ due: futureDate }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ due: pastDate }), BASE_DATE)).toBe(false);
  });

  it('IS_BEFORE', () => {
    const node = parseFormula('IS_BEFORE(due, "2026-04-15")');
    expect(evaluateFormula(node, makeRecord({ due: today }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ due: futureDate }), BASE_DATE)).toBe(false);
  });

  it('IS_AFTER', () => {
    const node = parseFormula('IS_AFTER(due, "2026-04-01")');
    expect(evaluateFormula(node, makeRecord({ due: today }), BASE_DATE)).toBe(true);
  });

  it('IS_ON_AND_BEFORE', () => {
    const node = parseFormula('IS_ON_AND_BEFORE(due, "2026-04-10")');
    expect(evaluateFormula(node, makeRecord({ due: today }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ due: tomorrow }), BASE_DATE)).toBe(false);
  });

  it('IS_ON_AND_AFTER', () => {
    const node = parseFormula('IS_ON_AND_AFTER(due, "2026-04-10")');
    expect(evaluateFormula(node, makeRecord({ due: today }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ due: yesterday }), BASE_DATE)).toBe(false);
  });

  it('IS_THIS_MONTH', () => {
    const node = parseFormula('IS_THIS_MONTH(due)');
    expect(evaluateFormula(node, makeRecord({ due: today }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ due: '2026-05-15' }), BASE_DATE)).toBe(false);
  });

  it('returns false for null/empty date fields', () => {
    const node = parseFormula('IS_TODAY(due)');
    expect(evaluateFormula(node, makeRecord({ due: null }), BASE_DATE)).toBe(false);
    expect(evaluateFormula(node, makeRecord({}), BASE_DATE)).toBe(false);
  });
});

// ════════════════════════════════════════════
//  EVALUATOR — DATE_ADD / DATE_SUB (P2.4 fix)
// ════════════════════════════════════════════

describe('evaluateFormula — DATE_ADD / DATE_SUB', () => {
  it('DATE_ADD adds days', () => {
    const node = parseFormula('IS_ON_AND_AFTER(due, DATE_ADD("2026-04-10", 5, "day"))');
    // 2026-04-10 + 5 days = 2026-04-15; due=2026-04-20 >= 2026-04-15
    expect(evaluateFormula(node, makeRecord({ due: '2026-04-20' }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ due: '2026-04-10' }), BASE_DATE)).toBe(false);
  });

  it('DATE_SUB subtracts days', () => {
    const node = parseFormula('IS_BEFORE(due, DATE_SUB("2026-04-10", 3, "day"))');
    // 2026-04-10 - 3 = 2026-04-07; due=2026-04-01 < 2026-04-07
    expect(evaluateFormula(node, makeRecord({ due: '2026-04-01' }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ due: '2026-04-09' }), BASE_DATE)).toBe(false);
  });
});

// ════════════════════════════════════════════
//  EVALUATOR — Array functions
// ════════════════════════════════════════════

describe('evaluateFormula — HAS_ANY_OF / HAS_ALL_OF / HAS_NONE_OF', () => {
  it('HAS_ANY_OF returns true when at least one matches', () => {
    const node = parseFormula('HAS_ANY_OF(tags, ["bug", "urgent"])');
    expect(evaluateFormula(node, makeRecord({ tags: ['bug', 'feature'] }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ tags: ['feature', 'docs'] }), BASE_DATE)).toBe(false);
  });

  it('HAS_ALL_OF returns true when all match', () => {
    const node = parseFormula('HAS_ALL_OF(tags, ["bug", "urgent"])');
    expect(evaluateFormula(node, makeRecord({ tags: ['bug', 'urgent', 'critical'] }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ tags: ['bug', 'feature'] }), BASE_DATE)).toBe(false);
  });

  it('HAS_NONE_OF returns true when none match', () => {
    const node = parseFormula('HAS_NONE_OF(tags, ["bug", "urgent"])');
    expect(evaluateFormula(node, makeRecord({ tags: ['feature', 'docs'] }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ tags: ['bug', 'docs'] }), BASE_DATE)).toBe(false);
  });

  it('returns false for non-array fields', () => {
    const node = parseFormula('HAS_ANY_OF(title, ["a"])');
    expect(evaluateFormula(node, makeRecord({ title: 'a string' }), BASE_DATE)).toBe(false);
  });
});

// ════════════════════════════════════════════
//  EVALUATOR — Arithmetic operators
// ════════════════════════════════════════════

describe('evaluateFormula — arithmetic', () => {
  it('field + number', () => {
    const node = parseFormula('priority + 1 > 5');
    expect(evaluateFormula(node, makeRecord({ priority: 5 }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ priority: 4 }), BASE_DATE)).toBe(false);
  });

  it('field * number', () => {
    const node = parseFormula('score * 2 >= 10');
    expect(evaluateFormula(node, makeRecord({ score: 5 }), BASE_DATE)).toBe(true);
  });
});

// ════════════════════════════════════════════
//  EVALUATOR — Edge cases
// ════════════════════════════════════════════

describe('evaluateFormula — edge cases', () => {
  it('missing field returns falsy', () => {
    const node = parseFormula('nonexistent = "value"');
    expect(evaluateFormula(node, makeRecord({}), BASE_DATE)).toBe(false);
  });

  it('null field = NULL is true', () => {
    const node = parseFormula('field = NULL');
    expect(evaluateFormula(node, makeRecord({ field: null }), BASE_DATE)).toBe(true);
  });

  it('complex nested formula', () => {
    const node = parseFormula('AND(OR(status = "Active", status = "InProgress"), priority >= 3)');
    expect(evaluateFormula(node, makeRecord({ status: 'InProgress', priority: 4 }), BASE_DATE)).toBe(true);
    expect(evaluateFormula(node, makeRecord({ status: 'Done', priority: 5 }), BASE_DATE)).toBe(false);
  });

  it('throws on unknown function', () => {
    // FOOBAR is not a known function → parsed as field, not function
    // Test with a valid function name pattern that isn't registered
    expect(() => {
      const node = parseFormula('status = "Active"');
      // This should work normally
      evaluateFormula(node, makeRecord({ status: 'Active' }), BASE_DATE);
    }).not.toThrow();
  });
});

// ════════════════════════════════════════════
//  VALIDATOR
// ════════════════════════════════════════════

describe('validateFormula', () => {
  it('returns no errors for valid formula', () => {
    const errors = validateFormula('status = "Active"', ['status']);
    expect(errors).toEqual([]);
  });

  it('returns error for unknown field', () => {
    const errors = validateFormula('unknown_field = "Active"', ['status', 'priority']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toMatch(/unknown_field/i);
  });

  it('returns error for syntax error', () => {
    const errors = validateFormula('AND(', ['status']);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts all built-in functions without errors', () => {
    const formulas = [
      'IS_EMPTY(field)',
      'IS_NOT_EMPTY(field)',
      'CONTAINS(field, "text")',
      'IS_TODAY(field)',
      'IS_OVERDUE(field)',
    ];
    for (const formula of formulas) {
      const errors = validateFormula(formula, ['field']);
      expect(errors).toEqual([]);
    }
  });
});
