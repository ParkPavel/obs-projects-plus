/**
 * Date Formula Parser Tests
 * 
 * Validates DQL-compatible date formula parsing including:
 * - Base keywords (today, tomorrow, yesterday)
 * - DQL abbreviations (sow, eow, som, eom, soy, eoy)
 * - Legacy aliases (week_start, month_end, etc.)
 * - Duration unit offsets (+Nd, +Nw, +Nm, +Ny)
 * - Edge cases and error handling
 */

import dayjs from 'dayjs';
import {
  parseDateFormula,
  isDateFormula,
  getDateFormulaSuggestions,
  testDateFormula,
} from './dateFormulaParser';

// Fixed base date for deterministic tests
const BASE = dayjs('2026-02-07'); // Saturday, February 7, 2026

describe('dateFormulaParser', () => {
  // ═══════════════════════════════
  // parseDateFormula — basic keywords
  // ═══════════════════════════════
  describe('parseDateFormula — basic keywords', () => {
    test('today → current day', () => {
      const r = parseDateFormula('today', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-07');
    });

    test('now → alias for today', () => {
      const r = parseDateFormula('now', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-07');
    });

    test('tomorrow → next day', () => {
      const r = parseDateFormula('tomorrow', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-08');
    });

    test('yesterday → previous day', () => {
      const r = parseDateFormula('yesterday', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-06');
    });
  });

  // ═══════════════════════════════
  // parseDateFormula — DQL abbreviations
  // ═══════════════════════════════
  describe('parseDateFormula — DQL abbreviations', () => {
    test('sow → start of week', () => {
      const r = parseDateFormula('sow', BASE);
      expect(r.success).toBe(true);
      // dayjs default: Sunday is start of week
      expect(r.date?.day()).toBe(0); // Sunday
    });

    test('eow → end of week', () => {
      const r = parseDateFormula('eow', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.day()).toBe(6); // Saturday
    });

    test('som → start of month', () => {
      const r = parseDateFormula('som', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-01');
    });

    test('eom → end of month', () => {
      const r = parseDateFormula('eom', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-28');
    });

    test('soy → start of year', () => {
      const r = parseDateFormula('soy', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-01-01');
    });

    test('eoy → end of year', () => {
      const r = parseDateFormula('eoy', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-12-31');
    });
  });

  // ═══════════════════════════════
  // parseDateFormula — legacy aliases (backward compat)
  // ═══════════════════════════════
  describe('parseDateFormula — legacy aliases', () => {
    test('week_start = sow', () => {
      const a = parseDateFormula('week_start', BASE);
      const b = parseDateFormula('sow', BASE);
      expect(a.date?.format('YYYY-MM-DD')).toBe(b.date?.format('YYYY-MM-DD'));
    });

    test('weekstart = sow', () => {
      const a = parseDateFormula('weekstart', BASE);
      const b = parseDateFormula('sow', BASE);
      expect(a.date?.format('YYYY-MM-DD')).toBe(b.date?.format('YYYY-MM-DD'));
    });

    test('week_end = eow', () => {
      const a = parseDateFormula('week_end', BASE);
      const b = parseDateFormula('eow', BASE);
      expect(a.date?.format('YYYY-MM-DD')).toBe(b.date?.format('YYYY-MM-DD'));
    });

    test('weekend = eow', () => {
      const a = parseDateFormula('weekend', BASE);
      const b = parseDateFormula('eow', BASE);
      expect(a.date?.format('YYYY-MM-DD')).toBe(b.date?.format('YYYY-MM-DD'));
    });

    test('month_start = som', () => {
      const a = parseDateFormula('month_start', BASE);
      const b = parseDateFormula('som', BASE);
      expect(a.date?.format('YYYY-MM-DD')).toBe(b.date?.format('YYYY-MM-DD'));
    });

    test('month_end = eom', () => {
      const a = parseDateFormula('month_end', BASE);
      const b = parseDateFormula('eom', BASE);
      expect(a.date?.format('YYYY-MM-DD')).toBe(b.date?.format('YYYY-MM-DD'));
    });

    test('year_start = soy', () => {
      const a = parseDateFormula('year_start', BASE);
      const b = parseDateFormula('soy', BASE);
      expect(a.date?.format('YYYY-MM-DD')).toBe(b.date?.format('YYYY-MM-DD'));
    });

    test('year_end = eoy', () => {
      const a = parseDateFormula('year_end', BASE);
      const b = parseDateFormula('eoy', BASE);
      expect(a.date?.format('YYYY-MM-DD')).toBe(b.date?.format('YYYY-MM-DD'));
    });
  });

  // ═══════════════════════════════
  // parseDateFormula — day offsets (default unit)
  // ═══════════════════════════════
  describe('parseDateFormula — day offsets', () => {
    test('today+1 → tomorrow', () => {
      const r = parseDateFormula('today+1', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-08');
    });

    test('today-1 → yesterday', () => {
      const r = parseDateFormula('today-1', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-06');
    });

    test('today+7 → 7 days ahead', () => {
      const r = parseDateFormula('today+7', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-14');
    });

    test('today-7 → 7 days ago', () => {
      const r = parseDateFormula('today-7', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-01-31');
    });

    test('today+30 → 30 days ahead', () => {
      const r = parseDateFormula('today+30', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-03-09');
    });
  });

  // ═══════════════════════════════
  // parseDateFormula — duration unit offsets (d/w/m/y)
  // ═══════════════════════════════
  describe('parseDateFormula — duration units', () => {
    test('today+1d → 1 day', () => {
      const r = parseDateFormula('today+1d', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-08');
    });

    test('today+1w → 1 week', () => {
      const r = parseDateFormula('today+1w', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-14');
    });

    test('today-1w → −1 week', () => {
      const r = parseDateFormula('today-1w', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-01-31');
    });

    test('today+2w → 2 weeks', () => {
      const r = parseDateFormula('today+2w', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-21');
    });

    test('today+1m → 1 month', () => {
      const r = parseDateFormula('today+1m', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-03-07');
    });

    test('today-1m → −1 month', () => {
      const r = parseDateFormula('today-1m', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-01-07');
    });

    test('today+1y → 1 year', () => {
      const r = parseDateFormula('today+1y', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2027-02-07');
    });

    test('today-1y → −1 year', () => {
      const r = parseDateFormula('today-1y', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2025-02-07');
    });

    test('som+1m → start of next month', () => {
      const r = parseDateFormula('som+1m', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-03-01');
    });

    test('som-1m → start of previous month', () => {
      const r = parseDateFormula('som-1m', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-01-01');
    });

    test('sow+1w → start of next week', () => {
      const r = parseDateFormula('sow+1w', BASE);
      expect(r.success).toBe(true);
      const sowDate = BASE.startOf('week');
      expect(r.date?.format('YYYY-MM-DD')).toBe(sowDate.add(1, 'week').format('YYYY-MM-DD'));
    });

    test('sow-1w → start of previous week', () => {
      const r = parseDateFormula('sow-1w', BASE);
      expect(r.success).toBe(true);
      const sowDate = BASE.startOf('week');
      expect(r.date?.format('YYYY-MM-DD')).toBe(sowDate.subtract(1, 'week').format('YYYY-MM-DD'));
    });
  });

  // ═══════════════════════════════
  // parseDateFormula — case insensitivity
  // ═══════════════════════════════
  describe('parseDateFormula — case insensitivity', () => {
    test('TODAY works', () => {
      const r = parseDateFormula('TODAY', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-07');
    });

    test('SOW works', () => {
      const r = parseDateFormula('SOW', BASE);
      expect(r.success).toBe(true);
    });

    test('Today+1W works', () => {
      const r = parseDateFormula('Today+1W', BASE);
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe('2026-02-14');
    });
  });

  // ═══════════════════════════════
  // parseDateFormula — error cases
  // ═══════════════════════════════
  describe('parseDateFormula — error cases', () => {
    test('empty string → error', () => {
      const r = parseDateFormula('', BASE);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/empty/i);
    });

    test('unknown keyword → error', () => {
      const r = parseDateFormula('nextweek', BASE);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/unknown/i);
    });

    test('invalid syntax (special chars) → error', () => {
      const r = parseDateFormula('today@1', BASE);
      expect(r.success).toBe(false);
    });

    test('without base date → uses current day', () => {
      const r = parseDateFormula('today');
      expect(r.success).toBe(true);
      expect(r.date?.format('YYYY-MM-DD')).toBe(dayjs().format('YYYY-MM-DD'));
    });
  });

  // ═══════════════════════════════
  // isDateFormula
  // ═══════════════════════════════
  describe('isDateFormula', () => {
    test.each([
      'today', 'TODAY', 'Tomorrow', 'yesterday',
      'today+1', 'today-7', 'today+1w', 'today+1m',
      'sow', 'eow', 'som', 'eom', 'soy', 'eoy',
      'sow+1w', 'eom-1d',
      'week_start', 'week_end', 'month_start', 'month_end',
      'year_start', 'year_end',
      'weekstart', 'monthstart', 'yearstart',
    ])('"%s" → true', (formula) => {
      expect(isDateFormula(formula)).toBe(true);
    });

    test.each([
      '', '2026-02-07', 'some text', 'hello+1', 'date', '123',
      'next_week', 'last_month',
    ])('"%s" → false', (formula) => {
      expect(isDateFormula(formula)).toBe(false);
    });
  });

  // ═══════════════════════════════
  // getDateFormulaSuggestions
  // ═══════════════════════════════
  describe('getDateFormulaSuggestions', () => {
    test('returns non-empty array', () => {
      const suggestions = getDateFormulaSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test('includes DQL abbreviations (sow, eow, som, eom)', () => {
      const suggestions = getDateFormulaSuggestions();
      const formulas = suggestions.map(s => s.formula);
      expect(formulas).toContain('sow');
      expect(formulas).toContain('eow');
      expect(formulas).toContain('som');
      expect(formulas).toContain('eom');
      expect(formulas).toContain('soy');
      expect(formulas).toContain('eoy');
    });

    test('includes today and relative formulas', () => {
      const suggestions = getDateFormulaSuggestions();
      const formulas = suggestions.map(s => s.formula);
      expect(formulas).toContain('today');
      expect(formulas).toContain('today+1');
      expect(formulas).toContain('today-1');
    });

    test('includes duration unit formulas', () => {
      const suggestions = getDateFormulaSuggestions();
      const formulas = suggestions.map(s => s.formula);
      expect(formulas).toContain('today+1w');
      expect(formulas).toContain('sow+1w');
      expect(formulas).toContain('som+1m');
    });

    test('each suggestion has required fields', () => {
      const suggestions = getDateFormulaSuggestions();
      suggestions.forEach(s => {
        expect(s).toHaveProperty('formula');
        expect(s).toHaveProperty('label');
        expect(s).toHaveProperty('description');
        expect(s).toHaveProperty('category');
        expect(['relative', 'week', 'month', 'year']).toContain(s.category);
      });
    });

    test('every suggested formula is parseable', () => {
      const suggestions = getDateFormulaSuggestions();
      suggestions.forEach(s => {
        const result = parseDateFormula(s.formula, BASE);
        expect(result.success).toBe(true);
      });
    });
  });

  // ═══════════════════════════════
  // testDateFormula
  // ═══════════════════════════════
  describe('testDateFormula', () => {
    test('valid formula → shows ✓ and date', () => {
      const result = testDateFormula('today');
      expect(result).toMatch(/✓/);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    test('invalid formula → shows ❌', () => {
      const result = testDateFormula('invalidformula');
      expect(result).toMatch(/❌/);
    });

    test('DQL formula sow → success', () => {
      const result = testDateFormula('sow');
      expect(result).toMatch(/✓/);
    });

    test('duration offset today+1w → success', () => {
      const result = testDateFormula('today+1w');
      expect(result).toMatch(/✓/);
    });
  });
});
