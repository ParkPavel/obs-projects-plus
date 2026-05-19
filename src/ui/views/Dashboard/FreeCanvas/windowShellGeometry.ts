/**
 * windowShellGeometry.ts — pure geometry helpers for WindowShell drag/resize.
 *
 * Spec: .ai_internal/New-specification/FREE_CANVAS_SPEC.md §6.x.
 * Ticket: #032.3 (Phase 3 sub-PR 3).
 *
 * No DOM, no Svelte, no Obsidian. Deterministic functions over (rem,rem)
 * coordinates. Conversion px↔rem is provided so callers can normalise raw
 * pointer events at the boundary, but the geometry math itself is unit-agnostic
 * (we treat everything as rem for clarity).
 */

/** Pointer or anchor in rem-space. */
export interface Point {
	readonly x: number;
	readonly y: number;
}

/** AABB in rem-space; `w`/`h` strictly positive. */
export interface RectGeometry {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
}

/** 8 resize handles: 4 corners + 4 edge midpoints. */
export type ResizeHandle =
	| "N"
	| "S"
	| "E"
	| "W"
	| "NE"
	| "NW"
	| "SE"
	| "SW";

/** Fallback root font-size when `getComputedStyle` is unavailable (SSR/tests). */
export const DEFAULT_ROOT_FONT_SIZE_PX = 16;

const DEFAULT_MIN_SIZE: { w: number; h: number } = { w: 1, h: 1 };

export function pxToRem(px: number, rootFontSizePx: number): number {
	if (rootFontSizePx <= 0) {
		throw new Error("rootFontSizePx must be > 0");
	}
	return px / rootFontSizePx;
}

export function remToPx(rem: number, rootFontSizePx: number): number {
	if (rootFontSizePx <= 0) {
		throw new Error("rootFontSizePx must be > 0");
	}
	return rem * rootFontSizePx;
}

/**
 * Compute new rect for a drag gesture.
 *
 * `dragOffset` is the vector captured at `pointerdown` (pointer minus
 * `rect.topLeft`) so that the grabbed point under the cursor stays fixed.
 * Width/height are preserved verbatim — drag never resizes.
 */
export function computeDragTarget(
	pointerRem: Point,
	dragOffsetRem: Point,
	currentRect: RectGeometry,
): RectGeometry {
	return {
		x: pointerRem.x - dragOffsetRem.x,
		y: pointerRem.y - dragOffsetRem.y,
		w: currentRect.w,
		h: currentRect.h,
	};
}

/**
 * Anchor point (fixed corner/edge) for a given resize handle.
 * The anchor stays put while the pointer drags the opposite side.
 *
 * Edge handles return the midpoint of the opposite edge for symmetry; only the
 * relevant coordinate is consumed by {@link computeResizeTarget}.
 */
export function computeAnchor(
	rect: RectGeometry,
	handle: ResizeHandle,
): Point {
	const left = rect.x;
	const right = rect.x + rect.w;
	const top = rect.y;
	const bottom = rect.y + rect.h;
	const midX = rect.x + rect.w / 2;
	const midY = rect.y + rect.h / 2;

	switch (handle) {
		case "N":
			return { x: midX, y: bottom };
		case "S":
			return { x: midX, y: top };
		case "E":
			return { x: left, y: midY };
		case "W":
			return { x: right, y: midY };
		case "NE":
			return { x: left, y: bottom };
		case "NW":
			return { x: right, y: bottom };
		case "SE":
			return { x: left, y: top };
		case "SW":
			return { x: right, y: top };
	}
}

/**
 * Compute new rect for a resize gesture from `anchor` toward `pointerRem`.
 *
 * Anchor is the fixed opposite corner/edge (see {@link computeAnchor}).
 * The handle decides which axes are driven by the pointer; the others are
 * preserved from `currentRect`.
 *
 * `minSize` clamps the gesture so the rect never collapses past the minimum.
 * The clamp is applied on the active side, so the *anchor stays stable*
 * (right edge of an `N` handle does not jump).
 */
export function computeResizeTarget(
	pointerRem: Point,
	anchor: Point,
	currentRect: RectGeometry,
	handle: ResizeHandle,
	minSize: { w: number; h: number } = DEFAULT_MIN_SIZE,
): RectGeometry {
	const drivesRight = handle === "E" || handle === "SE" || handle === "NE";
	const drivesLeft = handle === "W" || handle === "SW" || handle === "NW";
	const drivesBottom = handle === "S" || handle === "SE" || handle === "SW";
	const drivesTop = handle === "N" || handle === "NE" || handle === "NW";

	let x = currentRect.x;
	let y = currentRect.y;
	let w = currentRect.w;
	let h = currentRect.h;

	if (drivesRight) {
		// Anchor is the left edge (x = anchor.x). Width = pointer.x − anchor.x.
		w = Math.max(minSize.w, pointerRem.x - anchor.x);
		x = anchor.x;
	} else if (drivesLeft) {
		// Anchor is the right edge. Width = anchor.x − pointer.x.
		const right = anchor.x;
		const newLeft = Math.min(pointerRem.x, right - minSize.w);
		x = newLeft;
		w = right - newLeft;
	}

	if (drivesBottom) {
		// Anchor is the top edge.
		h = Math.max(minSize.h, pointerRem.y - anchor.y);
		y = anchor.y;
	} else if (drivesTop) {
		// Anchor is the bottom edge.
		const bottom = anchor.y;
		const newTop = Math.min(pointerRem.y, bottom - minSize.h);
		y = newTop;
		h = bottom - newTop;
	}

	return { x, y, w, h };
}

/**
 * Read the document root font-size in px. Returns {@link DEFAULT_ROOT_FONT_SIZE_PX}
 * when called outside a browser (jsdom test bed leaves the value as `""`).
 */
export function readRootFontSizePx(
	doc: Document | undefined = typeof document !== "undefined"
		? document
		: undefined,
): number {
	if (!doc || typeof getComputedStyle !== "function") {
		return DEFAULT_ROOT_FONT_SIZE_PX;
	}
	const raw = getComputedStyle(doc.documentElement).fontSize;
	const parsed = parseFloat(raw);
	return Number.isFinite(parsed) && parsed > 0
		? parsed
		: DEFAULT_ROOT_FONT_SIZE_PX;
}
