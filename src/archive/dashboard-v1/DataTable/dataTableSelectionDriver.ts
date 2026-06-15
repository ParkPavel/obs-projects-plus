/**
 * dataTableSelectionDriver.ts — pure helpers for DataTableWidget's driver role.
 *
 * Spec: .ai_internal/New-specification/CROSS_WIDGET_SPEC.md §5.2 (driver branch).
 * Ticket: #044.3b (Phase 5 sub-PR 3b — driver only; receiver was sub-PR 3a).
 *
 * v1 driver UX (NEEDS-ANALYSIS resolution 2026-05-21): the selection driver
 * is exposed via a context-menu entry on the row — NOT via row-click — so
 * the existing inline-cell-editing affordance (`<GridCell>` enters edit
 * mode on click) stays untouched. Rationale:
 *   - Zero conflict with the established left-click-to-edit / right-click-
 *     menu / shift-click-to-open conventions.
 *   - Symmetric with the existing row context menu items (Edit / Delete).
 *   - Mobile parity via long-press → row context menu.
 *   - Discoverability is acceptable for v1; if user feedback flags it as
 *     too hidden, a gutter affordance can be added in v2 on top of the
 *     same toggle helper without rewriting.
 *
 * The Svelte component delegates the toggle decision to these helpers so the
 * logic can be exhaustively unit-tested without mounting a DataTable. This
 * mirrors the pattern of `chartSelectionDriver.ts` (#044.2).
 */

import { dataTableSourceId, type SelectionState } from "src/ui/views/Dashboard/canvasSelectionStore";

// Re-export the canonical source-id builder so component code has a single
// import surface and never reaches into selectionStore for the prefix
// directly. Definition lives in selectionStore.ts (#044.3a finalization).
export { dataTableSourceId };

/**
 * Decide what should happen when the user clicks the "Filter canvas by this
 * row" context-menu entry.
 *
 * Toggle rule (spec §5.1 generalised to data-table): triggering the action
 * on the row that already drives the current selection clears it; any other
 * row sets a new selection (replacing the previous one — multi-select is v2).
 *
 * Empty `value` strings are treated as a no-op: the resulting filter would
 * either match every record (defeating the UX purpose) or none (silently
 * confusing), so we refuse to set a selection in that case.
 */
export function computeDataTableSelectionToggle(
	current: SelectionState,
	args: { readonly widgetId: string; readonly field: string; readonly value: string },
):
	| { readonly kind: "set"; readonly source: string; readonly field: string; readonly values: ReadonlyArray<string> }
	| { readonly kind: "clear" }
	| { readonly kind: "noop" } {
	if (args.value === "") return { kind: "noop" };
	if (args.field === "") return { kind: "noop" };

	const source = dataTableSourceId(args.widgetId);
	const isOwnActive =
		current.source === source &&
		current.field === args.field &&
		current.values.length === 1 &&
		current.values[0] === args.value;

	if (isOwnActive) return { kind: "clear" };

	return { kind: "set", source, field: args.field, values: [args.value] };
}

/**
 * For a given selection state, return whether this widget is currently the
 * active driver of the selection. The DataTableWidget uses this to decide
 * the context-menu entry label ("Filter canvas by this row" vs. "Clear
 * canvas filter") so the toggle direction stays obvious to the user.
 */
export function isThisWidgetDriving(
	current: SelectionState,
	widgetId: string,
): boolean {
	return current.source === dataTableSourceId(widgetId);
}
