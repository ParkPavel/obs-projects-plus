/**
 * statsSelectionReceiver.ts — pure helpers for StatsWidget's receiver role.
 *
 * Spec: .ai_internal/New-specification/CROSS_WIDGET_SPEC.md §4, §5.3.
 * Ticket: #044.4 (Phase 5 sub-PR 4 — receiver only; Stats as driver is v2).
 *
 * Given the canvas-level selection and the widget's source records (already
 * filtered by user filters via the dashboard pipeline), narrow the record set
 * so `computeAggregateValue()` re-runs over the selection-restricted cohort.
 *
 * Visual semantics (spec §5.3):
 *   - Aggregates are recomputed over `effectiveFilter`-filtered records.
 *   - A small "filtered" dot indicator appears next to the value when a
 *     selection is actively narrowing this widget's data.
 *   - No driver role in v1 — clicking a stat card is not a drill-down trigger
 *     (deferred to v2 per spec §9, Q4).
 */

import type { DataRecord } from "src/lib/dataframe/dataframe";
import { dataTableSourceId, chartSourceId, type SelectionState } from "../../FreeCanvas/selectionStore";

/**
 * Stable source-id prefix reserved for a future Stats driver (v2 drill-down).
 * Defined now so the self-skip rule below already covers the eventual driver
 * case and we never accidentally feed a Stats-emitted selection back into the
 * same Stats widget once driver support lands.
 */
export function statsSourceId(widgetId: string): string {
	return `stats:${widgetId}`;
}

/**
 * Return `true` if the active selection should narrow this widget's data.
 *
 * "Active" means: the selection exists AND was emitted by a sibling widget
 * (not this Stats widget itself). The dot indicator should render exactly
 * when this returns `true`.
 *
 * NB: this does not check whether the selection actually MATCHES any of this
 * widget's records — a "selection that filters everything out" is still
 * conceptually active and should show the indicator (and a zero/empty value).
 */
export function isSelectionActive(selection: SelectionState, myWidgetId: string): boolean {
	if (selection.source === null) return false;
	if (selection.source === statsSourceId(myWidgetId)) return false;
	return true;
}

/**
 * Filter records by the current selection.
 *
 * Returns the input array reference unchanged when:
 *   - the selection is empty (`source === null`), OR
 *   - the selection was emitted by this Stats widget (self-skip; future-proof
 *     for v2 driver — selectionStore.ts already centralises `statsSourceId`
 *     by re-export, but the literal check below is sufficient).
 *
 * Otherwise returns a new array containing only records whose `selection.field`
 * value (or any element of an array-typed cell) equals `selection.value` after
 * string coercion. Match semantics match `dataTableSelectionReceiver.ts` so
 * highlighted DataTable rows and recomputed Stats aggregates agree on which
 * records "belong" to the selection.
 */
export function filterRecordsBySelection(args: {
	readonly records: readonly DataRecord[];
	readonly selection: SelectionState;
	readonly myWidgetId: string;
}): readonly DataRecord[] {
	const { records, selection, myWidgetId } = args;

	if (
		selection.source === null ||
		selection.field === null ||
		selection.value === null
	) {
		return records;
	}

	if (selection.source === statsSourceId(myWidgetId)) {
		return records;
	}

	// Local match — kept duplicated with dataTableSelectionReceiver's check to
	// avoid coupling the two receivers through a third helper module. Both
	// receivers MUST agree on semantics: array-typed cells match if any element
	// equals the selection value, scalars match on string equality, null/undef
	// never match. If a third receiver adds a different rule, extract then.
	const field = selection.field;
	const value = selection.value;
	return records.filter((record) => {
		const cell = record.values[field];
		if (cell === null || cell === undefined) return false;
		if (Array.isArray(cell)) {
			return cell.some((item) => item != null && String(item) === value);
		}
		return String(cell) === value;
	});
}

// Re-exports so consumers that already touch this file have one import surface
// for the source-id builders. The `chartSourceId` re-export is incidental —
// Stats doesn't drive — but mirroring the data-table helper's pattern keeps
// downstream refactors predictable.
export { dataTableSourceId, chartSourceId };
