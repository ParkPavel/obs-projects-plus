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
	/** Raise window above all others (no-op if already on top). */
	bringToFront(id: string): void;
	setPinned(id: string, pinned: boolean): void;
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
export function createFreeCanvasStore(
	initial: FreeCanvasState = { windows: [] },
	resolverOptions?: ResolveOptions,
): FreeCanvasStore {
	const inner = writable<FreeCanvasState>(initial);

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
		bringToFront,
		setPinned,
	};
}
