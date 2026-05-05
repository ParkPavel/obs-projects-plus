/**
 * PARITY-004 — Notion-style relative date filter operators.
 *
 * Validates that 7 new operators (is-this-year, is-past-week/month/year,
 * is-next-week/month/year) follow Notion semantics:
 *   - past_*  = last N days inclusive of today, exclusive of N+1 days ago
 *   - next_*  = next N days inclusive of today, exclusive of N+1 days ahead
 *   - this_year = same calendar year
 *
 * Critical: timezone neutrality — comparisons use dayjs with day precision.
 */

import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { dateFns } from './filterFunctions';

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

const today = () => dayjs().toDate();
const daysAgo = (n: number) => dayjs().subtract(n, 'day').toDate();
const daysAhead = (n: number) => dayjs().add(n, 'day').toDate();

describe('PARITY-004 — relative date operators', () => {
  describe('is-this-year', () => {
    it('matches today', () => {
      expect(dateFns['is-this-year'](today())).toBe(true);
    });
    it('matches Jan 1 of this year', () => {
      const d = dayjs().startOf('year').toDate();
      expect(dateFns['is-this-year'](d)).toBe(true);
    });
    it('rejects last year', () => {
      const d = dayjs().subtract(1, 'year').toDate();
      expect(dateFns['is-this-year'](d)).toBe(false);
    });
    it('returns false for null', () => {
      expect(dateFns['is-this-year'](null as unknown as Date)).toBe(false);
    });
  });

  describe('is-past-week', () => {
    it('matches today', () => {
      expect(dateFns['is-past-week'](today())).toBe(true);
    });
    it('matches 6 days ago', () => {
      expect(dateFns['is-past-week'](daysAgo(6))).toBe(true);
    });
    it('rejects 7 days ago (boundary, exclusive)', () => {
      expect(dateFns['is-past-week'](daysAgo(7))).toBe(false);
    });
    it('rejects future date', () => {
      expect(dateFns['is-past-week'](daysAhead(1))).toBe(false);
    });
  });

  describe('is-past-month', () => {
    it('matches today and 1 day ago', () => {
      expect(dateFns['is-past-month'](today())).toBe(true);
      expect(dateFns['is-past-month'](daysAgo(1))).toBe(true);
    });
    it('matches ~25 days ago', () => {
      expect(dateFns['is-past-month'](daysAgo(25))).toBe(true);
    });
    it('rejects 60 days ago', () => {
      expect(dateFns['is-past-month'](daysAgo(60))).toBe(false);
    });
  });

  describe('is-past-year', () => {
    it('matches 100 days ago', () => {
      expect(dateFns['is-past-year'](daysAgo(100))).toBe(true);
    });
    it('rejects 400 days ago', () => {
      expect(dateFns['is-past-year'](daysAgo(400))).toBe(false);
    });
    it('rejects future', () => {
      expect(dateFns['is-past-year'](daysAhead(5))).toBe(false);
    });
  });

  describe('is-next-week', () => {
    it('matches today and 6 days ahead', () => {
      expect(dateFns['is-next-week'](today())).toBe(true);
      expect(dateFns['is-next-week'](daysAhead(6))).toBe(true);
    });
    it('rejects 8 days ahead', () => {
      expect(dateFns['is-next-week'](daysAhead(8))).toBe(false);
    });
    it('rejects past', () => {
      expect(dateFns['is-next-week'](daysAgo(1))).toBe(false);
    });
  });

  describe('is-next-month', () => {
    it('matches 25 days ahead', () => {
      expect(dateFns['is-next-month'](daysAhead(25))).toBe(true);
    });
    it('rejects 60 days ahead', () => {
      expect(dateFns['is-next-month'](daysAhead(60))).toBe(false);
    });
  });

  describe('is-next-year', () => {
    it('matches 100 days ahead', () => {
      expect(dateFns['is-next-year'](daysAhead(100))).toBe(true);
    });
    it('rejects 400 days ahead', () => {
      expect(dateFns['is-next-year'](daysAhead(400))).toBe(false);
    });
    it('rejects past', () => {
      expect(dateFns['is-next-year'](daysAgo(10))).toBe(false);
    });
  });

  describe('null/undefined handling', () => {
    const ops = [
      'is-this-year',
      'is-past-week', 'is-past-month', 'is-past-year',
      'is-next-week', 'is-next-month', 'is-next-year',
    ] as const;

    it.each(ops)('%s returns false for null', (op) => {
      expect(dateFns[op](null as unknown as Date)).toBe(false);
    });

    it.each(ops)('%s returns false for undefined', (op) => {
      expect(dateFns[op](undefined as unknown as Date)).toBe(false);
    });
  });
});
