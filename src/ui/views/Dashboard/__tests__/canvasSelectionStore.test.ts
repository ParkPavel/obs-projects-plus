/**
 * selectionStore.test.ts — coverage for #044.1 selection store + pure composer.
 */

import { get } from "svelte/store";
import type { FilterCondition } from "src/settings/base/settings";

import {
	EMPTY_SELECTION,
	composeEffectiveFilter,
	createSelectionStore,
	type SelectionState,
} from "../canvasSelectionStore";

function cond(field: string, value: string): FilterCondition {
	return { field, operator: "is", value, enabled: true };
}

describe("selectionStore — state", () => {
	test("initial state is the empty sentinel", () => {
		const store = createSelectionStore();
		expect(get(store)).toBe(EMPTY_SELECTION);
		expect(get(store).source).toBeNull();
	});

	test("initial state can be seeded", () => {
		const seed: SelectionState = {
			source: "chart:w1",
			field: "status",
			value: "Active",
			op: "is",
		};
		const store = createSelectionStore(seed);
		expect(get(store)).toEqual(seed);
	});

	test("setSelection writes the new state and defaults op to 'is'", () => {
		const store = createSelectionStore();
		store.setSelection({ source: "chart:w1", field: "status", value: "Done" });
		const next = get(store);
		expect(next).toEqual({ source: "chart:w1", field: "status", value: "Done", op: "is" });
	});

	test("setSelection with identical payload is a no-op (no notification)", () => {
		const store = createSelectionStore();
		store.setSelection({ source: "chart:w1", field: "status", value: "Done" });
		let calls = 0;
		const unsub = store.subscribe(() => {
			calls++;
		});
		// subscribe fires once synchronously with the current value
		expect(calls).toBe(1);
		store.setSelection({ source: "chart:w1", field: "status", value: "Done", op: "is" });
		expect(calls).toBe(1); // no extra notification
		unsub();
	});

	test("setSelection with different value fires a notification", () => {
		const store = createSelectionStore();
		store.setSelection({ source: "chart:w1", field: "status", value: "Done" });
		let calls = 0;
		const unsub = store.subscribe(() => {
			calls++;
		});
		expect(calls).toBe(1);
		store.setSelection({ source: "chart:w1", field: "status", value: "Active" });
		expect(calls).toBe(2);
		unsub();
	});

	test("clearSelection returns to EMPTY_SELECTION", () => {
		const store = createSelectionStore();
		store.setSelection({ source: "chart:w1", field: "status", value: "Done" });
		store.clearSelection();
		expect(get(store)).toBe(EMPTY_SELECTION);
	});

	test("clearSelection on an already-empty store is a no-op", () => {
		const store = createSelectionStore();
		let calls = 0;
		const unsub = store.subscribe(() => {
			calls++;
		});
		expect(calls).toBe(1);
		store.clearSelection();
		expect(calls).toBe(1);
		unsub();
	});
});

describe("composeEffectiveFilter — pure derivation", () => {
	const base: readonly FilterCondition[] = [cond("priority", "high")];

	test("empty selection returns userFilters reference-equal", () => {
		const out = composeEffectiveFilter({
			userFilters: base,
			selection: EMPTY_SELECTION,
			myWidgetId: "any",
		});
		expect(out).toBe(base);
	});

	test("active selection appends one equality condition", () => {
		const sel: SelectionState = {
			source: "chart:w1",
			field: "status",
			value: "Done",
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: base,
			selection: sel,
			myWidgetId: "w2",
		});
		expect(out).toHaveLength(2);
		expect(out[0]).toBe(base[0]); // unchanged prefix
		expect(out[1]).toEqual({ field: "status", operator: "is", value: "Done", enabled: true });
	});

	test("self-skip — same-id chart driver receives userFilters reference-equal", () => {
		const sel: SelectionState = {
			source: "chart:w1",
			field: "status",
			value: "Done",
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: base,
			selection: sel,
			myWidgetId: "w1",
		});
		expect(out).toBe(base);
	});

	test("self-skip — same-id data-table driver receives userFilters reference-equal", () => {
		const sel: SelectionState = {
			source: "data-table:w3",
			field: "path",
			value: "Projects/Alpha.md",
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: base,
			selection: sel,
			myWidgetId: "w3",
		});
		expect(out).toBe(base);
	});

	test("cross-widget — chart driver narrows a different widget", () => {
		const sel: SelectionState = {
			source: "chart:w1",
			field: "status",
			value: "Done",
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: sel,
			myWidgetId: "stats:w99",
		});
		expect(out).toHaveLength(1);
		expect(out[0]?.value).toBe("Done");
	});

	test("empty userFilters + empty selection → returns the same empty array reference", () => {
		const empty: readonly FilterCondition[] = [];
		const out = composeEffectiveFilter({
			userFilters: empty,
			selection: EMPTY_SELECTION,
			myWidgetId: "w1",
		});
		expect(out).toBe(empty);
	});
});
