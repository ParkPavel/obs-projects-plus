/**
 * Date Formula Parser for Agenda Filters
 * 
 * DQL-compatible date formulas with simplified syntax.
 * Supports both Dataview-style abbreviations and human-readable keywords.
 * 
 * === DQL-ALIGNED SYNTAX ===
 * 
 * Base keywords (case-insensitive):
 *   today / now        — Current day (00:00)
 *   tomorrow           — Next day
 *   yesterday          — Previous day
 *   sow / week_start   — Start of week (Monday)
 *   eow / week_end     — End of week (Sunday)
 *   som / month_start  — First day of month
 *   eom / month_end    — Last day of month
 *   soy / year_start   — January 1st
 *   eoy / year_end     — December 31st
 * 
 * Offset syntax:
 *   <keyword>+N  or  <keyword>-N     — offset by N days (default)
 *   <keyword>+Nd or  <keyword>-Nd    — offset by N days
 *   <keyword>+Nw or  <keyword>-Nw    — offset by N weeks
 *   <keyword>+Nm or  <keyword>-Nm    — offset by N months
 *   <keyword>+Ny or  <keyword>-Ny    — offset by N years
 * 
 * Examples:
 *   today+7    → 7 days from now
 *   sow-1w     → Start of last week
 *   eom+1d     → Day after end of month
 *   som+1m     → Start of next month
 *   today+1y   → Same day next year
 * 
 * @module dateFormulaParser
 */

import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekOfYear);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export interface DateFormulaResult {
  success: boolean;
  date?: Dayjs;
  error?: string;
}

export interface DateFormulaSuggestion {
  formula: string;
  label: string;
  description: string;
  category: 'relative' | 'week' | 'month' | 'year';
}

/** Duration unit for offsets */
type DurationUnit = 'day' | 'week' | 'month' | 'year';

/** Maps unit suffix to dayjs ManipulateType */
function parseDurationUnit(suffix: string | undefined): DurationUnit {
  if (!suffix) return 'day';
  switch (suffix.toLowerCase()) {
    case 'd': return 'day';
    case 'w': return 'week';
    case 'm': return 'month';
    case 'y': return 'year';
    default: return 'day';
  }
}

/**
 * All recognized keywords mapped to their canonical names.
 * Supports both DQL abbreviations (sow, eow, som, eom, soy, eoy)
 * and human-readable names (week_start, month_end, etc.)
 */
const KEYWORD_ALIASES: Record<string, string> = {
  // Relative
  'today': 'today',
  'now': 'today',
  'tomorrow': 'tomorrow',
  'yesterday': 'yesterday',
  // Week — DQL style
  'sow': 'week_start',
  'eow': 'week_end',
  // Week — verbose style
  'week_start': 'week_start',
  'weekstart': 'week_start',
  'week_end': 'week_end',
  'weekend': 'week_end',
  // Month — DQL style
  'som': 'month_start',
  'eom': 'month_end',
  // Month — verbose style
  'month_start': 'month_start',
  'monthstart': 'month_start',
  'month_end': 'month_end',
  'monthend': 'month_end',
  // Year — DQL style
  'soy': 'year_start',
  'eoy': 'year_end',
  // Year — verbose style
  'year_start': 'year_start',
  'yearstart': 'year_start',
  'year_end': 'year_end',
  'yearend': 'year_end',
};

const ALL_KEYWORDS = Object.keys(KEYWORD_ALIASES);

/**
 * Parse a date formula string and return a dayjs date.
 * 
 * Offset regex: keyword followed by optional +/-N and optional unit suffix (d/w/m/y).
 * Examples: "today", "today+7", "sow-1w", "eom+1m"
 */
export function parseDateFormula(formula: string, baseDate?: Dayjs): DateFormulaResult {
  const base = baseDate ?? dayjs();
  const trimmed = formula.trim().toLowerCase();
  
  if (!trimmed) {
    return { success: false, error: 'Empty formula' };
  }
  
  // Match: keyword + optional offset (+/-N) + optional unit (d/w/m/y)
  const offsetMatch = trimmed.match(/^([a-z_]+)(?:([\+\-])(\d+)([dwmy])?)?$/);
  
  if (!offsetMatch) {
    return { success: false, error: `Invalid formula syntax: ${formula}` };
  }
  
  const [, rawKeyword = '', sign, amountStr, unitSuffix] = offsetMatch;
  
  // Resolve keyword alias
  const canonical = KEYWORD_ALIASES[rawKeyword];
  if (!canonical) {
    const supported = 'today, tomorrow, yesterday, sow, eow, som, eom, soy, eoy';
    return { success: false, error: `Unknown keyword: "${rawKeyword}". Supported: ${supported}` };
  }
  
  const amount = amountStr ? parseInt(amountStr, 10) * (sign === '-' ? -1 : 1) : 0;
  const unit = parseDurationUnit(unitSuffix);
  
  let result: Dayjs;
  
  try {
    switch (canonical) {
      case 'today':
        result = base.startOf('day');
        break;
      case 'tomorrow':
        result = base.add(1, 'day').startOf('day');
        break;
      case 'yesterday':
        result = base.subtract(1, 'day').startOf('day');
        break;
      case 'week_start':
        result = base.startOf('week');
        break;
      case 'week_end':
        result = base.endOf('week');
        break;
      case 'month_start':
        result = base.startOf('month');
        break;
      case 'month_end':
        result = base.endOf('month');
        break;
      case 'year_start':
        result = base.startOf('year');
        break;
      case 'year_end':
        result = base.endOf('year');
        break;
      default:
        return { success: false, error: `Internal error: unmapped canonical "${canonical}"` };
    }
    
    // Apply offset with proper unit
    if (amount !== 0) {
      result = result.add(amount, unit);
    }
    
    return { success: true, date: result };
  } catch (error) {
    return { 
      success: false, 
      error: `Parse error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Check if a string looks like a date formula
 */
export function isDateFormula(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return ALL_KEYWORDS.some(keyword => 
    trimmed === keyword || 
    trimmed.startsWith(keyword + '+') || 
    trimmed.startsWith(keyword + '-')
  );
}

/**
 * Get date formula suggestions — DQL-aligned, simplified.
 * Shows preferred short syntax with DQL abbreviations.
 */
export function getDateFormulaSuggestions(): DateFormulaSuggestion[] {
  return [
    // ── Relative ──
    {
      formula: 'today',
      label: 'Сегодня',
      description: 'Today',
      category: 'relative'
    },
    {
      formula: 'today+1',
      label: 'Завтра',
      description: 'Tomorrow (+1 day)',
      category: 'relative'
    },
    {
      formula: 'today-1',
      label: 'Вчера',
      description: 'Yesterday (−1 day)',
      category: 'relative'
    },
    {
      formula: 'today+1w',
      label: 'Через неделю',
      description: '+1 week from today',
      category: 'relative'
    },
    {
      formula: 'today-1w',
      label: 'Неделю назад',
      description: '−1 week from today',
      category: 'relative'
    },
    // ── Week (DQL: sow / eow) ──
    {
      formula: 'sow',
      label: 'Начало недели',
      description: 'Start of week (Monday)',
      category: 'week'
    },
    {
      formula: 'eow',
      label: 'Конец недели',
      description: 'End of week (Sunday)',
      category: 'week'
    },
    {
      formula: 'sow+1w',
      label: 'Начало след. недели',
      description: 'Next week start',
      category: 'week'
    },
    {
      formula: 'sow-1w',
      label: 'Начало прошл. недели',
      description: 'Previous week start',
      category: 'week'
    },
    // ── Month (DQL: som / eom) ──
    {
      formula: 'som',
      label: 'Начало месяца',
      description: 'Start of month',
      category: 'month'
    },
    {
      formula: 'eom',
      label: 'Конец месяца',
      description: 'End of month',
      category: 'month'
    },
    {
      formula: 'som+1m',
      label: 'Начало след. месяца',
      description: 'Next month start',
      category: 'month'
    },
    {
      formula: 'som-1m',
      label: 'Начало прошл. месяца',
      description: 'Previous month start',
      category: 'month'
    },
    // ── Year (DQL: soy / eoy) ──
    {
      formula: 'soy',
      label: 'Начало года',
      description: 'Start of year (Jan 1)',
      category: 'year'
    },
    {
      formula: 'eoy',
      label: 'Конец года',
      description: 'End of year (Dec 31)',
      category: 'year'
    },
  ];
}

/**
 * Test a date formula and return formatted result
 */
export function testDateFormula(formula: string): string {
  const result = parseDateFormula(formula);
  
  if (!result.success) {
    return `❌ ${result.error}`;
  }
  
  return `✓ ${result.date?.format('YYYY-MM-DD')} (${result.date?.format('dd, D MMM YYYY')})`;
}
