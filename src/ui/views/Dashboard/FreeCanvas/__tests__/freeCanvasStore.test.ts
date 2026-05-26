/**
 * freeCanvasStore.test.ts — coverage for window-state store + resolver wiring.
 * Ticket: #032.2.
 */

import { get } from "svelte/store";

import type { Rect } from "../collisionResolver";
import {
	createFreeCanvasStore,
	type FreeCanvasState,
	type WindowState,
} from "../freeCanvasStore";

function rect(id: string, x: number, y: number, w = 4, h = 3): Rect {
	return { id, x, y, w, h };
}

function win(id: string, x: number, y: number, opts: Partial<WindowState> = {}): WindowState {
	return {
		id,
		rect: rect(id, x, y, opts.rect?.w ?? 4, opts.rect?.h ?? 3),
		z: opts.z ?? 1,
		pinned: opts.pinned ?? false,
	};
}

describe("freeCanvasStore", () => {
	test("initial state defaults to empty windows array", () => {
		const store = createFreeCanvasStore();
		expect(get(store).windows).toEqual([]);
	});

	test("initial state is honoured if provided", () => {
		const seed: FreeCanvasState = { windows: [win("a", 0, 0)], interactingId: null };
		const store = createFreeCanvasStore(seed);
		expect(get(store).windows).toHaveLength(1);
		expect(get(store).windows[0]!.id).toBe("a");
	});

	test("addWindow appends; duplicate id is a no-op", () => {
		const store = createFreeCanvasStore();
		store.addWindow(win("a", 0, 0));
		store.addWindow(win("b", 10, 0));
		store.addWindow(win("a", 99, 99)); // duplicate
		const s = get(store);
		expect(s.windows.map((w) => w.id)).toEqual(["a", "b"]);
		// duplicate must not overwrite original
		expect(s.windows[0]!.rect.x).toBe(0);
	});

	test("removeWindow drops by id; unknown id is a no-op", () => {
		const store = createFreeCanvasStore({
			windows: [win("a", 0, 0), win("b", 10, 0)],
		});
		store.removeWindow("a");
		expect(get(store).windows.map((w) => w.id)).toEqual(["b"]);
		store.removeWindow("ghost");
		expect(get(store).windows.map((w) => w.id)).toEqual(["b"]);
	});

	test("moveWindow on isolated window updates rect.x / rect.y", () => {
		const store = createFreeCanvasStore({ windows: [win("a", 0, 0)] });
		const ok = store.moveWindow("a", { x: 20, y: 10 });
		expect(ok).toBe(true);
		const w = get(store).windows[0]!;
		expect(w.rect.x).toBe(20);
		expect(w.rect.y).toBe(10);
		expect(w.rect.id).toBe("a");
	});

	test("moveWindow with no delta is a no-op (returns false)", () => {
		const store = createFreeCanvasStore({ windows: [win("a", 5, 5)] });
		const ok = store.moveWindow("a", { x: 5, y: 5 });
		expect(ok).toBe(false);
		expect(get(store).windows[0]!.rect.x).toBe(5);
	});

	test("moveWindow on unknown id returns false, state unchanged", () => {
		const store = createFreeCanvasStore({ windows: [win("a", 0, 0)] });
		const before = get(store);
		const ok = store.moveWindow("ghost", { x: 1, y: 1 });
		expect(ok).toBe(false);
		expect(get(store)).toBe(before);
	});

	test("moveWindow into another window pushes the obstacle (drag = push)", () => {
		// a@(0,0,4x3), b@(5,0,4x3). Drag a horizontally by +3 → overlaps b.
		// Resolver in 'drag' mode pushes b right; both windows shift.
		const store = createFreeCanvasStore({
			windows: [win("a", 0, 0), win("b", 5, 0)],
		});
		const ok = store.moveWindow("a", { x: 3, y: 0 });
		expect(ok).toBe(true);
		const s = get(store);
		const a = s.windows.find((w) => w.id === "a")!;
		const b = s.windows.find((w) => w.id === "b")!;
		expect(a.rect.x).toBe(3);
		// b should have been pushed so that b.x >= a.x + a.w
		expect(b.rect.x).toBeGreaterThanOrEqual(a.rect.x + a.rect.w - 1e-4);
	});

	test("resizeWindow on isolated window updates rect.w / rect.h", () => {
		const store = createFreeCanvasStore({ windows: [win("a", 0, 0)] });
		const ok = store.resizeWindow("a", { w: 10, h: 8 });
		expect(ok).toBe(true);
		const w = get(store).windows[0]!;
		expect(w.rect.w).toBe(10);
		expect(w.rect.h).toBe(8);
	});

	test("resizeWindow with same size is a no-op", () => {
		const store = createFreeCanvasStore({ windows: [win("a", 0, 0)] });
		const ok = store.resizeWindow("a", { w: 4, h: 3 });
		expect(ok).toBe(false);
	});

	test("resizeWindow that would collide is clamped: if clamp impossible, no-op", () => {
		// a@(0,0,4x3), b@(5,0,4x3). Try to resize a to w=10 → would overlap b.
		// In 'resize' mode the resolver clamps; if clamp would violate
		// minimum size, it returns ok=false → store leaves state unchanged.
		const store = createFreeCanvasStore({
			windows: [win("a", 0, 0), win("b", 5, 0)],
		});
		const ok = store.resizeWindow("a", { w: 10, h: 3 });
		const a = get(store).windows.find((w) => w.id === "a")!;
		// Either the resolver clamped successfully (w<10, ok=true) or it bailed.
		if (ok) {
			expect(a.rect.w).toBeLessThanOrEqual(5 + 1e-4);
		} else {
			expect(a.rect.w).toBe(4); // untouched
		}
	});

	test("bringToFront raises z above all others", () => {
		const store = createFreeCanvasStore({
			windows: [
				win("a", 0, 0, { z: 1 }),
				win("b", 5, 0, { z: 5 }),
				win("c", 10, 0, { z: 3 }),
			],
		});
		store.bringToFront("a");
		const s = get(store);
		const a = s.windows.find((w) => w.id === "a")!;
		const b = s.windows.find((w) => w.id === "b")!;
		expect(a.z).toBeGreaterThan(b.z);
	});

	test("bringToFront on top window is a no-op (z unchanged)", () => {
		const store = createFreeCanvasStore({
			windows: [
				win("a", 0, 0, { z: 5 }),
				win("b", 5, 0, { z: 2 }),
			],
		});
		store.bringToFront("a");
		expect(get(store).windows.find((w) => w.id === "a")!.z).toBe(5);
	});

	test("setPinned toggles pinned flag without other changes", () => {
		const store = createFreeCanvasStore({ windows: [win("a", 0, 0)] });
		store.setPinned("a", true);
		expect(get(store).windows[0]!.pinned).toBe(true);
		store.setPinned("a", false);
		expect(get(store).windows[0]!.pinned).toBe(false);
	});

	test("store is reactive: subscribers receive updates", () => {
		const store = createFreeCanvasStore();
		const seen: number[] = [];
		const unsub = store.subscribe((s) => seen.push(s.windows.length));
		store.addWindow(win("a", 0, 0));
		store.addWindow(win("b", 5, 0));
		store.removeWindow("a");
		unsub();
		// initial + 3 changes = 4 snapshots
		expect(seen).toEqual([0, 1, 2, 1]);
	});

	// ── #039 — interaction lifecycle + atomic moveResize ─────────────
	describe("#039 — interaction lifecycle", () => {
		test("initial interactingId is null", () => {
			const store = createFreeCanvasStore();
			expect(get(store).interactingId).toBeNull();
		});

		test("beginInteraction sets interactingId; endInteraction clears it", () => {
			const store = createFreeCanvasStore({ windows: [win("a", 0, 0)] });
			store.beginInteraction("a");
			expect(get(store).interactingId).toBe("a");
			store.endInteraction();
			expect(get(store).interactingId).toBeNull();
		});

		test("beginInteraction is idempotent for the same id (state stays stable)", () => {
			const store = createFreeCanvasStore({ windows: [win("a", 0, 0)] });
			store.beginInteraction("a");
			const firstSnapshot = get(store);
			store.beginInteraction("a");
			const secondSnapshot = get(store);
			// Same id begin must not change the snapshot — referentially
			// stable so writers like DashboardCanvas write-back guard can
			// short-circuit cheaply.
			expect(firstSnapshot).toBe(secondSnapshot);
			expect(secondSnapshot.interactingId).toBe("a");
		});

		test("endInteraction on idle state keeps state referentially stable", () => {
			const store = createFreeCanvasStore({ windows: [win("a", 0, 0)] });
			const initial = get(store);
			store.endInteraction();
			expect(get(store)).toBe(initial);
		});

		test("moveResizeWindow updates both origin and dimensions atomically (one subscriber tick per gesture step)", () => {
			const store = createFreeCanvasStore({
				windows: [win("a", 4, 6, { rect: rect("a", 4, 6, 10, 8) })],
			});
			const seen: Array<{ x: number; y: number; w: number; h: number }> = [];
			const unsub = store.subscribe((s) => {
				const r = s.windows[0]?.rect;
				if (r) seen.push({ x: r.x, y: r.y, w: r.w, h: r.h });
			});
			store.moveResizeWindow("a", { x: 2, y: 4, w: 12, h: 10 });
			unsub();
			// initial(4,6) + one combined update(2,4) = 2 snapshots.
			// A naive move() + resize() would emit 3 snapshots (initial +
			// intermediate origin + final rect); the atomic action collapses
			// them into one mutation per gesture step.
			expect(seen).toHaveLength(2);
			expect(seen[1]).toEqual({ x: 2, y: 4, w: 12, h: 10 });
		});

		test("moveResizeWindow no-op when identical rect (stable snapshot)", () => {
			const store = createFreeCanvasStore({
				windows: [win("a", 4, 6, { rect: rect("a", 4, 6, 10, 8) })],
			});
			const before = get(store);
			const applied = store.moveResizeWindow("a", {
				x: 4,
				y: 6,
				w: 10,
				h: 8,
			});
			expect(applied).toBe(false);
			// NO_CHANGE path: factory returns the same state reference.
			expect(get(store)).toBe(before);
		});

		test("moveResizeWindow on unknown id returns false", () => {
			const store = createFreeCanvasStore({ windows: [win("a", 0, 0)] });
			expect(
				store.moveResizeWindow("ghost", { x: 0, y: 0, w: 1, h: 1 }),
			).toBe(false);
		});
	});
});
