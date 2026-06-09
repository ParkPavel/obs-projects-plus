/**
 * statsSelectionReceiver.test.ts — pure-helper coverage for #044.4.
 *
 * Validates that StatsWidget's receiver narrows its record set correctly,
 * skips self-emitted selections, and exposes the `isSelectionActive`
 * predicate that drives the filtered-dot indicator.
 */

import {
	filterRecordsBySelection,
	isSelectionActive,
	statsSourceId,
} from "../statsSelectionReceiver";
import {
	EMPTY_SELECTION,
	type SelectionState,
} from "../../../canvasSelectionStore";
import type { DataRecord } from "src/lib/dataframe/dataframe";

function rec(id: string, values: Record<string, unknown>): DataRecord {
	return { id, values: values as DataRecord["values"] };
}

const records: DataRecord[] = [
	rec("a.md", { path: "a.md", status: "Done", tags: ["x", "y"], hours: 4 }),
	rec("b.md", { path: "b.md", status: "Todo", tags: ["y", "z"], hours: 2 }),
	rec("c.md", { path: "c.md", status: "Done", tags: [], hours: 7 }),
	rec("d.md", { path: "d.md", status: null, tags: null, hours: null }),
];

const externalSelection = (
	field: string,
	value: string,
): SelectionState => ({
	source: "chart:other-widget",
	field,
	value,
	op: "is",
});

describe("filterRecordsBySelection — #044.4 receiver", () => {
	it("returns the input array reference when selection is empty (no-op)", () => {
		const out = filterRecordsBySelection({
			records,
			selection: EMPTY_SELECTION,
			myWidgetId: "stats-1",
		});
		expect(out).toBe(records);
	});

	it("narrows by an external scalar selection (status=Done)", () => {
		const out = filterRecordsBySelection({
			records,
			selection: externalSelection("status", "Done"),
			myWidgetId: "stats-1",
		});
		expect(out.map((r) => r.id)).toEqual(["a.md", "c.md"]);
	});

	it("matches array-typed (List) cells by element equality", () => {
		const out = filterRecordsBySelection({
			records,
			selection: externalSelection("tags", "y"),
			myWidgetId: "stats-1",
		});
		expect(out.map((r) => r.id)).toEqual(["a.md", "b.md"]);
	});

	it("treats null/undefined cells as non-matching", () => {
		const out = filterRecordsBySelection({
			records,
			selection: externalSelection("status", "Done"),
			myWidgetId: "stats-1",
		});
		expect(out.map((r) => r.id)).not.toContain("d.md");
	});

	it("yields an empty array when nothing matches (still a fresh array)", () => {
		const out = filterRecordsBySelection({
			records,
			selection: externalSelection("status", "Archived"),
			myWidgetId: "stats-1",
		});
		expect(out).toEqual([]);
		// Not the original — a fresh array signals downstream `$:` it changed.
		expect(out).not.toBe(records);
	});

	it("self-skip: ignores selections emitted by this widget's future driver", () => {
		const selfSelection: SelectionState = {
			source: statsSourceId("stats-1"),
			field: "status",
			value: "Done",
			op: "is",
		};
		const out = filterRecordsBySelection({
			records,
			selection: selfSelection,
			myWidgetId: "stats-1",
		});
		expect(out).toBe(records);
	});

	it("is widget-scoped: a different stats widget DOES react to its sibling's selection", () => {
		const otherStatsSelection: SelectionState = {
			source: statsSourceId("stats-other"),
			field: "status",
			value: "Done",
			op: "is",
		};
		const out = filterRecordsBySelection({
			records,
			selection: otherStatsSelection,
			myWidgetId: "stats-1",
		});
		expect(out.map((r) => r.id)).toEqual(["a.md", "c.md"]);
	});

	it("agrees with dataTable receiver semantics on array vs scalar match (regression guard)", () => {
		// Identical input/selection between data-table and stats receivers must
		// produce semantically equivalent matches — otherwise highlighted rows
		// in the DataTable wouldn't agree with the cohort the Stats aggregate
		// was computed over. This guards against silent drift between the two
		// helpers' match logic.
		const scalar = filterRecordsBySelection({
			records,
			selection: externalSelection("status", "Done"),
			myWidgetId: "stats-1",
		});
		const list = filterRecordsBySelection({
			records,
			selection: externalSelection("tags", "y"),
			myWidgetId: "stats-1",
		});
		expect(scalar.map((r) => r.id).sort()).toEqual(["a.md", "c.md"]);
		expect(list.map((r) => r.id).sort()).toEqual(["a.md", "b.md"]);
	});
});

describe("isSelectionActive — #044.4 indicator predicate", () => {
	it("is false for the empty sentinel", () => {
		expect(isSelectionActive(EMPTY_SELECTION, "stats-1")).toBe(false);
	});

	it("is true for an external selection", () => {
		expect(isSelectionActive(externalSelection("status", "Done"), "stats-1")).toBe(true);
	});

	it("is false when the selection was emitted by this widget (self-skip)", () => {
		const selfSelection: SelectionState = {
			source: statsSourceId("stats-1"),
			field: "status",
			value: "Done",
			op: "is",
		};
		expect(isSelectionActive(selfSelection, "stats-1")).toBe(false);
	});

	it("is true even when the selection matches zero records — the indicator still renders", () => {
		// Empty cohorts are conceptually filtered: the user should see the dot
		// + a zero/empty value rather than a confusing unchanged number.
		const sel = externalSelection("status", "DoesNotExist");
		expect(isSelectionActive(sel, "stats-1")).toBe(true);
	});
});

describe("statsSourceId", () => {
	it("emits stable, widget-scoped prefix", () => {
		expect(statsSourceId("w1")).toBe("stats:w1");
		expect(statsSourceId("w2")).toBe("stats:w2");
	});
});
