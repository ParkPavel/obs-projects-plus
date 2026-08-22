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
 * v1: single equality. v2 (Phase 4.5+): `is-any-of` for multi-value selections.
 */
export type SelectionOp = "is" | "is-any-of";

/**
 * Shape of an active selection, or the "empty" sentinel.
 *
 * `source === null` is the canonical "no selection" state. All other fields
 * are also null/empty in that state — never inspect them when `source` is null.
 * `values` is an empty array when there is no selection.
 */
export interface SelectionState {
	readonly source: string | null;
	readonly field: string | null;
	readonly values: ReadonlyArray<string>;
	readonly op: SelectionOp | null;
}

/** Initial / cleared state. Module-level frozen literal for reference equality. */
export const EMPTY_SELECTION: SelectionState = Object.freeze({
	source: null,
	field: null,
	values: Object.freeze([]) as ReadonlyArray<string>,
	op: null,
}) as SelectionState;

/** Payload accepted by `setSelection`. Op defaults to `"is"` for single value, `"is-any-of"` for multiple. */
export interface SetSelectionInput {
	readonly source: string;
	readonly field: string;
	readonly values: ReadonlyArray<string>;
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
		const op: SelectionOp = next.op ?? (next.values.length > 1 ? "is-any-of" : "is");
		// Idempotence guard (#016 invariant 2): shallow-equal payload → no write.
		if (
			current.source === next.source &&
			current.field === next.field &&
			current.op === op &&
			current.values.length === next.values.length &&
			current.values.every((v, i) => v === next.values[i])
		) {
			return;
		}
		store.set({
			source: next.source,
			field: next.field,
			values: next.values,
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
 * Bind the canvas-wide Escape→clear gesture. Returns an unsubscribe for
 * `onDestroy`. No-op outside a DOM (jest node contexts).
 */
export function bindEscapeClear(store: SelectionStore): () => void {
	if (typeof document === "undefined") return () => {};
	const onKey = (e: KeyboardEvent) => {
		if (e.key === "Escape") store.clearSelection();
	};
	// #106 — capture phase so the canvas-wide Escape→clear fires before a
	// focused child (input, popover) can swallow the event on the bubbling
	// phase. No preventDefault/stopPropagation: Escape stays available to
	// other handlers (e.g. closing an open menu).
	document.addEventListener("keydown", onKey, true);
	return () => document.removeEventListener("keydown", onKey, true);
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
		case "is-any-of":
			return "is-any-of";
		default: {
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
function composeLinkedSelectionFilter(args: {
	readonly linkedSelection: import("./types").LinkedSelectionConfig | undefined;
	readonly canvasSelection: SelectionState;
}): FilterCondition | null {
	const { linkedSelection, canvasSelection } = args;
	if (!linkedSelection) return null;
	if (canvasSelection.source === null || canvasSelection.values.length === 0) return null;

	const isMasterSource =
		canvasSelection.source === dataTableSourceId(linkedSelection.sourceWidgetId) ||
		canvasSelection.source === chartSourceId(linkedSelection.sourceWidgetId);

	if (!isMasterSource) return null;

	const { values } = canvasSelection;
	if (values.length === 1) {
		return {
			field: linkedSelection.relationField,
			operator: "is",
			value: values[0] as string,
			enabled: true,
		};
	}
	return {
		field: linkedSelection.relationField,
		operator: "is-any-of",
		value: JSON.stringify(values),
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
 * Otherwise appends one or two equality conditions:
 *   1. A linked-selection condition when `linkedSelection` is configured AND
 *      `validationResult === "valid"`. Uses `composeLinkedSelectionFilter`
 *      internally. When `validationResult` is absent/not-valid, the linked
 *      condition is skipped so a broken relation does not silently narrow data.
 *   2. A canvas-selection condition derived from `selection.field` when a
 *      sibling driver widget has emitted a selection.
 *
 * The selection condition is logically AND-ed with `userFilters` by virtue of
 * `FilterDefinition.conjunction === "and"` at the call site.
 */
export function composeEffectiveFilter(args: {
	readonly userFilters: readonly FilterCondition[];
	readonly selection: SelectionState;
	readonly myWidgetId: string;
	/** When set, also applies the linked-selection condition (gated by validationResult). */
	readonly linkedSelection?: import("./types").LinkedSelectionConfig | undefined;
	/** When present and not "valid", the linked-selection condition is skipped. */
	readonly validationResult?: "valid" | "missing-relation" | "invalid-field" | "wrong-target-project" | undefined;
}): readonly FilterCondition[] {
	const { userFilters, selection, myWidgetId, linkedSelection, validationResult } = args;

	const conditions: FilterCondition[] = [...userFilters];

	// Linked-selection condition: only when validation confirms the relation
	// is intact. When the linked condition fires, it maps the selection through
	// the configured relationField so the canvas-condition step is skipped.
	let linkedFired = false;
	if (linkedSelection && validationResult === "valid") {
		const linked = composeLinkedSelectionFilter({ linkedSelection, canvasSelection: selection });
		if (linked) {
			conditions.push(linked);
			linkedFired = true;
		}
	}

	// Canvas-selection condition (self-skip applies). Skip when the linked
	// condition already captured this selection via the relation field.
	if (!linkedFired && selection.source !== null && selection.field !== null && selection.values.length > 0 && selection.op !== null) {
		if (selection.source !== dataTableSourceId(myWidgetId) && selection.source !== chartSourceId(myWidgetId)) {
			const { values } = selection;
			conditions.push({
				field: selection.field,
				operator: selectionOpToFilterOperator(selection.op),
				value: values.length === 1 ? (values[0] as string) : JSON.stringify(values),
				enabled: true,
			});
		}
	}

	return conditions.length === userFilters.length ? userFilters : conditions;
}
