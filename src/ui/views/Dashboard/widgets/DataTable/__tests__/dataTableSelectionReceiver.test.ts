/**
 * dataTableSelectionReceiver.test.ts — pure-helper coverage for #044.3a.
 *
 * Validates the receiver decision matrix that DataTableWidget delegates to.
 * Component-level rendering (class application on GridRow → GridCellGroup)
 * is covered transitively: if these helpers return the right matching set,
 * the Svelte component just maps that set onto `highlighted`/`dimmed` flags.
 */

import {
	computeMatchingRowIds,
	dataTableSourceId,
} from "../dataTableSelectionReceiver";
import {
	EMPTY_SELECTION,
	type SelectionState,
} from "../../../canvasSelectionStore";
import type { DataRecord } from "src/lib/dataframe/dataframe";

function rec(id: string, values: Record<string, unknown>): DataRecord {
	// Cast is safe — DataRecord's `values` is a wide map and tests only need
	// the fields exercised by the receiver matcher.
	return { id, values: values as DataRecord["values"] };
}

const records: DataRecord[] = [
	rec("a.md", { path: "a.md", status: "Done", tags: ["x", "y"] }),
	rec("b.md", { path: "b.md", status: "Todo", tags: ["y", "z"] }),
	rec("c.md", { path: "c.md", status: "Done", tags: [] }),
	rec("d.md", { path: "d.md", status: null, tags: null }),
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

describe("computeMatchingRowIds — #044.3a receiver", () => {
	it("returns null when selection is empty (no-op path)", () => {
		const out = computeMatchingRowIds({
			records,
			selection: EMPTY_SELECTION,
			myWidgetId: "table-1",
		});
		expect(out).toBeNull();
	});

	it("returns matching row ids when an external selection targets a scalar field", () => {
		const out = computeMatchingRowIds({
			records,
			selection: externalSelection("status", "Done"),
			myWidgetId: "table-1",
		});
		expect(out).not.toBeNull();
		expect([...(out as ReadonlySet<string>)].sort()).toEqual(["a.md", "c.md"]);
	});

	it("does not match null cell values", () => {
		const out = computeMatchingRowIds({
			records,
			selection: externalSelection("status", "Todo"),
			myWidgetId: "table-1",
		});
		// d.md has status=null → excluded; b.md is the only Todo.
		expect([...(out as ReadonlySet<string>)]).toEqual(["b.md"]);
	});

	it("matches array (List-typed) cells when any element equals the selection value", () => {
		const out = computeMatchingRowIds({
			records,
			selection: externalSelection("tags", "y"),
			myWidgetId: "table-1",
		});
		expect([...(out as ReadonlySet<string>)].sort()).toEqual(["a.md", "b.md"]);
	});

	it("returns an empty set when no record matches (all rows will be dimmed by the caller)", () => {
		const out = computeMatchingRowIds({
			records,
			selection: externalSelection("status", "Archived"),
			myWidgetId: "table-1",
		});
		expect(out).not.toBeNull();
		expect((out as ReadonlySet<string>).size).toBe(0);
	});

	it("self-skips when the selection was emitted by this widget (driver+receiver hybrid contract)", () => {
		const own: SelectionState = {
			source: dataTableSourceId("table-1"),
			field: "status",
			value: "Done",
			op: "is",
		};
		const out = computeMatchingRowIds({
			records,
			selection: own,
			myWidgetId: "table-1",
		});
		expect(out).toBeNull();
	});

	it("isolates two tables: same selection from chart only decorates each table independently", () => {
		const sel = externalSelection("status", "Done");
		const a = computeMatchingRowIds({ records, selection: sel, myWidgetId: "table-a" });
		const b = computeMatchingRowIds({ records, selection: sel, myWidgetId: "table-b" });
		// Both receivers process the same external selection identically.
		expect(a).not.toBeNull();
		expect(b).not.toBeNull();
		expect([...(a as ReadonlySet<string>)].sort()).toEqual(
			[...(b as ReadonlySet<string>)].sort(),
		);
		// But they are independent Set instances (no shared mutation surface).
		expect(a).not.toBe(b);
	});

	it("self-skip is widget-scoped: table-b still decorates when table-a is the source", () => {
		const fromA: SelectionState = {
			source: dataTableSourceId("table-a"),
			field: "status",
			value: "Done",
			op: "is",
		};
		expect(
			computeMatchingRowIds({ records, selection: fromA, myWidgetId: "table-a" }),
		).toBeNull();
		expect(
			[...(computeMatchingRowIds({
				records,
				selection: fromA,
				myWidgetId: "table-b",
			}) as ReadonlySet<string>)].sort(),
		).toEqual(["a.md", "c.md"]);
	});

	it("dataTableSourceId emits stable, widget-scoped prefix", () => {
		expect(dataTableSourceId("w1")).toBe("data-table:w1");
		expect(dataTableSourceId("w2")).toBe("data-table:w2");
	});
});
