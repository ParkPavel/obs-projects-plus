/**
 * Field Suggestions Collector (v3.1.0)
 * 
 * Collects unique values from records for autocomplete in filter inputs.
 * Similar to the fieldSuggestions mechanism in EditNote.svelte.
 */

import { DataFieldType, type DataRecord, type DataField } from 'src/lib/dataframe/dataframe';
import dayjs from 'dayjs';

/**
 * Check if value is date-like
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
 * Collect unique values from all records for a specific field
 * Returns suggestions for autocomplete, only if there are at least 2 unique values
 * 
 * @param records - All available records
 * @param fieldName - Name of the field to collect values for
 * @param fieldType - Type of the field
 * @returns Array of unique string values for suggestions
 */
export function collectFieldSuggestions(
  records: DataRecord[],
  fieldName: string,
  fieldType: DataFieldType
): string[] {
  const uniqueValues = new Set<string>();
  
  records.forEach(record => {
    const val = record.values[fieldName];
    
    // String fields
    if (fieldType === DataFieldType.String && typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed) {
        uniqueValues.add(trimmed);
      }
    }
    
    // Number fields
    if (fieldType === DataFieldType.Number && typeof val === 'number') {
      uniqueValues.add(String(val));
    }
    
    // Date fields - suggest common formats
    if (fieldType === DataFieldType.Date && isDateLike(val)) {
      const formatted = dayjs(val).format('YYYY-MM-DD');
      uniqueValues.add(formatted);
    }
    
    // List fields - add individual items
    if (fieldType === DataFieldType.List && Array.isArray(val)) {
      val.forEach(item => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (trimmed) {
            uniqueValues.add(trimmed);
          }
        }
      });
    }
    
    // Boolean fields - suggest true/false
    if (fieldType === DataFieldType.Boolean && typeof val === 'boolean') {
      uniqueValues.add(String(val));
    }
  });
  
  // Only return suggestions if we have at least 2 unique values
  // This avoids showing suggestions for fields that are mostly the same
  return uniqueValues.size >= 2 
    ? Array.from(uniqueValues).sort() 
    : [];
}

/**
 * Collect suggestions for all fields at once
 * Returns a map of field name → suggestions array
 * 
 * @param records - All available records
 * @param fields - Field definitions
 * @returns Map of field name to suggestions
 */
export function collectAllFieldSuggestions(
  records: DataRecord[],
  fields: DataField[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  
  fields.forEach(field => {
    // Skip fields that already have configured options
    if (field.typeConfig?.options?.length) {
      // Use configured options instead of collecting from data
      result[field.name] = field.typeConfig.options;
      return;
    }
    
    // Skip repeated fields (they use TagList which has its own logic)
    if (field.repeated) {
      return;
    }
    
    // Collect suggestions from data
    const suggestions = collectFieldSuggestions(records, field.name, field.type);
    if (suggestions.length > 0) {
      result[field.name] = suggestions;
    }
  });
  
  return result;
}

/**
 * Get suggestions for a specific field, combining configured options and data values
 * 
 * @param records - All available records
 * @param field - Field definition
 * @returns Array of suggestions
 */
export function getSuggestionsForField(
  records: DataRecord[],
  field: DataField
): string[] {
  // If field has configured options, use them
  if (field.typeConfig?.options?.length) {
    return field.typeConfig.options;
  }
  
  // Otherwise collect from data
  return collectFieldSuggestions(records, field.name, field.type);
}
