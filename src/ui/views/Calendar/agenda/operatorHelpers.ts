/**
 * Operator Helpers (v3.1.0)
 * 
 * Helper functions for working with filter operators:
 * - Get available operators for field types
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
        'is-this-quarter',
        'is-this-year',
        'is-past-week',
        'is-past-month',
        'is-past-year',
        'is-next-week',
        'is-next-month',
        'is-next-year',
        'is-last-n-days',
        'is-next-n-days',
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

    // Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5a — Select/Status/
    // Relation/Formula/Rollup operator sets reuse the existing
    // AgendaFilterOperator vocabulary; no new operator literals are added in
    // Stage A (that is Stage B work — full Field-Types UI).
    case DataFieldType.Select:
    case DataFieldType.Status:
      return [
        ...base,
        'is',
        'is-not',
      ];

    case DataFieldType.Relation:
      return [
        ...base,
        'is',
        'is-not',
        'contains',
        'not-contains',
      ];

    case DataFieldType.Formula:
      // Formula values surface as their computed runtime type (string / number
      // / boolean / date). Until Stage B specialises this further, expose the
      // text-style operators that work on stringified output.
      return [
        ...base,
        'is',
        'is-not',
        'contains',
        'not-contains',
      ];

    case DataFieldType.Rollup:
      // Rollup values are most commonly numeric (sum, count, avg). Stage A
      // exposes numeric operators; non-numeric rollup output (e.g. concat)
      // can still be matched by `is`/`is-not`.
      return [
        ...base,
        'is',
        'is-not',
        'eq',
        'neq',
        'lt',
        'gt',
        'lte',
        'gte',
      ];

    default:
      return base;
  }
}
