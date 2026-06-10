/**
 * selectionStore.ts — Per-canvas writable store for cross-widget selection.
 *
 * Spec: .ai_internal/New-specification/CROSS_WIDGET_SPEC.md §2, §3, §4, §8.
 * Ticket: #044.1 (Phase 5 sub-PR 1).
 *
 * One *selection* is a transient filter created when a user clicks a
 * data-bearing element on a driver widget (a Chart bar/slice, a DataTable
 * row). The selection lives in a per-`DashboardCanvas` Svelte context so
 * sibling widgets on the same canvas can react, while widgets in other
 * canvases (or the same workspace) stay isolated — the pattern mirrors
 * `freeCanvasStore.ts` (#032.2/.4).
 *
 * This sub-PR ships ONLY the store, the pure `composeEffectiveFilter` helper,
 * and `DashboardCanvas` wiring. Widget UI changes (driver clicks, receiver
 * highlights, selection badges) land in #044.2–#044.5.
 *
 * Anti-cycle invariants (#016 lesson):
 *   1. Every write carries a `source` discriminator — driver/receiver hybrids
 *      use it to self-skip and avoid re-emitting their own selection.
 *   2. `setSelection` is a no-op on shallow-equal payload (no notification
 *      fires when nothing changed).
 *   3. `composeEffectiveFilter` is a pure function; receivers MUST NOT call
 *      back into the store from a reactive block.
 */

import { writable, type Writable } from "svelte/store";
import type { FilterCondition, FilterOperator } from "src/settings/base/settings";

/** Stable Svelte context key. Exported so tests can re-mount under it. */
export const SELECTION_CONTEXT_KEY = "ppp-selection";

/**
 * Canonical source-id builders for driver widgets. Centralised here (rather
 * than co-located with each widget) so the self-skip check below and the
 * widget-level helpers cannot drift apart — adding a new driver type means
 * adding ONE builder here and re-exporting from the widget module.
 */
export function dataTableSourceId(widgetId: string): string {
	return `data-table:${widgetId}`;
}
export function chartSourceId(widgetId: string): string {
	return `chart:${widgetId}`;
}

/**
 * v1 supports only equality selection. Widening to `in` / `between` / date
 * ranges is reserved for v2 (spec §9). The literal type keeps surface narrow
 * so future widening is a compile-time visible change.
 */
export type SelectionOp = "is";

/**
 * Shape of an active selection, or the "empty" sentinel.
 *
 * `source === null` is the canonical "no selection" state. All other fields
 * are also null in that state — never inspect them when `source` is null.
 */
export interface SelectionState {
	readonly source: string | null;
	readonly field: string | null;
	readonly value: string | null;
	readonly op: SelectionOp | null;
}

/** Initial / cleared state. Module-level frozen literal for reference equality. */
export const EMPTY_SELECTION: SelectionState = Object.freeze({
	source: null,
	field: null,
	value: null,
	op: null,
}) as SelectionState;

/** Payload accepted by `setSelection`. Op defaults to `"is"`. */
export interface SetSelectionInput {
	readonly source: string;
	readonly field: string;
	readonly value: string;
	readonly op?: SelectionOp;
}

/** Public store API — standard Svelte writable plus typed actions. */
export interface SelectionStore extends Writable<SelectionState> {
	setSelection(next: SetSelectionInput): void;
	clearSelection(): void;
}

/**
 * Factory: build a fresh, isolated selection store. ONE store per
 * `DashboardCanvas.svelte` instance — never a module-level singleton —
 * so two canvases on the same workspace stay independent.
 */
export function createSelectionStore(
	initial: SelectionState = EMPTY_SELECTION,
): SelectionStore {
	const store = writable<SelectionState>(initial);
	// Local mirror of the latest emitted state — Svelte's `writable` uses
	// `safe_not_equal` which treats every object write as a change, so we
	// cannot rely on returning the same reference from `update` to suppress
	// notifications. Tracking the current value ourselves lets the idempotence
	// guard skip the write entirely.
	let current: SelectionState = initial;
	store.subscribe((v) => {
		current = v;
	});

	function setSelection(next: SetSelectionInput): void {
		const op: SelectionOp = next.op ?? "is";
		// Idempotence guard (#016 invariant 2): shallow-equal payload → no write.
		if (
			current.source === next.source &&
			current.field === next.field &&
			current.value === next.value &&
			current.op === op
		) {
			return;
		}
		store.set({
			source: next.source,
			field: next.field,
			value: next.value,
			op,
		});
	}

	function clearSelection(): void {
		// Already empty → no write (avoid spurious notifications).
		if (current.source === null) return;
		store.set(EMPTY_SELECTION);
	}

	return {
		subscribe: store.subscribe,
		set: store.set,
		update: store.update,
		setSelection,
		clearSelection,
	};
}

/**
 * Map a selection's `op` to the canonical `FilterOperator` used by
 * `filterEvaluator.ts`. Centralised so adding v2 operators only touches
 * this table.
 */
function selectionOpToFilterOperator(op: SelectionOp): FilterOperator {
	switch (op) {
		case "is":
			return "is";
		default: {
			// Exhaustiveness guard — narrow type ensures `op` is never anything
			// else at compile time; runtime fallback keeps the function total.
			const _exhaustive: never = op;
			void _exhaustive;
			return "is";
		}
	}
}

/**
 * Pure: compose an auto-filter condition for a linked (receiver) block.
 *
 * Returns null when:
 * - linkedSelection is not configured, OR
 * - canvas has no active selection, OR
 * - the active selection's source does not match the configured master block.
 *
 * Returns a FilterCondition when the master block has an active selection:
 *   { field: linkedSelection.relationField, operator: "is", value: selectionValue }
 */
export function composeLinkedSelectionFilter(args: {
	readonly linkedSelection: import("./types").LinkedSelectionConfig | undefined;
	readonly canvasSelection: SelectionState;
}): FilterCondition | null {
	const { linkedSelection, canvasSelection } = args;
	if (!linkedSelection) return null;
	if (canvasSelection.source === null || canvasSelection.value === null) return null;

	const isMasterSource =
		canvasSelection.source === dataTableSourceId(linkedSelection.sourceWidgetId) ||
		canvasSelection.source === chartSourceId(linkedSelection.sourceWidgetId);

	if (!isMasterSource) return null;

	return {
		field: linkedSelection.relationField,
		operator: "is",
		value: canvasSelection.value,
		enabled: true,
	};
}

/**
 * Pure: compose the effective filter for a receiver widget.
 *
 * Returns `userFilters` unchanged (reference-equal) when:
 *   - the selection is empty, OR
 *   - the selection originated from `myWidgetId` (self-skip rule, spec §5.2).
 *
 * Otherwise appends a single equality condition derived from the selection.
 * The selection condition is logically AND-ed with `userFilters` by virtue of
 * `FilterDefinition.conjunction === "and"` at the call site (the canonical
 * filter engine evaluates the resulting condition list under that conjunction).
 */
export function composeEffectiveFilter(args: {
	readonly userFilters: readonly FilterCondition[];
	readonly selection: SelectionState;
	readonly myWidgetId: string;
}): readonly FilterCondition[] {
	const { userFilters, selection, myWidgetId } = args;

	// Empty selection → no narrowing.
	if (selection.source === null || selection.field === null || selection.value === null || selection.op === null) {
		return userFilters;
	}

	// Self-skip: if the active selection was emitted by this very widget,
	// the widget MUST render its full data unaffected (a driver should not
	// re-filter itself by its own click). The spec's primary motivator is
	// DataTableWidget which is driver+receiver hybrid.
	if (selection.source === dataTableSourceId(myWidgetId) || selection.source === chartSourceId(myWidgetId)) {
		return userFilters;
	}

	const selectionCondition: FilterCondition = {
		field: selection.field,
		operator: selectionOpToFilterOperator(selection.op),
		value: selection.value,
		enabled: true,
	};

	return [...userFilters, selectionCondition];
}
