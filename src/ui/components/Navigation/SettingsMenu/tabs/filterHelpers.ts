/**
 * Filter/Sort/Color helpers for SettingsMenu tabs
 * 
 * Provides operator filtering by field type, display labels,
 * and unary operator detection for the general project filter system.
 */

import type { FilterOperator } from '../../../../../settings/base/settings';

/** Field type strings as used by DataField.type */
type FieldTypeStr = 'string' | 'number' | 'boolean' | 'date' | 'multitext' | 'unknown';

/**
 * Get available operators for a given field type.
 * Returns only operators that make sense for the field's data type.
 */
export function getOperatorsForField(fieldType: string): FilterOperator[] {
  const base: FilterOperator[] = ['is-empty', 'is-not-empty'];
  const ftype = (fieldType || 'string') as FieldTypeStr;

  switch (ftype) {
    case 'string':
      return [...base, 'is', 'is-not', 'contains', 'not-contains'];
    case 'number':
      return [...base, 'eq', 'neq', 'lt', 'gt', 'lte', 'gte'];
    case 'boolean':
      return ['is-checked', 'is-not-checked'];
    case 'date':
      return [...base, 'is-on', 'is-not-on', 'is-before', 'is-after', 'is-on-and-before', 'is-on-and-after'];
    case 'multitext':
      return [...base, 'has-any-of', 'has-all-of', 'has-none-of', 'has-keyword'];
    default:
      return [...base, 'is', 'is-not', 'contains', 'not-contains'];
  }
}

/**
 * Operator needs a value input? Returns false for unary operators.
 */
export function operatorNeedsValue(operator: FilterOperator): boolean {
  const unary: FilterOperator[] = ['is-empty', 'is-not-empty', 'is-checked', 'is-not-checked'];
  return !unary.includes(operator);
}

/**
 * Human-readable display labels for operators (Russian).
 */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  'is-empty': 'Пусто',
  'is-not-empty': 'Не пусто',
  'is': 'Равно',
  'is-not': 'Не равно',
  'contains': 'Содержит',
  'not-contains': 'Не содержит',
  'eq': '=',
  'neq': '≠',
  'lt': '<',
  'gt': '>',
  'lte': '≤',
  'gte': '≥',
  'is-checked': 'Отмечено',
  'is-not-checked': 'Не отмечено',
  'is-on': 'Дата =',
  'is-not-on': 'Дата ≠',
  'is-before': 'До',
  'is-after': 'После',
  'is-on-and-before': '≤ Дата',
  'is-on-and-after': '≥ Дата',
  'has-any-of': 'Любой из',
  'has-all-of': 'Все из',
  'has-none-of': 'Ни один из',
  'has-keyword': 'Ключевое слово',
};

/**
 * Get display label for operator
 */
export function getOperatorLabel(op: FilterOperator): string {
  return OPERATOR_LABELS[op] ?? op;
}

/**
 * Sort order display labels (Russian).
 */
export const SORT_ORDER_LABELS: Record<string, string> = {
  'asc': '↑ А–Я',
  'desc': '↓ Я–А',
};

/**
 * Get display label for sort order
 */
export function getSortOrderLabel(order: string): string {
  return SORT_ORDER_LABELS[order] ?? order;
}

/** Field type icon name (Lucide) */
export function getFieldIcon(fieldType: string): string {
  switch (fieldType) {
    case 'string': return 'type';
    case 'number': return 'hash';
    case 'boolean': return 'check-square';
    case 'date': return 'calendar';
    case 'multitext': return 'list';
    default: return 'file-text';
  }
}
