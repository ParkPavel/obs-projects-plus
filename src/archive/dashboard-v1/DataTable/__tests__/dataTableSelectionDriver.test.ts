/**
 * dataTableSelectionDriver.test.ts — pure-helper coverage for #044.3b.
 *
 * Validates the toggle decision matrix that DataTableWidget invokes from the
 * "Filter canvas by this row" context-menu entry.
 */

import {
	computeDataTableSelectionToggle,
	isThisWidgetDriving,
	dataTableSourceId,
} from "../dataTableSelectionDriver";
import {
	EMPTY_SELECTION,
	type SelectionState,
} from "src/ui/views/Dashboard/canvasSelectionStore";

const ownSource = dataTableSourceId("table-1");

const ownActive: SelectionState = {
	source: ownSource,
	field: "path",
	values: ["a.md"],
	op: "is",
};

describe("computeDataTableSelectionToggle — #044.3b", () => {
	it("from empty: sets a new selection with this widget's source-id", () => {
		const out = computeDataTableSelectionToggle(EMPTY_SELECTION, {
			widgetId: "table-1",
			field: "path",
			value: "a.md",
		});
		expect(out).toEqual({
			kind: "set",
			source: ownSource,
			field: "path",
			values: ["a.md"],
		});
	});

	it("from own-active on the same row: clears (toggle-off)", () => {
		const out = computeDataTableSelectionToggle(ownActive, {
			widgetId: "table-1",
			field: "path",
			value: "a.md",
		});
		expect(out).toEqual({ kind: "clear" });
	});

	it("from own-active on a different row: sets a new selection (replace)", () => {
		const out = computeDataTableSelectionToggle(ownActive, {
			widgetId: "table-1",
			field: "path",
			value: "b.md",
		});
		expect(out).toEqual({
			kind: "set",
			source: ownSource,
			field: "path",
			values: ["b.md"],
		});
	});

	it("from another widget's selection: replaces with this widget's selection (driver re-claim)", () => {
		const otherActive: SelectionState = {
			source: "chart:other-widget",
			field: "status",
			values: ["Done"],
			op: "is",
		};
		const out = computeDataTableSelectionToggle(otherActive, {
			widgetId: "table-1",
			field: "path",
			value: "a.md",
		});
		expect(out).toEqual({
			kind: "set",
			source: ownSource,
			field: "path",
			values: ["a.md"],
		});
	});

	it("empty value → no-op (avoids match-everything filter)", () => {
		const out = computeDataTableSelectionToggle(EMPTY_SELECTION, {
			widgetId: "table-1",
			field: "path",
			value: "",
		});
		expect(out).toEqual({ kind: "noop" });
	});

	it("empty field → no-op (defensive)", () => {
		const out = computeDataTableSelectionToggle(EMPTY_SELECTION, {
			widgetId: "table-1",
			field: "",
			value: "a.md",
		});
		expect(out).toEqual({ kind: "noop" });
	});

	it("each widget gets a distinct source-id (no driver collision between sibling tables)", () => {
		const fromA = computeDataTableSelectionToggle(EMPTY_SELECTION, {
			widgetId: "table-a",
			field: "path",
			value: "x.md",
		});
		const fromB = computeDataTableSelectionToggle(EMPTY_SELECTION, {
			widgetId: "table-b",
			field: "path",
			value: "x.md",
		});
		expect(fromA.kind).toBe("set");
		expect(fromB.kind).toBe("set");
		if (fromA.kind === "set" && fromB.kind === "set") {
			expect(fromA.source).not.toBe(fromB.source);
		}
	});
});

describe("isThisWidgetDriving — context-menu label switch", () => {
	it("is true when the current selection was emitted by this widget", () => {
		expect(isThisWidgetDriving(ownActive, "table-1")).toBe(true);
	});

	it("is false when the selection is empty", () => {
		expect(isThisWidgetDriving(EMPTY_SELECTION, "table-1")).toBe(false);
	});

	it("is false when the selection was emitted by a sibling widget", () => {
		const otherActive: SelectionState = {
			source: "chart:other",
			field: "status",
			values: ["Done"],
			op: "is",
		};
		expect(isThisWidgetDriving(otherActive, "table-1")).toBe(false);
	});

	it("is false when the selection was emitted by a SIBLING data-table widget", () => {
		const otherTableActive: SelectionState = {
			source: dataTableSourceId("table-2"),
			field: "path",
			values: ["a.md"],
			op: "is",
		};
		expect(isThisWidgetDriving(otherTableActive, "table-1")).toBe(false);
	});
});
