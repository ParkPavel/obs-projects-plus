/**
 * chartSelectionDriver.test.ts — pure-helper coverage for #044.2.
 *
 * Drives the toggle / self-highlight logic that ChartWidget delegates to.
 * Component-level interaction (event dispatch from SVG, dim opacity in
 * subcomponents) is covered transitively: if these helpers are correct,
 * the Svelte component just routes their output.
 */

import {
	chartSourceId,
	computeChartSelectionToggle,
	getSelectedChartLabel,
} from "../chartSelectionDriver";
import {
	EMPTY_SELECTION,
	type SelectionState,
} from "../../../FreeCanvas/selectionStore";

const otherChart = (): SelectionState => ({
	source: "chart:other-widget",
	field: "status",
	value: "Done",
	op: "is",
});

const ownChart = (label: string, field = "status"): SelectionState => ({
	source: "chart:w1",
	field,
	value: label,
	op: "is",
});

describe("chartSelectionDriver — chartSourceId", () => {
	it("prefixes the widget id with the chart discriminator", () => {
		expect(chartSourceId("w1")).toBe("chart:w1");
	});
});

describe("chartSelectionDriver — computeChartSelectionToggle", () => {
	it("sets a new selection when nothing is active", () => {
		const result = computeChartSelectionToggle(EMPTY_SELECTION, {
			widgetId: "w1",
			field: "status",
			value: "Done",
		});
		expect(result).toEqual({
			kind: "set",
			source: "chart:w1",
			field: "status",
			value: "Done",
		});
	});

	it("clears when the click hits the segment that already drives this chart", () => {
		const result = computeChartSelectionToggle(ownChart("Done"), {
			widgetId: "w1",
			field: "status",
			value: "Done",
		});
		expect(result).toEqual({ kind: "clear" });
	});

	it("replaces the selection when a different segment of the same chart is clicked", () => {
		const result = computeChartSelectionToggle(ownChart("Done"), {
			widgetId: "w1",
			field: "status",
			value: "In Progress",
		});
		expect(result).toEqual({
			kind: "set",
			source: "chart:w1",
			field: "status",
			value: "In Progress",
		});
	});

	it("does not clear when an identical value originates from another chart (source must match)", () => {
		// Same field+value, different source-widget → setting, not clearing.
		const result = computeChartSelectionToggle(otherChart(), {
			widgetId: "w1",
			field: "status",
			value: "Done",
		});
		expect(result).toEqual({
			kind: "set",
			source: "chart:w1",
			field: "status",
			value: "Done",
		});
	});

	it("ignores empty value or field clicks (cannot build a useful filter)", () => {
		expect(
			computeChartSelectionToggle(EMPTY_SELECTION, {
				widgetId: "w1",
				field: "status",
				value: "",
			}),
		).toEqual({ kind: "noop" });
		expect(
			computeChartSelectionToggle(EMPTY_SELECTION, {
				widgetId: "w1",
				field: "",
				value: "Done",
			}),
		).toEqual({ kind: "noop" });
	});
});

describe("chartSelectionDriver — getSelectedChartLabel (self-highlight only)", () => {
	it("returns null when there is no active selection", () => {
		expect(
			getSelectedChartLabel(EMPTY_SELECTION, { widgetId: "w1", field: "status" }),
		).toBeNull();
	});

	it("returns the value when the selection originates from this very chart on the same field", () => {
		expect(
			getSelectedChartLabel(ownChart("Done"), { widgetId: "w1", field: "status" }),
		).toBe("Done");
	});

	it("returns null when a selection from another chart on the canvas is active (driver-only PR)", () => {
		expect(
			getSelectedChartLabel(otherChart(), { widgetId: "w1", field: "status" }),
		).toBeNull();
	});

	it("returns null when the selection's field disagrees with this chart's xAxis (different group-by)", () => {
		expect(
			getSelectedChartLabel(ownChart("Done", "priority"), {
				widgetId: "w1",
				field: "status",
			}),
		).toBeNull();
	});

	it("isolates multi-chart canvases — each chart highlights only its own selection", () => {
		// Widget A is driving the selection.
		const state = ownChart("Done");
		// Widget B looks at the same store but on the same field → must NOT highlight.
		expect(
			getSelectedChartLabel(state, { widgetId: "w2", field: "status" }),
		).toBeNull();
		// Widget A still highlights its own pick.
		expect(
			getSelectedChartLabel(state, { widgetId: "w1", field: "status" }),
		).toBe("Done");
	});
});
