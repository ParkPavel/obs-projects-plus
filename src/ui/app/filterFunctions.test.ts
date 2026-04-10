/**
 * Filter Functions Tests
 *
 * Covers string, number, boolean, date, list operators
 * and the case-insensitive fix (P1#7).
 */

import {
  matchesCondition,
  matchesFilterConditions,
  baseFns,
  stringFns,
  numberFns,
  booleanFns,
  listFns,
} from './filterFunctions';
import type { DataRecord, DataValue, Optional } from 'src/lib/dataframe/dataframe';
import type { FilterCondition, FilterDefinition } from 'src/settings/settings';

function makeRecord(values: Record<string, Optional<DataValue>>, id = 'test.md'): DataRecord {
  return { id, values };
}

function makeCond(field: string, operator: string, value?: string): FilterCondition {
  return { field, operator, value } as FilterCondition;
}

// ════════════════════════════════════════
//  BASE OPERATORS
// ════════════════════════════════════════

describe('baseFns', () => {
  it('is-empty: undefined, null, empty string, empty array', () => {
    expect(baseFns['is-empty'](undefined)).toBe(true);
    expect(baseFns['is-empty'](null)).toBe(true);
    expect(baseFns['is-empty']('')).toBe(true);
    expect(baseFns['is-empty']([])).toBe(true);
  });

  it('is-empty: non-empty values', () => {
    expect(baseFns['is-empty']('text')).toBe(false);
    expect(baseFns['is-empty'](0)).toBe(false);
    expect(baseFns['is-empty'](['a'])).toBe(false);
  });

  it('is-not-empty: inverse', () => {
    expect(baseFns['is-not-empty']('text')).toBe(true);
    expect(baseFns['is-not-empty'](undefined)).toBe(false);
  });
});

// ════════════════════════════════════════
//  STRING OPERATORS — case-insensitive (P1#7 fix)
// ════════════════════════════════════════

describe('stringFns', () => {
  it('is: exact match', () => {
    expect(stringFns.is('Active', 'Active')).toBe(true);
    expect(stringFns.is('Active', 'Done')).toBe(false);
  });

  it('is-not: inverse', () => {
    expect(stringFns['is-not']('Active', 'Done')).toBe(true);
    expect(stringFns['is-not']('Active', 'Active')).toBe(false);
  });

  it('contains: case-insensitive', () => {
    expect(stringFns.contains('Hello World', 'hello')).toBe(true);
    expect(stringFns.contains('Hello World', 'WORLD')).toBe(true);
    expect(stringFns.contains('Hello', 'xyz')).toBe(false);
  });

  it('contains: null/undefined left returns false', () => {
    expect(stringFns.contains(null, 'test')).toBe(false);
    expect(stringFns.contains(undefined, 'test')).toBe(false);
  });

  it('not-contains: case-insensitive', () => {
    expect(stringFns['not-contains']('Hello World', 'HELLO')).toBe(false);
    expect(stringFns['not-contains']('Hello', 'xyz')).toBe(true);
  });

  it('not-contains: null left returns true', () => {
    expect(stringFns['not-contains'](null, 'test')).toBe(true);
  });
});

// ════════════════════════════════════════
//  NUMBER OPERATORS
// ════════════════════════════════════════

describe('numberFns', () => {
  it('eq / neq', () => {
    expect(numberFns.eq(5, 5)).toBe(true);
    expect(numberFns.eq(5, 3)).toBe(false);
    expect(numberFns.neq(5, 3)).toBe(true);
  });

  it('lt / gt / lte / gte', () => {
    expect(numberFns.lt(3, 5)).toBe(true);
    expect(numberFns.gt(5, 3)).toBe(true);
    expect(numberFns.lte(5, 5)).toBe(true);
    expect(numberFns.gte(5, 5)).toBe(true);
    expect(numberFns.lt(5, 5)).toBe(false);
    expect(numberFns.gt(5, 5)).toBe(false);
  });

  it('returns false for non-numbers', () => {
    expect(numberFns.lt(undefined, 5)).toBe(false);
    expect(numberFns.gt(null, 5)).toBe(false);
  });
});

// ════════════════════════════════════════
//  BOOLEAN OPERATORS
// ════════════════════════════════════════

describe('booleanFns', () => {
  it('is-checked / is-not-checked', () => {
    expect(booleanFns['is-checked'](true)).toBe(true);
    expect(booleanFns['is-checked'](false)).toBe(false);
    expect(booleanFns['is-not-checked'](false)).toBe(true);
  });
});

// ════════════════════════════════════════
//  LIST OPERATORS — case-insensitive (P1#7 fix)
// ════════════════════════════════════════

describe('listFns', () => {
  it('has-any-of', () => {
    expect(listFns['has-any-of'](['a', 'b', 'c'], ['b', 'd'])).toBe(true);
    expect(listFns['has-any-of'](['a', 'b'], ['d', 'e'])).toBe(false);
  });

  it('has-all-of', () => {
    expect(listFns['has-all-of'](['a', 'b', 'c'], ['a', 'b'])).toBe(true);
    expect(listFns['has-all-of'](['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('has-none-of', () => {
    expect(listFns['has-none-of'](['a', 'b'], ['c', 'd'])).toBe(true);
    expect(listFns['has-none-of'](['a', 'b'], ['a', 'd'])).toBe(false);
  });

  it('has-keyword: case-insensitive', () => {
    expect(listFns['has-keyword'](['Bug', 'Feature'], 'bug')).toBe(true);
    expect(listFns['has-keyword'](['Bug', 'Feature'], 'FEATURE')).toBe(true);
    expect(listFns['has-keyword'](['Bug', 'Feature'], 'docs')).toBe(false);
  });

  it('has-keyword: partial match (includes)', () => {
    expect(listFns['has-keyword'](['critical-bug', 'feature'], 'bug')).toBe(true);
  });

  it('has-keyword: undefined right returns false', () => {
    expect(listFns['has-keyword'](['a', 'b'], undefined)).toBe(false);
  });
});

// ════════════════════════════════════════
//  INTEGRATION — matchesCondition
// ════════════════════════════════════════

describe('matchesCondition', () => {
  it('string contains (case-insensitive)', () => {
    const record = makeRecord({ title: 'Hello World' });
    expect(matchesCondition(makeCond('title', 'contains', 'hello'), record)).toBe(true);
  });

  it('is-empty on missing field', () => {
    const record = makeRecord({});
    expect(matchesCondition(makeCond('missing', 'is-empty'), record)).toBe(true);
  });

  it('number gt', () => {
    const record = makeRecord({ priority: 5 });
    expect(matchesCondition(makeCond('priority', 'gt', '3'), record)).toBe(true);
  });
});

// ════════════════════════════════════════
//  INTEGRATION — matchesFilterConditions
// ════════════════════════════════════════

describe('matchesFilterConditions', () => {
  it('AND conjunction — all must match', () => {
    const filter: FilterDefinition = {
      conjunction: 'and',
      conditions: [
        makeCond('status', 'is', 'Active'),
        makeCond('priority', 'gt', '3'),
      ],
    };
    expect(matchesFilterConditions(filter, makeRecord({ status: 'Active', priority: 5 }))).toBe(true);
    expect(matchesFilterConditions(filter, makeRecord({ status: 'Active', priority: 1 }))).toBe(false);
  });

  it('OR conjunction — any must match', () => {
    const filter: FilterDefinition = {
      conjunction: 'or',
      conditions: [
        makeCond('status', 'is', 'Active'),
        makeCond('status', 'is', 'Done'),
      ],
    };
    expect(matchesFilterConditions(filter, makeRecord({ status: 'Done' }))).toBe(true);
    expect(matchesFilterConditions(filter, makeRecord({ status: 'Pending' }))).toBe(false);
  });

  it('empty filter returns true', () => {
    const filter: FilterDefinition = { conjunction: 'and', conditions: [] };
    expect(matchesFilterConditions(filter, makeRecord({ status: 'Active' }))).toBe(true);
  });
});
