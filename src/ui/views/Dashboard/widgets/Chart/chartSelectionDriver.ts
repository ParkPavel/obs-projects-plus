/**
 * chartSelectionDriver.ts — pure helpers for ChartWidget's driver role.
 *
 * Spec: .ai_internal/New-specification/CROSS_WIDGET_SPEC.md §5 (drivers).
 * Ticket: #044.2.
 *
 * The Svelte component delegates all state-mutation decisions to these
 * helpers so the toggle logic can be unit-tested without mounting a chart.
 */

import { chartSourceId, type SelectionState } from "../../canvasSelectionStore";

// Re-export so existing callers (tests, ChartWidget) that import from this
// module keep working. Canonical definition lives in selectionStore.ts.
export { chartSourceId };

/**
 * Decide what should happen when the user clicks a chart segment.
 *
 * Toggle rule (spec §5.1): clicking the segment that already drives the
 * current selection clears it; any other click sets a new selection.
 * Empty `value` strings are ignored (no useful filter could be built).
 */
export function computeChartSelectionToggle(
	current: SelectionState,
	args: { readonly widgetId: string; readonly field: string; readonly value: string },
):
	| { readonly kind: "set"; readonly source: string; readonly field: string; readonly value: string }
	| { readonly kind: "clear" }
	| { readonly kind: "noop" } {
	if (args.value === "") return { kind: "noop" };
	if (args.field === "") return { kind: "noop" };

	const source = chartSourceId(args.widgetId);
	const isOwnActive =
		current.source === source &&
		current.field === args.field &&
		current.value === args.value;

	if (isOwnActive) return { kind: "clear" };

	return { kind: "set", source, field: args.field, value: args.value };
}

/**
 * For a given selection state, return the label this chart should visually
 * mark as "selected" — or `null` if the selection belongs to another widget
 * (or there is no selection). #044.2 is a driver-only PR: charts highlight
 * ONLY their own selection. Receiver-style dimming based on selections from
 * other widgets is deferred to later sub-PRs (#044.4/.5).
 */
export function getSelectedChartLabel(
	current: SelectionState,
	args: { readonly widgetId: string; readonly field: string },
): string | null {
	if (current.source !== chartSourceId(args.widgetId)) return null;
	if (current.field !== args.field) return null;
	return current.value;
}
