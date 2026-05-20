/**
 * dataTableSelectionReceiver.ts — pure helpers for DataTableWidget's receiver role.
 *
 * Spec: .ai_internal/New-specification/CROSS_WIDGET_SPEC.md §4, §5.2.
 * Ticket: #044.3a (Phase 5 sub-PR 3a — receiver only; driver deferred to #044.3b).
 *
 * Given the canvas-level selection state, decide which rows of a DataTable
 * should be visually highlighted (matching) vs dimmed (non-matching). The
 * Svelte component delegates this computation to a pure function so it can
 * be exhaustively unit-tested without mounting the widget.
 *
 * Visual semantics (spec §5.2):
 *   - Hidden rows are NOT removed — table geometry is preserved.
 *   - Matching rows → `highlighted = true`.
 *   - Non-matching rows → `dimmed = true`.
 *   - When the helper returns `null`, callers MUST apply neither flag (the
 *     "no-op" path: empty selection or self-emitted selection).
 */

import type { DataRecord } from "src/lib/dataframe/dataframe";
import { dataTableSourceId, type SelectionState } from "../../FreeCanvas/selectionStore";

// Re-export for callers (tests, future #044.3b driver) that already import it
// from this module. Canonical definition lives in selectionStore.ts to keep
// the self-skip check there in sync with widget-side prefix usage.
export { dataTableSourceId };

/**
 * Decide whether a single record's value at `field` matches `selection.value`.
 *
 * v1 receiver supports only equality (`op === "is"` — the only op the v1 store
 * emits anyway). Match rules:
 *   - `null` / `undefined` cell values never match.
 *   - Arrays match if any element stringifies to the selection value
 *     (covers the `List` field type used for tags etc.).
 *   - Scalars match when their string form equals the selection value.
 *
 * Stringification is the lingua-franca because `selection.value` is always a
 * `string` (the discrete categorical label the driver emitted).
 */
function recordMatchesSelection(
	record: DataRecord,
	field: string,
	value: string,
): boolean {
	const cell = record.values[field];
	if (cell === null || cell === undefined) return false;
	if (Array.isArray(cell)) {
		return cell.some((item) => item != null && String(item) === value);
	}
	return String(cell) === value;
}

/**
 * Build the set of row IDs that match the current selection.
 *
 * Returns `null` when no per-row decoration should be applied:
 *   - The selection is empty (`source === null`).
 *   - The selection was emitted by this very widget (self-skip rule, spec §5.2;
 *     future-proofing for #044.3b when DataTable becomes a driver too).
 *
 * Otherwise returns a `Set<rowId>` of matching records. Callers derive the
 * per-row visual state as:
 *
 *   matching === null         → highlighted=false, dimmed=false
 *   matching.has(rowId)       → highlighted=true,  dimmed=false
 *   !matching.has(rowId)      → highlighted=false, dimmed=true
 *
 * The function is pure — same inputs always yield a fresh Set with the same
 * contents. It does NOT memoise (Svelte's reactive `$:` block does that at
 * the call site by re-running only when its tracked inputs change).
 */
export function computeMatchingRowIds(args: {
	readonly records: readonly DataRecord[];
	readonly selection: SelectionState;
	readonly myWidgetId: string;
}): ReadonlySet<string> | null {
	const { records, selection, myWidgetId } = args;

	// Empty selection → no decoration.
	if (
		selection.source === null ||
		selection.field === null ||
		selection.value === null
	) {
		return null;
	}

	// Self-skip: never decorate based on this widget's own emission.
	if (selection.source === dataTableSourceId(myWidgetId)) {
		return null;
	}

	const matching = new Set<string>();
	for (const record of records) {
		if (recordMatchesSelection(record, selection.field, selection.value)) {
			matching.add(record.id);
		}
	}
	return matching;
}
