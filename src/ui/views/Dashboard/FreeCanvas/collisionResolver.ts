/**
 * collisionResolver.ts — pure AABB collision resolver for Free Canvas.
 *
 * Spec: .ai_internal/New-specification/FREE_CANVAS_SPEC.md §3.6, §4, §5, §7.
 * Ticket: #032.1 (Phase 3 sub-PR 1).
 *
 * Pure function: no Svelte, no DOM, no Obsidian, no time, no random.
 * Coordinates are in rem (continuous, fractional allowed). Snap-to-grid is the
 * caller's responsibility — this module sees only numbers.
 */

/** AABB in rem-space (origin = top-left, axis = down-right). */
export interface Rect {
	readonly id: string;
	readonly x: number; // rem
	readonly y: number; // rem
	readonly w: number; // rem, > 0
	readonly h: number; // rem, > 0
}

/** Action initiating the collision check. */
export type CollisionMode =
	| { kind: "drag"; activeId: string; dx: number; dy: number }
	| { kind: "resize"; activeId: string; newW: number; newH: number };

/** Resolver result: new positions for affected windows. */
export interface ResolveResult {
	/** Final rect of the active window (after clamp or push-init). */
	readonly active: Rect;
	/**
	 * Only windows that moved/changed (minimal set).
	 * Iteration order matches the order of the corresponding rects in the
	 * input array — used by FreeCanvas to preserve relative z-order inside
	 * the pushed group (§7 collision priority).
	 */
	readonly moved: ReadonlyMap<string, Rect>;
	/** true iff the change preserves the no-overlap invariant. */
	readonly ok: boolean;
}

export interface ResolveOptions {
	/** Maximum cascade depth (number of cascaded pushes). Default: 8. */
	readonly depthLimit?: number;
	/** Minimum sizes for clamp mode, keyed by window id. */
	readonly minSizes?: ReadonlyMap<string, { minW: number; minH: number }>;
	/** Epsilon for AABB comparisons (rem). Default: 1e-4. */
	readonly epsilon?: number;
}

const DEFAULT_DEPTH_LIMIT = 8;
const DEFAULT_EPSILON = 1e-4;

/**
 * Resolve collisions for a drag or resize action.
 *
 * Contract:
 *   - `rects` must not contain mutually overlapping rectangles (input invariant).
 *   - `mode.activeId` must reference one of the rects.
 *   - Coordinates are rem; sub-rem (fractional) values are allowed.
 *   - Does not mutate input. Returns new objects for changed rects.
 *   - Deterministic: same input → same output.
 *
 * @throws Error if `activeId` is not present in `rects`.
 */
export function resolveCollision(
	rects: ReadonlyArray<Rect>,
	mode: CollisionMode,
	options?: ResolveOptions,
): ResolveResult {
	const active = rects.find((r) => r.id === mode.activeId);
	if (!active) {
		throw new Error("activeId not in rects");
	}

	const depthLimit = options?.depthLimit ?? DEFAULT_DEPTH_LIMIT;
	const epsilon = options?.epsilon ?? DEFAULT_EPSILON;

	if (mode.kind === "drag") {
		return resolveDrag(rects, active, mode.dx, mode.dy, depthLimit, epsilon);
	}
	return resolveResize(
		rects,
		active,
		mode.newW,
		mode.newH,
		options?.minSizes,
		epsilon,
	);
}

// ── Internals ────────────────────────────────────────────────────────────────

function aabbOverlap(a: Rect, b: Rect, eps: number): boolean {
	return (
		a.x + a.w > b.x + eps &&
		b.x + b.w > a.x + eps &&
		a.y + a.h > b.y + eps &&
		b.y + b.h > a.y + eps
	);
}

function resolveDrag(
	rects: ReadonlyArray<Rect>,
	active: Rect,
	dx: number,
	dy: number,
	depthLimit: number,
	eps: number,
): ResolveResult {
	// No-op fast path.
	if (dx === 0 && dy === 0) {
		return { active, moved: new Map(), ok: true };
	}

	const newActive: Rect = { ...active, x: active.x + dx, y: active.y + dy };

	// Push axis: dominant component of the movement vector.
	const horizontal = Math.abs(dx) >= Math.abs(dy);
	const dir = horizontal ? Math.sign(dx) : Math.sign(dy);

	// Working positions; key = id, value = current rect (original or pushed).
	const positions = new Map<string, Rect>();
	for (const r of rects) {
		positions.set(r.id, r);
	}
	positions.set(active.id, newActive);

	const movedRaw = new Map<string, Rect>();
	const queue: string[] = [active.id];

	while (queue.length > 0) {
		const currentId = queue.shift() as string;
		const currentRect = positions.get(currentId) as Rect;

		for (const other of rects) {
			if (other.id === active.id) continue; // active never pushed back
			if (other.id === currentId) continue;

			const otherPos = positions.get(other.id) as Rect;
			if (!aabbOverlap(currentRect, otherPos, eps)) continue;

			// Push along the dominant axis, in the direction of movement.
			let shifted: Rect;
			if (horizontal) {
				const shift =
					dir > 0
						? currentRect.x + currentRect.w - otherPos.x
						: currentRect.x - (otherPos.x + otherPos.w);
				shifted = { ...otherPos, x: otherPos.x + shift };
			} else {
				const shift =
					dir > 0
						? currentRect.y + currentRect.h - otherPos.y
						: currentRect.y - (otherPos.y + otherPos.h);
				shifted = { ...otherPos, y: otherPos.y + shift };
			}

			positions.set(other.id, shifted);
			movedRaw.set(other.id, shifted);
			queue.push(other.id);

			// Cascade exceeded → abort.
			if (movedRaw.size > depthLimit) {
				return { active, moved: new Map(), ok: false };
			}
		}
	}

	// Rebuild `moved` in input-rects order to preserve relative z-order (§7).
	const moved = new Map<string, Rect>();
	for (const r of rects) {
		const m = movedRaw.get(r.id);
		if (m !== undefined) moved.set(r.id, m);
	}

	return { active: newActive, moved, ok: true };
}

function resolveResize(
	rects: ReadonlyArray<Rect>,
	active: Rect,
	newW: number,
	newH: number,
	minSizes: ReadonlyMap<string, { minW: number; minH: number }> | undefined,
	eps: number,
): ResolveResult {
	const minSize = minSizes?.get(active.id);
	const minW = minSize?.minW ?? 0;
	const minH = minSize?.minH ?? 0;

	if (newW < minW || newH < minH) {
		return { active, moved: new Map(), ok: false };
	}

	let w = newW;
	let h = newH;

	// Clamp width: by the input no-overlap invariant, only neighbours strictly
	// to the right of active's original right edge can block rightward growth.
	for (const other of rects) {
		if (other.id === active.id) continue;
		if (other.x < active.x + active.w - eps) continue; // not rightward
		const yBandTop = Math.max(active.y, other.y);
		const yBandBottom = Math.min(active.y + h, other.y + other.h);
		if (yBandBottom - yBandTop <= eps) continue; // no vertical overlap
		if (other.x < active.x + w) {
			const maxW = other.x - active.x;
			if (maxW < w) w = maxW;
		}
	}

	// Clamp height: only neighbours strictly below active's original bottom edge
	// can block downward growth. Use possibly-updated w for x-band consistency.
	for (const other of rects) {
		if (other.id === active.id) continue;
		if (other.y < active.y + active.h - eps) continue; // not downward
		const xBandLeft = Math.max(active.x, other.x);
		const xBandRight = Math.min(active.x + w, other.x + other.w);
		if (xBandRight - xBandLeft <= eps) continue;
		if (other.y < active.y + h) {
			const maxH = other.y - active.y;
			if (maxH < h) h = maxH;
		}
	}

	if (w < minW || h < minH) {
		return { active, moved: new Map(), ok: false };
	}

	const newActive: Rect = { ...active, w, h };
	return { active: newActive, moved: new Map(), ok: true };
}
