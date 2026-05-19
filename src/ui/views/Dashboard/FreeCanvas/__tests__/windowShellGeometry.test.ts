/**
 * windowShellGeometry.test.ts — pure geometry unit tests.
 *
 * Spec: FREE_CANVAS_SPEC.md §6.x.
 * Ticket: #032.3.
 */

import {
	computeAnchor,
	computeDragTarget,
	computeResizeTarget,
	DEFAULT_ROOT_FONT_SIZE_PX,
	pxToRem,
	readRootFontSizePx,
	remToPx,
	type RectGeometry,
} from "../windowShellGeometry";

const RECT: RectGeometry = { x: 4, y: 6, w: 10, h: 8 };

describe("px/rem conversion", () => {
	test("pxToRem divides by root font-size", () => {
		expect(pxToRem(32, 16)).toBe(2);
		expect(pxToRem(24, 16)).toBe(1.5);
	});

	test("remToPx multiplies by root font-size", () => {
		expect(remToPx(2, 16)).toBe(32);
		expect(remToPx(1.5, 16)).toBe(24);
	});

	test("round-trip is identity", () => {
		const px = 123.5;
		expect(remToPx(pxToRem(px, 16), 16)).toBeCloseTo(px, 10);
	});

	test("throws on non-positive root font-size", () => {
		expect(() => pxToRem(10, 0)).toThrow();
		expect(() => remToPx(10, -1)).toThrow();
	});
});

describe("computeDragTarget", () => {
	test("preserves width/height", () => {
		const next = computeDragTarget(
			{ x: 20, y: 15 },
			{ x: 2, y: 3 },
			RECT,
		);
		expect(next.w).toBe(RECT.w);
		expect(next.h).toBe(RECT.h);
	});

	test("translates top-left by (pointer - dragOffset)", () => {
		// pointer 20,15 ; offset 2,3 → new top-left 18,12
		const next = computeDragTarget(
			{ x: 20, y: 15 },
			{ x: 2, y: 3 },
			RECT,
		);
		expect(next.x).toBe(18);
		expect(next.y).toBe(12);
	});

	test("zero offset means pointer becomes top-left", () => {
		const next = computeDragTarget(
			{ x: 7, y: 9 },
			{ x: 0, y: 0 },
			RECT,
		);
		expect(next.x).toBe(7);
		expect(next.y).toBe(9);
	});

	test("negative coords are allowed (canvas is infinite)", () => {
		const next = computeDragTarget(
			{ x: -3, y: -5 },
			{ x: 1, y: 1 },
			RECT,
		);
		expect(next.x).toBe(-4);
		expect(next.y).toBe(-6);
	});
});

describe("computeAnchor", () => {
	test("SE handle pins top-left", () => {
		expect(computeAnchor(RECT, "SE")).toEqual({ x: 4, y: 6 });
	});

	test("NW handle pins bottom-right", () => {
		expect(computeAnchor(RECT, "NW")).toEqual({ x: 14, y: 14 });
	});

	test("NE handle pins bottom-left", () => {
		expect(computeAnchor(RECT, "NE")).toEqual({ x: 4, y: 14 });
	});

	test("SW handle pins top-right", () => {
		expect(computeAnchor(RECT, "SW")).toEqual({ x: 14, y: 6 });
	});

	test("edge handles pin opposite edge", () => {
		expect(computeAnchor(RECT, "N").y).toBe(14); // bottom
		expect(computeAnchor(RECT, "S").y).toBe(6); // top
		expect(computeAnchor(RECT, "E").x).toBe(4); // left
		expect(computeAnchor(RECT, "W").x).toBe(14); // right
	});
});

describe("computeResizeTarget — SE handle (top-left anchored)", () => {
	const anchor = computeAnchor(RECT, "SE"); // {x:4, y:6}

	test("growing south-east updates w/h, keeps top-left", () => {
		const next = computeResizeTarget(
			{ x: 16, y: 18 },
			anchor,
			RECT,
			"SE",
		);
		expect(next).toEqual({ x: 4, y: 6, w: 12, h: 12 });
	});

	test("shrinking below min clamps w/h", () => {
		const next = computeResizeTarget(
			{ x: 4.1, y: 6.1 },
			anchor,
			RECT,
			"SE",
			{ w: 2, h: 3 },
		);
		expect(next.x).toBe(4);
		expect(next.y).toBe(6);
		expect(next.w).toBe(2);
		expect(next.h).toBe(3);
	});
});

describe("computeResizeTarget — NW handle (bottom-right anchored)", () => {
	const anchor = computeAnchor(RECT, "NW"); // {x:14, y:14}

	test("moving pointer toward upper-left grows the rect", () => {
		const next = computeResizeTarget(
			{ x: 2, y: 4 },
			anchor,
			RECT,
			"NW",
		);
		expect(next).toEqual({ x: 2, y: 4, w: 12, h: 10 });
	});

	test("crossing anchor clamps via minSize, anchor stays fixed", () => {
		const next = computeResizeTarget(
			{ x: 20, y: 20 },
			anchor,
			RECT,
			"NW",
			{ w: 1, h: 1 },
		);
		// pointer past anchor → newLeft = min(20, 14-1)=13; newTop similarly
		expect(next.x).toBe(13);
		expect(next.y).toBe(13);
		expect(next.w).toBe(1);
		expect(next.h).toBe(1);
	});
});

describe("computeResizeTarget — edge handles", () => {
	test("E handle drives only width", () => {
		const anchor = computeAnchor(RECT, "E");
		const next = computeResizeTarget(
			{ x: 20, y: 99 }, // y is ignored
			anchor,
			RECT,
			"E",
		);
		expect(next.y).toBe(RECT.y);
		expect(next.h).toBe(RECT.h);
		expect(next.x).toBe(RECT.x);
		expect(next.w).toBe(16);
	});

	test("N handle drives only height (top moves, bottom anchored)", () => {
		const anchor = computeAnchor(RECT, "N"); // y = 14 (bottom)
		const next = computeResizeTarget(
			{ x: 99, y: 2 },
			anchor,
			RECT,
			"N",
		);
		expect(next.x).toBe(RECT.x);
		expect(next.w).toBe(RECT.w);
		expect(next.y).toBe(2);
		expect(next.h).toBe(12);
	});

	test("W handle drives only x/width", () => {
		const anchor = computeAnchor(RECT, "W"); // x = 14
		const next = computeResizeTarget(
			{ x: 1, y: 99 },
			anchor,
			RECT,
			"W",
		);
		expect(next.y).toBe(RECT.y);
		expect(next.h).toBe(RECT.h);
		expect(next.x).toBe(1);
		expect(next.w).toBe(13);
	});
});

describe("readRootFontSizePx", () => {
	test("returns default when document is undefined", () => {
		expect(readRootFontSizePx(undefined)).toBe(DEFAULT_ROOT_FONT_SIZE_PX);
	});

	test("returns parsed value in jsdom", () => {
		const v = readRootFontSizePx();
		expect(v).toBeGreaterThan(0);
		expect(Number.isFinite(v)).toBe(true);
	});
});
