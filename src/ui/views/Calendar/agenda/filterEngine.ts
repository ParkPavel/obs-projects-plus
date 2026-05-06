/**
 * Agenda Filter Engine (v3.1.0)
 * 
 * Evaluates AgendaFilter conditions against DataRecords
 * to determine which records belong to custom agenda lists.
 * 
 * IMPORTANT: Formulas like 'today', 'week_start' are evaluated
 * relative to the agenda's selected date, NOT the current date.
 * 
 * FEATURES v3.1.0:
 * - Comprehensive operator set (42 operators)
 * - Support for filter groups with nesting
 * - Both visual and advanced (formula) modes
 * - Backward compatibility with old operators
 */

import dayjs, { Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import type { DataRecord, DataField, DataValue } from 'src/lib/dataframe/dataframe';
import type { AgendaFilter, AgendaFilterGroup, AgendaCustomList } from 'src/settings/v3/settings';
import type { FilterOperator } from 'src/settings/base/settings';
import { isDateFilterOperator } from 'src/settings/base/settings';
import { parseDateFormula, isDateFormula } from 'src/lib/formula';
import { parseFormula, evaluateFormula } from 'src/lib/formula';
import { matchesCondition } from 'src/lib/engine/filterEvaluator';
import { calendarLogger } from '../logger';
import { stripToDisplay as kernelStripToDisplay } from 'src/lib/engine/wikilink';

/**
 * Legacy operator names from v3.0.4, preserved for backward-compat
 * deserialisation of saved filter settings. Not part of the public API.
 * @internal
 */
type LegacyFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'is_today'
  | 'is_this_week'
  | 'is_overdue'
  | 'is_upcoming'
  | 'not_contains';

/** @internal Union of current and legacy filter shapes used for recursive dispatch. */
type AnyAgendaFilter =
  | AgendaFilter
  | (Omit<AgendaFilter, 'operator'> & { readonly operator: LegacyFilterOperator });

// Extend dayjs with plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

/**
 * Check if value can be converted to a date
 */
function isDateLike(value: unknown): value is string | Date {
  if (!value) return false;
  if (value instanceof Date) return true;
  // v4.0.5: Reject numbers — dayjs(0) is "valid" (1970-01-01) but semantically wrong
  if (typeof value === 'string') {
    return dayjs(value).isValid();
  }
  return false;
}

/**
 * Resolve a filter value - parse date formulas relative to baseDate
 * @param value - The filter value (may be a formula like 'today')
 * @param baseDate - The reference date for formula evaluation (agenda selected date)
 */
function resolveFilterValue(
  value: string | number | boolean | string[] | null | undefined,
  baseDate: Dayjs
): string | number | boolean | string[] | null | undefined {
  // Only process string values that might be formulas
  if (typeof value !== 'string') return value;
  
  // Check if it's a date formula
  if (isDateFormula(value)) {
    const result = parseDateFormula(value, baseDate);
    if (result.success && result.date) {
      // Return ISO format for comparison
      return result.date.format('YYYY-MM-DD');
    }
    // If formula parsing fails, return original value
    calendarLogger.warn(`[FilterEngine] Failed to parse date formula '${value}': ${result.error}`);
  }
  
  return value;
}

/**
 * Strip wiki-link syntax: [[path|display]] → display, [[path]] → path
 * Handles field values stored as Obsidian wiki-links (e.g., the 'name' field).
 *
 * REFACTOR-105: thin wrapper over canonical `stripToDisplay` kernel,
 * preserving the original `unknown`-passthrough behaviour for non-string
 * inputs.
 */
function stripWikiLink(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return kernelStripToDisplay(value);
}

/** Coerce an AgendaFilter value to the string expected by FilterCondition. */
function agendaValueToConditionString(
  value: string | number | boolean | string[] | null | undefined
): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  return undefined;
}

/**
 * Legacy operator names → current canonical operator names.
 * @internal
 */
const LEGACY_OP_MAP: Partial<Record<string, FilterOperator>> = {
  equals:          'is',
  not_equals:      'is-not',
  is_empty:        'is-empty',
  is_not_empty:    'is-not-empty',
  greater_than:    'gt',
  less_than:       'lt',
  greater_or_equal:'gte',
  less_or_equal:   'lte',
  is_today:        'is-today',
  is_this_week:    'is-this-week',
  is_overdue:      'is-overdue',
  is_upcoming:     'is-upcoming',
  not_contains:    'not-contains',
};

/**
 * Evaluate a single filter condition against a record
 * @param record - The data record to check
 * @param filter - The filter condition
 * @param baseDate - Reference date for formula evaluation (agenda selected date)
 */
export function evaluateFilter(
  record: DataRecord,
  filter: AnyAgendaFilter,
  baseDate: Dayjs = dayjs()
): boolean {
  // ── Legacy operator normalisation ────────────────────────────────────
  const mappedOp: string = LEGACY_OP_MAP[filter.operator] ?? filter.operator;

  const rawFieldValue = record.values[filter.field];
  // Normalize wiki-link values so [[path|display]] compares as just 'display'
  const fieldValue = stripWikiLink(rawFieldValue);
  // Resolve filter value (parse formulas relative to baseDate)
  const resolvedValue = resolveFilterValue(filter.value, baseDate);

  // ── regex — only in AgendaFilterOperator, must stay inline ───────────
  if (mappedOp === 'regex') {
    if (typeof fieldValue === 'string' && typeof resolvedValue === 'string') {
      if (resolvedValue.length > 200) {
        calendarLogger.error('[FilterEngine] Regex too long (>' + 200 + ' chars), skipping');
        return false;
      }
      if (/\(\?[<!=]/.test(resolvedValue)) return false;
      if (/(\+|\*|\{[^}]*\})\s*(\+|\*|\{)/.test(resolvedValue)) return false;
      if (/\([^)]*(\+|\*|\{[^}]*\})\)\s*(\+|\*|\{)/.test(resolvedValue)) return false;
      try {
        return new RegExp(resolvedValue, 'i').test(fieldValue.slice(0, 10000));
      } catch (error) {
        calendarLogger.error('[FilterEngine] Invalid regex: ' + resolvedValue, error);
        return false;
      }
    }
    return false;
  }

  // ── Date-aware 'is' / 'is-not': compare as dates when both sides are date-like ──
  if (mappedOp === 'is' || mappedOp === 'is-not') {
    if (isDateLike(fieldValue) && isDateLike(resolvedValue)) {
      const d1 = dayjs(fieldValue).startOf('day');
      const d2 = dayjs(resolvedValue as string).startOf('day');
      return mappedOp === 'is' ? d1.isSame(d2, 'day') : !d1.isSame(d2, 'day');
    }
    // Fall through to string delegation below
  }

  // ── Date-aware lt / gt / lte / gte ──────────────────────────────────
  if (mappedOp === 'lt' || mappedOp === 'gt' || mappedOp === 'lte' || mappedOp === 'gte') {
    if (isDateLike(fieldValue) && isDateLike(resolvedValue)) {
      const fd = dayjs(fieldValue), rv = dayjs(resolvedValue as string);
      if (mappedOp === 'lt')  return fd.isBefore(rv, 'day');
      if (mappedOp === 'gt')  return fd.isAfter(rv, 'day');
      if (mappedOp === 'lte') return fd.isSameOrBefore(rv, 'day');
      if (mappedOp === 'gte') return fd.isSameOrAfter(rv, 'day');
    }
    // Fall through to number delegation below
  }

  // ── is-this-week: locale week (startOf/endOf) vs ISO isoWeek in filterEvaluator ──
  if (mappedOp === 'is-this-week') {
    if (!isDateLike(fieldValue)) return false;
    const startOfWeek = baseDate.startOf('week');
    const endOfWeek = baseDate.endOf('week');
    return dayjs(fieldValue).isSameOrAfter(startOfWeek) &&
           dayjs(fieldValue).isSameOrBefore(endOfWeek);
  }

  // ── is-upcoming: Calendar semantics = strictly after baseDate (today excluded) ──
  if (mappedOp === 'is-upcoming') {
    if (!isDateLike(fieldValue)) return false;
    return dayjs(fieldValue).isAfter(baseDate, 'day');
  }

  // ── Delegate to canonical matchesCondition ───────────────────────────
  // Build a stripped record so matchesCondition reads the wiki-link–normalised value.
  // For date operators: Calendar stores dates as strings; convert to Date so
  // isOptionalDate() type-guard in matchesCondition routes correctly.
  let delegateFieldValue: DataValue | undefined = fieldValue as DataValue | undefined;
  if (isDateFilterOperator(mappedOp as FilterOperator) && isDateLike(fieldValue)) {
    delegateFieldValue = dayjs(fieldValue).toDate();
  }

  const strippedRecord: DataRecord = delegateFieldValue !== rawFieldValue
    ? { ...record, values: { ...record.values, [filter.field]: delegateFieldValue as DataValue } }
    : record;

  // Resolved value (formula already expanded) → string for FilterCondition.value
  const condValue = agendaValueToConditionString(resolvedValue);

  return matchesCondition(
    {
      field: filter.field,
      operator: mappedOp as FilterOperator,
      value: condValue,
      enabled: true,
    },
    strippedRecord,
    baseDate
  );
}

/**
 * Evaluate all filters in a list against a record
 * DEPRECATED: Use evaluateFilterGroup instead
 * @param record - The data record to check
 * @param filters - Array of filter conditions
 * @param baseDate - Reference date for formula evaluation (agenda selected date)
 */
export function evaluateFilters(
  record: DataRecord,
  filters: AgendaFilter[],
  baseDate: Dayjs = dayjs()
): boolean {
  if (filters.length === 0) {
    return true; // No filters = match all
  }
  
  // Backward compatibility: assume AND conjunction
  return filters.every(filter => evaluateFilter(record, filter, baseDate));
}

/**
 * Evaluate a filter group (with nested groups and filters)
 * @param record - The data record to check
 * @param group - Filter group with conjunction
 * @param baseDate - Reference date for formula evaluation
 */
const MAX_FILTER_DEPTH = 20;

export function evaluateFilterGroup(
  record: DataRecord,
  group: AgendaFilterGroup,
  baseDate: Dayjs = dayjs(),
  _depth = 0
): boolean {
  if (_depth >= MAX_FILTER_DEPTH) return true; // safety: prevent infinite recursion

  // Evaluate all filters in this group (skip disabled filters)
  const filterResults = group.filters
    .filter(filter => filter.enabled !== false)
    .map(filter => evaluateFilter(record, filter, baseDate));
  
  // Evaluate all nested groups
  const groupResults = group.groups.map(nestedGroup => 
    evaluateFilterGroup(record, nestedGroup, baseDate, _depth + 1)
  );
  
  // Combine all results
  const allResults = [...filterResults, ...groupResults];
  
  if (allResults.length === 0) {
    return true; // Empty group = match all
  }
  
  // Apply conjunction
  if (group.conjunction === 'AND') {
    return allResults.every(result => result);
  } else {
    return allResults.some(result => result);
  }
}

/**
 * Filter records for a custom agenda list (UNIFIED)
 * Supports both visual (filterGroup) and advanced (formula) modes
 * 
 * @param records - All records to filter
 * @param list - Custom list definition with filters
 * @param baseDate - Reference date for formula evaluation (agenda selected date)
 * @param fields - Field definitions (required for advanced mode)
 * @returns Filtered records
 */
export function filterRecordsForList(
  records: DataRecord[],
  list: AgendaCustomList,
  baseDate: Dayjs = dayjs(),
  fields: DataField[] = []
): DataRecord[] {
  // Advanced mode - use formula
  if (list.filterMode === 'advanced' && list.filterFormula) {
    return filterByFormula(records, list.filterFormula, baseDate, fields);
  }
  
  // Visual mode - use filter group
  if (list.filterMode === 'visual' && list.filterGroup) {
    return filterByGroup(records, list.filterGroup, baseDate);
  }
  
  // Backward compatibility - old lists with filters array (v3.0.x format)
   
  if ('filters' in list && Array.isArray((list as any).filters)) {
    calendarLogger.warn('[FilterEngine] Old list format detected, using backward compatibility mode');
    return records.filter(record => 
       
      evaluateFilters(record, (list as any).filters, baseDate)
    );
  }
  
  // No filters = show all
  return records;
}

/**
 * Filter by formula (advanced mode)
 */
function filterByFormula(
  records: DataRecord[],
  formula: string,
  baseDate: Dayjs,
  fields: DataField[]
): DataRecord[] {
  try {
    const ast = parseFormula(formula);
    return records.filter(record => {
      try {
        return evaluateFormula(ast, record, baseDate.toDate());
      } catch (error) {
        calendarLogger.error(`[FilterEngine] Error evaluating formula for record: ${record?.id ?? 'unknown'}`, error);
        return false;
      }
    });
  } catch (error) {
    calendarLogger.error(`[FilterEngine] Error parsing formula: ${formula}`, error);
    return [];
  }
}

/**
 * Filter by filter group (visual mode)
 * @internal
 */
function filterByGroup(
  records: DataRecord[],
  group: AgendaFilterGroup,
  baseDate: Dayjs
): DataRecord[] {
  return records.filter(record => evaluateFilterGroup(record, group, baseDate));
}

/**
 * BACKWARD COMPATIBILITY WRAPPER
 * For old components that still use filters array
 */
export function filterRecordsForListLegacy(
  records: DataRecord[],
  filters: AgendaFilter[],
  baseDate: Dayjs = dayjs()
): DataRecord[] {
  return records.filter(record => evaluateFilters(record, filters, baseDate));
}
