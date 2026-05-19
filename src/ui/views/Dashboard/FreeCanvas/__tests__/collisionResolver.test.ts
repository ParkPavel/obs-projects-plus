/**
 * collisionResolver.test.ts — unit tests for pure AABB resolver.
 *
 * Spec: FREE_CANVAS_SPEC.md §3.6, §7.
 * Ticket: #032.1.
 */

import {
	resolveCollision,
	type Rect,
} from "../collisionResolver";

const r = (id: string, x: number, y: number, w: number, h: number): Rect => ({
	id,
	x,
	y,
	w,
	h,
});

describe("collisionResolver — drag (push) mode", () => {
	test("no collision → pass-through (only active moves)", () => {
		const rects = [r("A", 0, 0, 2, 2), r("B", 10, 10, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "A",
			dx: 1,
			dy: 0,
		});
		expect(result.ok).toBe(true);
		expect(result.active).toEqual({ id: "A", x: 1, y: 0, w: 2, h: 2 });
		expect(result.moved.size).toBe(0);
	});

	test("single overlap → neighbour pushed along movement axis", () => {
		const rects = [r("A", 0, 0, 2, 2), r("B", 2, 0, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "A",
			dx: 1,
			dy: 0,
		});
		expect(result.ok).toBe(true);
		expect(result.active).toEqual({ id: "A", x: 1, y: 0, w: 2, h: 2 });
		expect(result.moved.get("B")).toEqual({ id: "B", x: 3, y: 0, w: 2, h: 2 });
		expect(result.moved.size).toBe(1);
	});

	test("cascade — A pushes B pushes C along the row", () => {
		const rects = [
			r("act", 0, 0, 2, 2),
			r("A", 2, 0, 2, 2),
			r("B", 4, 0, 2, 2),
			r("C", 6, 0, 2, 2),
		];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "act",
			dx: 1,
			dy: 0,
		});
		expect(result.ok).toBe(true);
		expect(result.active.x).toBe(1);
		expect(result.moved.get("A")).toEqual({ id: "A", x: 3, y: 0, w: 2, h: 2 });
		expect(result.moved.get("B")).toEqual({ id: "B", x: 5, y: 0, w: 2, h: 2 });
		expect(result.moved.get("C")).toEqual({ id: "C", x: 7, y: 0, w: 2, h: 2 });
		expect(result.moved.size).toBe(3);
	});

	test("pushed window does not return to active (active never in moved)", () => {
		const rects = [r("act", 0, 0, 2, 2), r("X", 2, 0, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "act",
			dx: 1,
			dy: 0,
		});
		expect(result.ok).toBe(true);
		expect(result.moved.has("act")).toBe(false);
		expect(result.moved.get("X")?.x).toBe(3);
	});

	test("active window is never pushed backward by neighbours", () => {
		// Place a neighbour 'behind' active; only forward push happens, not backward.
		const rects = [
			r("act", 4, 0, 2, 2),
			r("behind", 2, 0, 2, 2),
			r("front", 6, 0, 2, 2),
		];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "act",
			dx: 1,
			dy: 0,
		});
		expect(result.ok).toBe(true);
		expect(result.active).toEqual({ id: "act", x: 5, y: 0, w: 2, h: 2 });
		// 'front' was at (6, …); active right is now 7 → front pushed to 7.
		expect(result.moved.get("front")?.x).toBe(7);
		// 'behind' is not in the movement direction and must not appear.
		expect(result.moved.has("behind")).toBe(false);
		expect(result.moved.has("act")).toBe(false);
	});

	test("cascade exceeding depthLimit → ok=false, no movement applied", () => {
		const rects = [
			r("act", 0, 0, 2, 2),
			r("A", 2, 0, 2, 2),
			r("B", 4, 0, 2, 2),
			r("C", 6, 0, 2, 2),
		];
		const result = resolveCollision(
			rects,
			{ kind: "drag", activeId: "act", dx: 1, dy: 0 },
			{ depthLimit: 2 },
		);
		expect(result.ok).toBe(false);
		expect(result.moved.size).toBe(0);
		// Active reported as original (unchanged) when escape hatch triggers.
		expect(result.active).toEqual({ id: "act", x: 0, y: 0, w: 2, h: 2 });
	});

	test("pushed-group preserves relative z-order (input-rects order)", () => {
		// Layout: active at left, then B then A (in screen order), but input order
		// declares A before B. Push order is B → A, but moved iteration must yield
		// A first to match input z-order.
		const rects = [
			r("act", 0, 0, 5, 2),
			r("A", 7, 0, 2, 2),
			r("B", 5, 0, 2, 2),
		];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "act",
			dx: 1,
			dy: 0,
		});
		expect(result.ok).toBe(true);
		const order = Array.from(result.moved.keys());
		expect(order).toEqual(["A", "B"]);
	});

	test("no-op drag (dx=0, dy=0) → ok=true, nothing moved", () => {
		const rects = [r("A", 0, 0, 2, 2), r("B", 2, 0, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "A",
			dx: 0,
			dy: 0,
		});
		expect(result.ok).toBe(true);
		expect(result.moved.size).toBe(0);
		expect(result.active).toEqual(rects[0]);
	});

	test("vertical drag pushes neighbours along y-axis", () => {
		const rects = [r("act", 0, 0, 2, 2), r("below", 0, 2, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "act",
			dx: 0,
			dy: 1,
		});
		expect(result.ok).toBe(true);
		expect(result.active.y).toBe(1);
		expect(result.moved.get("below")).toEqual({
			id: "below",
			x: 0,
			y: 3,
			w: 2,
			h: 2,
		});
	});
});

describe("collisionResolver — resize (clamp) mode", () => {
	test("no collision → resize applied as-is", () => {
		const rects = [r("A", 0, 0, 2, 2), r("B", 10, 10, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "resize",
			activeId: "A",
			newW: 4,
			newH: 4,
		});
		expect(result.ok).toBe(true);
		expect(result.active).toEqual({ id: "A", x: 0, y: 0, w: 4, h: 4 });
		expect(result.moved.size).toBe(0);
	});

	test("resize right hits neighbour → width clamped, neighbours untouched", () => {
		const rects = [r("A", 0, 0, 2, 2), r("B", 5, 0, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "resize",
			activeId: "A",
			newW: 10,
			newH: 2,
		});
		expect(result.ok).toBe(true);
		expect(result.active.w).toBe(5);
		expect(result.active.h).toBe(2);
		expect(result.moved.size).toBe(0);
	});

	test("resize down hits neighbour → height clamped", () => {
		const rects = [r("A", 0, 0, 2, 2), r("B", 0, 5, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "resize",
			activeId: "A",
			newW: 2,
			newH: 10,
		});
		expect(result.ok).toBe(true);
		expect(result.active.h).toBe(5);
		expect(result.moved.size).toBe(0);
	});

	test("resize hits multiple neighbours → clamp to the nearest", () => {
		const rects = [
			r("A", 0, 0, 2, 2),
			r("near", 4, 0, 2, 2),
			r("far", 8, 0, 2, 2),
		];
		const result = resolveCollision(rects, {
			kind: "resize",
			activeId: "A",
			newW: 12,
			newH: 2,
		});
		expect(result.ok).toBe(true);
		expect(result.active.w).toBe(4); // clamped at 'near'
	});

	test("requested size below minSize → ok=false, no change", () => {
		const rects = [r("A", 0, 0, 5, 5)];
		const minSizes = new Map<string, { minW: number; minH: number }>([
			["A", { minW: 3, minH: 3 }],
		]);
		const result = resolveCollision(
			rects,
			{ kind: "resize", activeId: "A", newW: 2, newH: 5 },
			{ minSizes },
		);
		expect(result.ok).toBe(false);
		expect(result.active).toEqual(rects[0]);
	});

	test("clamped size below minSize → ok=false, no change", () => {
		// Neighbour is 1 rem to the right, but minW is 4 → cannot clamp to 1.
		const rects = [r("A", 0, 0, 1, 2), r("B", 1, 0, 2, 2)];
		const minSizes = new Map<string, { minW: number; minH: number }>([
			["A", { minW: 4, minH: 1 }],
		]);
		const result = resolveCollision(
			rects,
			{ kind: "resize", activeId: "A", newW: 10, newH: 2 },
			{ minSizes },
		);
		expect(result.ok).toBe(false);
		expect(result.moved.size).toBe(0);
	});
});

describe("collisionResolver — edge cases", () => {
	test("empty others array → trivial pass-through", () => {
		const rects = [r("only", 0, 0, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "only",
			dx: 3,
			dy: 4,
		});
		expect(result.ok).toBe(true);
		expect(result.active).toEqual({ id: "only", x: 3, y: 4, w: 2, h: 2 });
		expect(result.moved.size).toBe(0);
	});

	test("touching edges (no overlap) → not treated as collision", () => {
		const rects = [r("A", 0, 0, 2, 2), r("B", 2, 0, 2, 2)];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "A",
			dx: 0,
			dy: 0,
		});
		expect(result.ok).toBe(true);
		expect(result.moved.size).toBe(0);
	});

	test("sub-rem precision (0.5 rem) preserved through push", () => {
		const rects = [r("A", 0, 0, 1.5, 1.5), r("B", 1.5, 0, 1.5, 1.5)];
		const result = resolveCollision(rects, {
			kind: "drag",
			activeId: "A",
			dx: 0.5,
			dy: 0,
		});
		expect(result.ok).toBe(true);
		expect(result.active.x).toBeCloseTo(0.5, 6);
		const pushedB = result.moved.get("B");
		expect(pushedB).toBeDefined();
		expect(pushedB?.x).toBeCloseTo(2, 6);
	});

	test("activeId not in rects → throws", () => {
		const rects = [r("A", 0, 0, 2, 2)];
		expect(() =>
			resolveCollision(rects, {
				kind: "drag",
				activeId: "ghost",
				dx: 1,
				dy: 0,
			}),
		).toThrow(/activeId not in rects/);
	});

	test("deterministic output for same input", () => {
		const rects = [
			r("act", 0, 0, 2, 2),
			r("A", 2, 0, 2, 2),
			r("B", 4, 0, 2, 2),
		];
		const a = resolveCollision(rects, {
			kind: "drag",
			activeId: "act",
			dx: 1,
			dy: 0,
		});
		const b = resolveCollision(rects, {
			kind: "drag",
			activeId: "act",
			dx: 1,
			dy: 0,
		});
		expect(a.ok).toBe(b.ok);
		expect(a.active).toEqual(b.active);
		expect(Array.from(a.moved.entries())).toEqual(
			Array.from(b.moved.entries()),
		);
	});
});
