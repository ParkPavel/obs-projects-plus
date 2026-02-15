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
import type { DataRecord, DataField } from 'src/lib/dataframe/dataframe';
import type { AgendaFilter, AgendaFilterGroup, AgendaCustomList } from 'src/settings/v3/settings';
import { parseDateFormula, isDateFormula } from 'src/lib/helpers/dateFormulaParser';
import { parseFormula, evaluateFormula } from 'src/lib/helpers/formulaParser';

// Extend dayjs with plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

/**
 * Check if value can be converted to a date
 */
function isDateLike(value: unknown): value is string | number | Date {
  if (!value) return false;
  if (value instanceof Date) return true;
  if (typeof value === 'string' || typeof value === 'number') {
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
    console.warn(`[FilterEngine] Failed to parse date formula '${value}':`, result.error);
  }
  
  return value;
}

/**
 * Strip wiki-link syntax: [[path|display]] → display, [[path]] → path
 * Handles field values stored as Obsidian wiki-links (e.g., the 'name' field).
 */
function stripWikiLink(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = value.match(/^\[\[([^\]]+)\]\]$/);
  if (!match || !match[1]) return value;
  const inner = match[1];
  // [[path|display]] → display
  const pipeIdx = inner.indexOf('|');
  return pipeIdx >= 0 ? inner.substring(pipeIdx + 1) : inner;
}

/**
 * Check if value is empty
 */
function isEmptyValue(value: unknown): boolean {
  return value === null || 
         value === undefined || 
         value === '' ||
         (Array.isArray(value) && value.length === 0);
}

/**
 * Coerce a value to number if possible (handles string→number from UI inputs).
 * Returns NaN if not a valid number.
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return NaN;
    return Number(trimmed);
  }
  return NaN;
}

/**
 * Evaluate a single filter condition against a record
 * @param record - The data record to check
 * @param filter - The filter condition
 * @param baseDate - Reference date for formula evaluation (agenda selected date)
 */
export function evaluateFilter(
  record: DataRecord,
  filter: AgendaFilter,
  baseDate: Dayjs = dayjs()
): boolean {
  const rawFieldValue = record.values[filter.field];
  // Normalize wiki-link values so [[path|display]] compares as just 'display'
  const fieldValue = stripWikiLink(rawFieldValue);
  // Resolve filter value (parse formulas relative to baseDate)
  const filterValue = resolveFilterValue(filter.value, baseDate);
  
  switch (filter.operator) {
    // ==================== BACKWARD COMPATIBILITY ====================
    // Old operators (v3.0.4) - map to new operators
    case 'equals' as any:
      return evaluateFilter(record, { ...filter, operator: 'is' }, baseDate);
    case 'not_equals' as any:
      return evaluateFilter(record, { ...filter, operator: 'is-not' }, baseDate);
    case 'is_empty' as any:
      return evaluateFilter(record, { ...filter, operator: 'is-empty' }, baseDate);
    case 'is_not_empty' as any:
      return evaluateFilter(record, { ...filter, operator: 'is-not-empty' }, baseDate);
    case 'greater_than' as any:
      return evaluateFilter(record, { ...filter, operator: 'gt' }, baseDate);
    case 'less_than' as any:
      return evaluateFilter(record, { ...filter, operator: 'lt' }, baseDate);
    case 'greater_or_equal' as any:
      return evaluateFilter(record, { ...filter, operator: 'gte' }, baseDate);
    case 'less_or_equal' as any:
      return evaluateFilter(record, { ...filter, operator: 'lte' }, baseDate);
    case 'is_today' as any:
      return evaluateFilter(record, { ...filter, operator: 'is-today' }, baseDate);
    case 'is_this_week' as any:
      return evaluateFilter(record, { ...filter, operator: 'is-this-week' }, baseDate);
    case 'is_overdue' as any:
      return evaluateFilter(record, { ...filter, operator: 'is-overdue' }, baseDate);
    case 'is_upcoming' as any:
      return evaluateFilter(record, { ...filter, operator: 'is-upcoming' }, baseDate);
    case 'not_contains' as any:
      return evaluateFilter(record, { ...filter, operator: 'not-contains' }, baseDate);
    
    // ==================== BASE OPERATORS ====================
    case 'is-empty':
      return isEmptyValue(fieldValue);
      
    case 'is-not-empty':
      return !isEmptyValue(fieldValue);
    
    // ==================== STRING OPERATORS ====================
    case 'is':
      // Date-aware equality check
      if (isDateLike(fieldValue) && isDateLike(filterValue)) {
        const date1 = dayjs(fieldValue).startOf('day');
        const date2 = dayjs(filterValue).startOf('day');
        return date1.isSame(date2, 'day');
      }
      return fieldValue === filterValue;
      
    case 'is-not':
      // Date-aware inequality check
      if (isDateLike(fieldValue) && isDateLike(filterValue)) {
        const date1 = dayjs(fieldValue).startOf('day');
        const date2 = dayjs(filterValue).startOf('day');
        return !date1.isSame(date2, 'day');
      }
      return fieldValue !== filterValue;
      
    case 'contains':
      if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
        return fieldValue.toLowerCase().includes(filterValue.toLowerCase());
      }
      if (Array.isArray(fieldValue) && filterValue) {
        return fieldValue.some(v => 
          String(v).toLowerCase().includes(String(filterValue).toLowerCase())
        );
      }
      return false;
      
    case 'not-contains':
      if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
        return !fieldValue.toLowerCase().includes(filterValue.toLowerCase());
      }
      if (Array.isArray(fieldValue) && filterValue) {
        return !fieldValue.some(v => 
          String(v).toLowerCase().includes(String(filterValue).toLowerCase())
        );
      }
      return true;
      
    case 'starts-with':
      if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
        return fieldValue.toLowerCase().startsWith(filterValue.toLowerCase());
      }
      return false;
      
    case 'ends-with':
      if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
        return fieldValue.toLowerCase().endsWith(filterValue.toLowerCase());
      }
      return false;
      
    case 'regex':
      if (typeof fieldValue === 'string' && typeof filterValue === 'string') {
        try {
          const regex = new RegExp(filterValue, 'i');
          return regex.test(fieldValue);
        } catch (error) {
          console.error('[FilterEngine] Invalid regex:', filterValue, error);
          return false;
        }
      }
      return false;
    
    // ==================== NUMBER OPERATORS ====================
    case 'eq': {
      const a = toNumber(fieldValue), b = toNumber(filterValue);
      if (!isNaN(a) && !isNaN(b)) return a === b;
      return false;
    }
      
    case 'neq': {
      const a = toNumber(fieldValue), b = toNumber(filterValue);
      if (!isNaN(a) && !isNaN(b)) return a !== b;
      return false;
    }
      
    case 'lt': {
      const a = toNumber(fieldValue), b = toNumber(filterValue);
      if (!isNaN(a) && !isNaN(b)) return a < b;
      // Date comparison
      if (isDateLike(fieldValue) && isDateLike(filterValue)) {
        return dayjs(fieldValue).isBefore(dayjs(filterValue), 'day');
      }
      return false;
    }
      
    case 'gt': {
      const a = toNumber(fieldValue), b = toNumber(filterValue);
      if (!isNaN(a) && !isNaN(b)) return a > b;
      // Date comparison
      if (isDateLike(fieldValue) && isDateLike(filterValue)) {
        return dayjs(fieldValue).isAfter(dayjs(filterValue), 'day');
      }
      return false;
    }
      
    case 'lte': {
      const a = toNumber(fieldValue), b = toNumber(filterValue);
      if (!isNaN(a) && !isNaN(b)) return a <= b;
      if (isDateLike(fieldValue) && isDateLike(filterValue)) {
        return dayjs(fieldValue).isSameOrBefore(dayjs(filterValue), 'day');
      }
      return false;
    }
      
    case 'gte': {
      const a = toNumber(fieldValue), b = toNumber(filterValue);
      if (!isNaN(a) && !isNaN(b)) return a >= b;
      if (isDateLike(fieldValue) && isDateLike(filterValue)) {
        return dayjs(fieldValue).isSameOrAfter(dayjs(filterValue), 'day');
      }
      return false;
    }
    
    // ==================== BOOLEAN OPERATORS ====================
    case 'is-checked':
      return fieldValue === true;
      
    case 'is-not-checked':
      return fieldValue !== true;
    
    // ==================== DATE OPERATORS ====================
    case 'is-on':
      if (!isDateLike(fieldValue) || !isDateLike(filterValue)) return false;
      return dayjs(fieldValue).isSame(dayjs(filterValue), 'day');
      
    case 'is-not-on':
      if (!isDateLike(fieldValue) || !isDateLike(filterValue)) return false;
      return !dayjs(fieldValue).isSame(dayjs(filterValue), 'day');
      
    case 'is-before':
      if (!isDateLike(fieldValue) || !isDateLike(filterValue)) return false;
      return dayjs(fieldValue).isBefore(dayjs(filterValue), 'day');
      
    case 'is-after':
      if (!isDateLike(fieldValue) || !isDateLike(filterValue)) return false;
      return dayjs(fieldValue).isAfter(dayjs(filterValue), 'day');
      
    case 'is-on-and-before':
      if (!isDateLike(fieldValue) || !isDateLike(filterValue)) return false;
      return dayjs(fieldValue).isSameOrBefore(dayjs(filterValue), 'day');
      
    case 'is-on-and-after':
      if (!isDateLike(fieldValue) || !isDateLike(filterValue)) return false;
      return dayjs(fieldValue).isSameOrAfter(dayjs(filterValue), 'day');
      
    case 'is-today':
      if (!isDateLike(fieldValue)) return false;
      return dayjs(fieldValue).isSame(baseDate, 'day');
      
    case 'is-this-week': {
      if (!isDateLike(fieldValue)) return false;
      const startOfWeek = baseDate.startOf('week');
      const endOfWeek = baseDate.endOf('week');
      return dayjs(fieldValue).isSameOrAfter(startOfWeek) && 
             dayjs(fieldValue).isSameOrBefore(endOfWeek);
    }
      
    case 'is-this-month':
      if (!isDateLike(fieldValue)) return false;
      return dayjs(fieldValue).isSame(baseDate, 'month');
      
    case 'is-overdue':
      if (!isDateLike(fieldValue)) return false;
      return dayjs(fieldValue).isBefore(baseDate, 'day');
      
    case 'is-upcoming':
      if (!isDateLike(fieldValue)) return false;
      return dayjs(fieldValue).isAfter(baseDate, 'day');
    
    // ==================== LIST/TAGS OPERATORS ====================
    case 'has-any-of':
      if (!Array.isArray(fieldValue) || !Array.isArray(filterValue)) return false;
      return filterValue.some(tag => fieldValue.includes(tag));
      
    case 'has-all-of':
      if (!Array.isArray(fieldValue) || !Array.isArray(filterValue)) return false;
      return filterValue.every(tag => fieldValue.includes(tag));
      
    case 'has-none-of':
      if (!Array.isArray(fieldValue) || !Array.isArray(filterValue)) return false;
      return !filterValue.some(tag => fieldValue.includes(tag));
      
    case 'has-keyword':
      if (!Array.isArray(fieldValue) || typeof filterValue !== 'string') return false;
      return fieldValue.some(v => 
        String(v).toLowerCase().includes(filterValue.toLowerCase())
      );
      
    default:
      console.warn('[FilterEngine] Unknown operator:', filter.operator);
      return false;
  }
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
export function evaluateFilterGroup(
  record: DataRecord,
  group: AgendaFilterGroup,
  baseDate: Dayjs = dayjs()
): boolean {
  // Evaluate all filters in this group (skip disabled filters)
  const filterResults = group.filters
    .filter(filter => filter.enabled !== false)
    .map(filter => evaluateFilter(record, filter, baseDate));
  
  // Evaluate all nested groups
  const groupResults = group.groups.map(nestedGroup => 
    evaluateFilterGroup(record, nestedGroup, baseDate)
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
    console.warn('[FilterEngine] Old list format detected, using backward compatibility mode');
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
        console.error(`[FilterEngine] Error evaluating formula for record:`, record, error);
        return false;
      }
    });
  } catch (error) {
    console.error(`[FilterEngine] Error parsing formula:`, formula, error);
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
