/**
 * Operator Helpers (v3.1.0)
 * 
 * Helper functions for working with filter operators:
 * - Get available operators for field types
 * - Determine if operator needs a value
 * - Check if operator accepts multiple values
 */

import { DataFieldType } from 'src/lib/dataframe/dataframe';
import type { AgendaFilterOperator } from 'src/settings/v3/settings';

/**
 * Get available operators for a specific field type
 */
export function getOperatorsForFieldType(
  fieldType: DataFieldType
): AgendaFilterOperator[] {
  const base: AgendaFilterOperator[] = ['is-empty', 'is-not-empty'];
  
  switch (fieldType) {
    case DataFieldType.String:
      return [
        ...base,
        'is',
        'is-not',
        'contains',
        'not-contains',
        'starts-with',
        'ends-with',
        'regex',
      ];
      
    case DataFieldType.Number:
      return [
        ...base,
        'eq',
        'neq',
        'lt',
        'gt',
        'lte',
        'gte',
      ];
      
    case DataFieldType.Boolean:
      return [
        'is-checked',
        'is-not-checked',
      ];
      
    case DataFieldType.Date:
      return [
        ...base,
        'is-on',
        'is-not-on',
        'is-before',
        'is-after',
        'is-on-and-before',
        'is-on-and-after',
        'is-today',
        'is-this-week',
        'is-this-month',
        'is-overdue',
        'is-upcoming',
      ];
      
    case DataFieldType.List:
      return [
        ...base,
        'has-any-of',
        'has-all-of',
        'has-none-of',
        'has-keyword',
      ];
      
    default:
      return base;
  }
}

/**
 * Check if operator needs a value input
 * Some operators are unary (e.g., is-empty, is-today) and don't need a value
 */
export function operatorNeedsValue(operator: AgendaFilterOperator): boolean {
  const unaryOps: AgendaFilterOperator[] = [
    'is-empty',
    'is-not-empty',
    'is-checked',
    'is-not-checked',
    'is-today',
    'is-this-week',
    'is-this-month',
    'is-overdue',
    'is-upcoming',
  ];
  
  return !unaryOps.includes(operator);
}

/**
 * Check if operator works with multiple values (for tags/lists)
 */
export function operatorIsMultiValue(operator: AgendaFilterOperator): boolean {
  return ['has-any-of', 'has-all-of', 'has-none-of'].includes(operator);
}

/**
 * Check if operator is for date fields
 */
export function operatorIsDateOperator(operator: AgendaFilterOperator): boolean {
  const dateOps: AgendaFilterOperator[] = [
    'is-on',
    'is-not-on',
    'is-before',
    'is-after',
    'is-on-and-before',
    'is-on-and-after',
    'is-today',
    'is-this-week',
    'is-this-month',
    'is-overdue',
    'is-upcoming',
  ];
  
  return dateOps.includes(operator);
}

/**
 * Get operator display name (for i18n key)
 */
export function getOperatorI18nKey(operator: AgendaFilterOperator): string {
  return `views.calendar.agenda.custom.filter-editor.operators.${operator}`;
}

/**
 * Get operator description (for tooltips)
 */
export function getOperatorDescription(operator: AgendaFilterOperator): string {
  const descriptions: Record<AgendaFilterOperator, string> = {
    'is-empty': 'Field has no value',
    'is-not-empty': 'Field has a value',
    'is': 'Exact match',
    'is-not': 'Does not match',
    'contains': 'Contains text',
    'not-contains': 'Does not contain text',
    'starts-with': 'Starts with text',
    'ends-with': 'Ends with text',
    'regex': 'Matches regular expression',
    'eq': 'Equal to',
    'neq': 'Not equal to',
    'lt': 'Less than',
    'gt': 'Greater than',
    'lte': 'Less than or equal to',
    'gte': 'Greater than or equal to',
    'is-checked': 'Checkbox is checked',
    'is-not-checked': 'Checkbox is not checked',
    'is-on': 'Date is exactly',
    'is-not-on': 'Date is not',
    'is-before': 'Date is before',
    'is-after': 'Date is after',
    'is-on-and-before': 'Date is on or before',
    'is-on-and-after': 'Date is on or after',
    'is-today': 'Date is today (relative to selected date)',
    'is-this-week': 'Date is this week',
    'is-this-month': 'Date is this month',
    'is-overdue': 'Date is in the past',
    'is-upcoming': 'Date is in the future',
    'has-any-of': 'Has at least one of these tags',
    'has-all-of': 'Has all of these tags',
    'has-none-of': 'Has none of these tags',
    'has-keyword': 'Contains keyword in tags',
  };
  
  return descriptions[operator] || '';
}
