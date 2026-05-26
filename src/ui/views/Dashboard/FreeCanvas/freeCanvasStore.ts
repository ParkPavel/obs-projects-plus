/**
 * freeCanvasStore.ts — Svelte writable store for Free Canvas window state.
 *
 * Spec: .ai_internal/New-specification/FREE_CANVAS_SPEC.md §3, §5, §7.
 * Ticket: #032.2 (Phase 3 sub-PR 2).
 *
 * Owns the set of windows on the canvas in rem-coordinates and routes
 * every move/resize through the pure {@link resolveCollision} resolver
 * (#032.1). If the resolver returns `ok=false` the action is a no-op
 * (escape hatch — see §5 collision contract).
 *
 * Does not touch the DOM. Does not save to disk. Does not snap to grid
 * (caller's job). Pure state with deterministic transitions.
 */

import { writable, type Writable } from "svelte/store";

import {
	resolveCollision,
	type CollisionMode,
	type Rect,
	type ResolveOptions,
} from "./collisionResolver";

/** Per-window canvas state. `rect.id` must equal `id`. */
export interface WindowState {
	readonly id: string;
	readonly rect: Rect;
	readonly z: number;
	readonly pinned: boolean;
}

/** Aggregate store state. */
export interface FreeCanvasState {
	readonly windows: ReadonlyArray<WindowState>;
	/**
	 * #039 — id of the window currently being interactively dragged/resized,
	 * or `null` between gestures. Subscribers (e.g. DashboardCanvas
	 * write-back) use this flag to suppress disk persistence during the
	 * gesture and flush exactly once on `endInteraction`. Always reflects
	 * a single active gesture (no nested gestures by design).
	 */
	readonly interactingId: string | null;
}

/**
 * Public store API: standard Svelte `Writable` plus typed action methods.
 * Actions are minimal — DashboardCanvas integration (drag/resize/persist)
 * happens in #032.4.
 */
export interface FreeCanvasStore extends Writable<FreeCanvasState> {
	addWindow(window: WindowState): void;
	removeWindow(id: string): void;
	/** Attempt absolute move. Returns true if applied, false if no-op. */
	moveWindow(id: string, target: { x: number; y: number }): boolean;
	/** Attempt resize (top-left anchored). Returns true if applied. */
	resizeWindow(id: string, target: { w: number; h: number }): boolean;
	/**
	 * #039 — combined atomic move + resize for top/left handles where both
	 * the origin and the dimensions change in one gesture step. One mutate,
	 * one subscriber notification — half the work of `moveWindow` followed
	 * by `resizeWindow`. Returns `true` if applied.
	 */
	moveResizeWindow(
		id: string,
		target: { x: number; y: number; w: number; h: number },
	): boolean;
	/** Raise window above all others (no-op if already on top). */
	bringToFront(id: string): void;
	setPinned(id: string, pinned: boolean): void;
	/**
	 * #039 — mark `id` as actively dragged/resized. Subscribers that
	 * persist state to disk are expected to skip writes while
	 * `interactingId !== null` and flush on `endInteraction`. Idempotent
	 * for the same id; switching to a different id replaces the flag
	 * (defensive — no nested gestures are expected).
	 */
	beginInteraction(id: string): void;
	/** #039 — clear the interacting flag; pair with `beginInteraction`. */
	endInteraction(): void;
}

/** Sentinel returned from internal updaters to signal "no state change". */
const NO_CHANGE = Symbol("freeCanvasStore.noChange");

function applyResolved(
	state: FreeCanvasState,
	result: { active: Rect; moved: ReadonlyMap<string, Rect> },
): FreeCanvasState {
	const patches = new Map<string, Rect>();
	patches.set(result.active.id, result.active);
	result.moved.forEach((rect, id) => {
		patches.set(id, rect);
	});
	return {
		...state,
		windows: state.windows.map((win) => {
			const patched = patches.get(win.id);
			return patched ? { ...win, rect: patched } : win;
		}),
	};
}

/**
 * Factory: build a fresh, isolated store. One store per FreeCanvas instance —
 * the registry-style singleton pattern is intentionally avoided so that
 * multiple canvases on the same Obsidian workspace do not share state.
 */
/**
 * #039 — initialiser is structurally `FreeCanvasState` minus the
 * `interactingId` requirement, so existing callers (tests, migrations)
 * can pass `{ windows: [...] }` without flag plumbing. The factory
 * normalises `interactingId` to `null` when omitted.
 */
export type FreeCanvasStateInit = Omit<FreeCanvasState, "interactingId"> & {
	readonly interactingId?: string | null;
};

export function createFreeCanvasStore(
	initial: FreeCanvasStateInit = { windows: [] },
	resolverOptions?: ResolveOptions,
): FreeCanvasStore {
	// Normalise: allow callers to omit `interactingId` for back-compat.
	const seed: FreeCanvasState = {
		windows: initial.windows,
		interactingId: initial.interactingId ?? null,
	};
	const inner = writable<FreeCanvasState>(seed);

	function mutate(
		fn: (state: FreeCanvasState) => FreeCanvasState | typeof NO_CHANGE,
	): boolean {
		let changed = false;
		inner.update((state) => {
			const next = fn(state);
			if (next === NO_CHANGE) {
				return state;
			}
			changed = true;
			return next;
		});
		return changed;
	}

	function addWindow(window: WindowState): void {
		mutate((state) => {
			if (state.windows.some((w) => w.id === window.id)) {
				return NO_CHANGE;
			}
			return { ...state, windows: [...state.windows, window] };
		});
	}

	function removeWindow(id: string): void {
		mutate((state) => {
			if (!state.windows.some((w) => w.id === id)) {
				return NO_CHANGE;
			}
			return {
				...state,
				windows: state.windows.filter((w) => w.id !== id),
			};
		});
	}

	function moveWindow(
		id: string,
		target: { x: number; y: number },
	): boolean {
		return mutate((state) => {
			const win = state.windows.find((w) => w.id === id);
			if (!win) {
				return NO_CHANGE;
			}
			const dx = target.x - win.rect.x;
			const dy = target.y - win.rect.y;
			if (dx === 0 && dy === 0) {
				return NO_CHANGE;
			}
			const rects: Rect[] = state.windows.map((w) => w.rect);
			const mode: CollisionMode = {
				kind: "drag",
				activeId: id,
				dx,
				dy,
			};
			const result = resolveCollision(rects, mode, resolverOptions);
			if (!result.ok) {
				return NO_CHANGE;
			}
			return applyResolved(state, result);
		});
	}

	function resizeWindow(
		id: string,
		target: { w: number; h: number },
	): boolean {
		return mutate((state) => {
			const win = state.windows.find((w) => w.id === id);
			if (!win) {
				return NO_CHANGE;
			}
			if (win.rect.w === target.w && win.rect.h === target.h) {
				return NO_CHANGE;
			}
			const rects: Rect[] = state.windows.map((w) => w.rect);
			const mode: CollisionMode = {
				kind: "resize",
				activeId: id,
				newW: target.w,
				newH: target.h,
			};
			const result = resolveCollision(rects, mode, resolverOptions);
			if (!result.ok) {
				return NO_CHANGE;
			}
			return applyResolved(state, result);
		});
	}

	function moveResizeWindow(
		id: string,
		target: { x: number; y: number; w: number; h: number },
	): boolean {
		return mutate((state) => {
			const win = state.windows.find((w) => w.id === id);
			if (!win) {
				return NO_CHANGE;
			}
			const dx = target.x - win.rect.x;
			const dy = target.y - win.rect.y;
			const sameRect =
				dx === 0 &&
				dy === 0 &&
				win.rect.w === target.w &&
				win.rect.h === target.h;
			if (sameRect) {
				return NO_CHANGE;
			}
			// We model the combined move+resize as a resize at the new origin:
			// callers (WindowShell N/W/NW/NE/SW handles) have already computed
			// the destination rect from the anchor + pointer, so we apply it
			// atomically by patching the rect directly. The resolver is run
			// in `resize` mode so siblings are clamped consistently with the
			// pure-resize path.
			const rects: Rect[] = state.windows.map((w) =>
				w.id === id ? { id, x: target.x, y: target.y, w: target.w, h: target.h } : w.rect,
			);
			const mode: CollisionMode = {
				kind: "resize",
				activeId: id,
				newW: target.w,
				newH: target.h,
			};
			const result = resolveCollision(rects, mode, resolverOptions);
			if (!result.ok) {
				return NO_CHANGE;
			}
			// Override resolver's active rect with the desired origin: the
			// resolver only sees the new w/h, but we need x/y too. The pure
			// `resize` mode preserves origin by design, so we patch back.
			const patchedActive: Rect = {
				id,
				x: target.x,
				y: target.y,
				w: result.active.w,
				h: result.active.h,
			};
			return applyResolved(state, { active: patchedActive, moved: result.moved });
		});
	}

	function beginInteraction(id: string): void {
		mutate((state) => {
			if (state.interactingId === id) return NO_CHANGE;
			return { ...state, interactingId: id };
		});
	}

	function endInteraction(): void {
		mutate((state) => {
			if (state.interactingId === null) return NO_CHANGE;
			return { ...state, interactingId: null };
		});
	}

	function bringToFront(id: string): void {
		mutate((state) => {
			const win = state.windows.find((w) => w.id === id);
			if (!win) {
				return NO_CHANGE;
			}
			const maxZ = state.windows.reduce(
				(acc, w) => (w.z > acc ? w.z : acc),
				Number.NEGATIVE_INFINITY,
			);
			if (win.z >= maxZ) {
				return NO_CHANGE;
			}
			return {
				...state,
				windows: state.windows.map((w) =>
					w.id === id ? { ...w, z: maxZ + 1 } : w,
				),
			};
		});
	}

	function setPinned(id: string, pinned: boolean): void {
		mutate((state) => {
			const win = state.windows.find((w) => w.id === id);
			if (!win || win.pinned === pinned) {
				return NO_CHANGE;
			}
			return {
				...state,
				windows: state.windows.map((w) =>
					w.id === id ? { ...w, pinned } : w,
				),
			};
		});
	}

	return {
		subscribe: inner.subscribe,
		set: inner.set,
		update: inner.update,
		addWindow,
		removeWindow,
		moveWindow,
		resizeWindow,
		moveResizeWindow,
		bringToFront,
		setPinned,
		beginInteraction,
		endInteraction,
	};
}
