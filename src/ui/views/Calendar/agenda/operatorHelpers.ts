/**
 * Operators for an agenda filter by field type.
 *
 * w4-filters (N11): the agenda kept its own operator catalog beside the view
 * filter's; there is one now (`filterHelpers.getOperatorsForField`), and this
 * name is kept for the agenda's callers.
 */
import type { DataFieldType } from "src/lib/dataframe/dataframe";
import type { FilterOperator } from "src/settings/base/settings";
import { getOperatorsForField } from "src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers";

export function getOperatorsForFieldType(fieldType: DataFieldType): FilterOperator[] {
  return getOperatorsForField(fieldType);
}
