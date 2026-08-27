/**
 * selectionStore.test.ts — coverage for #044.1 selection store + pure composer.
 */

import { get } from "svelte/store";
import type { FilterCondition } from "src/settings/base/settings";

import {
	EMPTY_SELECTION,
	bindEscapeClear,
	composeEffectiveFilter,
	createSelectionStore,
	type SelectionState,
} from "../canvasSelectionStore";
import type { LinkedSelectionConfig } from "../types";

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
			values: ["Active"],
			op: "is",
		};
		const store = createSelectionStore(seed);
		expect(get(store)).toEqual(seed);
	});

	test("setSelection writes the new state and defaults op to 'is'", () => {
		const store = createSelectionStore();
		store.setSelection({ source: "chart:w1", field: "status", values: ["Done"] });
		const next = get(store);
		expect(next).toEqual({ source: "chart:w1", field: "status", values: ["Done"], op: "is" });
	});

	test("setSelection with identical payload is a no-op (no notification)", () => {
		const store = createSelectionStore();
		store.setSelection({ source: "chart:w1", field: "status", values: ["Done"] });
		let calls = 0;
		const unsub = store.subscribe(() => {
			calls++;
		});
		// subscribe fires once synchronously with the current value
		expect(calls).toBe(1);
		store.setSelection({ source: "chart:w1", field: "status", values: ["Done"] });
		expect(calls).toBe(1); // no extra notification
		unsub();
	});

	test("setSelection with different value fires a notification", () => {
		const store = createSelectionStore();
		store.setSelection({ source: "chart:w1", field: "status", values: ["Done"] });
		let calls = 0;
		const unsub = store.subscribe(() => {
			calls++;
		});
		expect(calls).toBe(1);
		store.setSelection({ source: "chart:w1", field: "status", values: ["Active"] });
		expect(calls).toBe(2);
		unsub();
	});

	test("clearSelection returns to EMPTY_SELECTION", () => {
		const store = createSelectionStore();
		store.setSelection({ source: "chart:w1", field: "status", values: ["Done"] });
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
			values: ["Done"],
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
			values: ["Done"],
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
			values: ["Projects/Alpha.md"],
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
			values: ["Done"],
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

describe("composeEffectiveFilter — linked selection (E7 parity tests)", () => {
	const ls: LinkedSelectionConfig = { sourceWidgetId: "block-a", relationField: "client" };

	it("no linked condition when linkedSelection is undefined regardless of canvas selection", () => {
		const sel: SelectionState = {
			source: "data-table:block-a",
			field: "name",
			values: ["ivan-petrov"],
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: sel,
			myWidgetId: "block-b",
		});
		// Without linkedSelection, the canvas condition uses selection.field ("name")
		expect(out).toHaveLength(1);
		expect(out[0]?.field).toBe("name");
	});

	it("no linked condition when selection is empty (EMPTY_SELECTION)", () => {
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: EMPTY_SELECTION,
			myWidgetId: "block-b",
			linkedSelection: ls,
			validationResult: "valid",
		});
		expect(out).toHaveLength(0);
	});

	it("linked condition on master data-table selection when validationResult is valid", () => {
		const sel: SelectionState = {
			source: "data-table:block-a",
			field: "name",
			values: ["ivan-petrov"],
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: sel,
			myWidgetId: "block-b",
			linkedSelection: ls,
			validationResult: "valid",
		});
		expect(out).toHaveLength(1);
		expect(out[0]).toEqual({
			field: "client",
			operator: "is",
			value: "ivan-petrov",
			enabled: true,
		});
	});

	it("linked condition on master chart selection when validationResult is valid", () => {
		const sel: SelectionState = {
			source: "chart:block-a",
			field: "status",
			values: ["active"],
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: sel,
			myWidgetId: "block-b",
			linkedSelection: ls,
			validationResult: "valid",
		});
		expect(out).toHaveLength(1);
		expect(out[0]).toEqual({
			field: "client",
			operator: "is",
			value: "active",
			enabled: true,
		});
	});

	it("no linked condition when selection is from a different master block", () => {
		const sel: SelectionState = {
			source: "data-table:block-b",
			field: "name",
			values: ["some-value"],
			op: "is",
		};
		// block-a is the master but block-b is driving — linked condition absent;
		// canvas condition uses selection.field since myWidgetId != "block-b" would skip
		// but here myWidgetId is "receiver" so canvas condition is added
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: sel,
			myWidgetId: "receiver",
			linkedSelection: ls,
			validationResult: "valid",
		});
		// linked condition skipped (different source); canvas condition added
		expect(out).toHaveLength(1);
		expect(out[0]?.field).toBe("name");
	});

	it("uses relationField (not selection field) as the filter field when valid", () => {
		const lsRef: LinkedSelectionConfig = { sourceWidgetId: "block-a", relationField: "clientRef" };
		const sel: SelectionState = {
			source: "data-table:block-a",
			field: "id",
			values: ["42"],
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: sel,
			myWidgetId: "block-b",
			linkedSelection: lsRef,
			validationResult: "valid",
		});
		expect(out).toHaveLength(1);
		expect(out[0]?.field).toBe("clientRef");
		expect(out[0]?.value).toBe("42");
	});

	it("skips linked condition when validationResult is missing-relation", () => {
		const sel: SelectionState = {
			source: "data-table:block-a",
			field: "name",
			values: ["ivan-petrov"],
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: sel,
			myWidgetId: "block-b",
			linkedSelection: ls,
			validationResult: "missing-relation",
		});
		// Linked skipped; canvas condition falls through with selection.field
		expect(out).toHaveLength(1);
		expect(out[0]?.field).toBe("name");
	});

	it("skips linked condition when validationResult is wrong-target-project", () => {
		const sel: SelectionState = {
			source: "data-table:block-a",
			field: "name",
			values: ["ivan-petrov"],
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: sel,
			myWidgetId: "block-b",
			linkedSelection: ls,
			validationResult: "wrong-target-project",
		});
		expect(out).toHaveLength(1);
		expect(out[0]?.field).toBe("name");
	});

	it("skips linked condition when validationResult is invalid-field", () => {
		const sel: SelectionState = {
			source: "data-table:block-a",
			field: "name",
			values: ["ivan-petrov"],
			op: "is",
		};
		const out = composeEffectiveFilter({
			userFilters: [],
			selection: sel,
			myWidgetId: "block-b",
			linkedSelection: ls,
			validationResult: "invalid-field",
		});
		expect(out).toHaveLength(1);
		expect(out[0]?.field).toBe("name");
	});

	it("userFilters unchanged (reference-equal) when nothing narrows", () => {
		const base: readonly import("src/settings/base/settings").FilterCondition[] = [cond("priority", "high")];
		const out = composeEffectiveFilter({
			userFilters: base,
			selection: EMPTY_SELECTION,
			myWidgetId: "block-b",
			linkedSelection: ls,
			validationResult: "valid",
		});
		expect(out).toBe(base);
	});
});

describe("bindEscapeClear — #106 Escape clears the canvas selection", () => {
	function activeStore() {
		const store = createSelectionStore();
		store.setSelection({ source: "data-table:block-a", field: "name", values: ["Acme"] });
		return store;
	}

	it("clears the active selection on Escape keydown (capture phase)", () => {
		const store = activeStore();
		const unbind = bindEscapeClear(store);
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(get(store)).toBe(EMPTY_SELECTION);
		unbind();
	});

	it("ignores non-Escape keys", () => {
		const store = activeStore();
		const unbind = bindEscapeClear(store);
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(get(store).source).toBe("data-table:block-a");
		unbind();
	});

	it("unbind removes the listener (Escape no longer clears)", () => {
		const store = activeStore();
		const unbind = bindEscapeClear(store);
		unbind();
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(get(store).source).toBe("data-table:block-a");
	});

	it("clears even when a focused child stops propagation on the bubbling phase", () => {
		const store = activeStore();
		const unbind = bindEscapeClear(store);
		const child = document.createElement("input");
		document.body.appendChild(child);
		child.addEventListener("keydown", (e) => e.stopPropagation());
		child.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
		);
		expect(get(store)).toBe(EMPTY_SELECTION);
		child.remove();
		unbind();
	});
});
