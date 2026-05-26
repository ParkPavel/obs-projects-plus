/**
 * WindowShell.test.ts — component-level wiring tests for drag/resize.
 *
 * Spec: FREE_CANVAS_SPEC.md §6, §6.x.
 * Ticket: #032.3.
 *
 * Strategy: render the Svelte component into jsdom via @testing-library/svelte
 * and stub `setPointerCapture`/`releasePointerCapture` (jsdom does not
 * implement Pointer Capture). Pointer events go through a small helper.
 *
 * The geometry math is exhaustively covered in `windowShellGeometry.test.ts`;
 * these tests only verify that DOM events reach the store with the right
 * arguments at the right call sites.
 */

import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";

import { createFreeCanvasStore, type WindowState } from "../freeCanvasStore";
import WindowShell from "../WindowShell.svelte";

// jsdom does not implement Pointer Capture; polyfill as no-ops so the shell
// can call setPointerCapture without throwing.
beforeAll(() => {
	if (!("setPointerCapture" in Element.prototype)) {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		(Element.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
	}
	if (!("releasePointerCapture" in Element.prototype)) {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		(Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
	}
	if (!("hasPointerCapture" in Element.prototype)) {
		(Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => true;
	}
});

// #039 — rAF coalescer. Tests drive frames manually so we can assert
// pointermove flood → 1 store mutation/frame. Helpers stash queued
// callbacks; `flushRaf()` runs them in FIFO order.
type RafCb = (t: number) => void;
const rafQueue: RafCb[] = [];
let rafIdCounter = 0;
const originalRaf = globalThis.requestAnimationFrame;
const originalCancel = globalThis.cancelAnimationFrame;
const rafByHandle = new Map<number, RafCb>();
beforeEach(() => {
	rafQueue.length = 0;
	rafIdCounter = 0;
	rafByHandle.clear();
	globalThis.requestAnimationFrame = ((cb: RafCb): number => {
		rafIdCounter += 1;
		rafByHandle.set(rafIdCounter, cb);
		rafQueue.push(cb);
		return rafIdCounter;
	}) as typeof requestAnimationFrame;
	globalThis.cancelAnimationFrame = ((handle: number): void => {
		const cb = rafByHandle.get(handle);
		if (!cb) return;
		const idx = rafQueue.indexOf(cb);
		if (idx >= 0) rafQueue.splice(idx, 1);
		rafByHandle.delete(handle);
	}) as typeof cancelAnimationFrame;
});
afterEach(() => {
	globalThis.requestAnimationFrame = originalRaf;
	globalThis.cancelAnimationFrame = originalCancel;
});
function flushRaf(): void {
	const queued = rafQueue.splice(0, rafQueue.length);
	rafByHandle.clear();
	queued.forEach((cb) => cb(performance.now()));
}

const ROOT_FONT_PX = 16;

function makeWindow(overrides: Partial<WindowState> = {}): WindowState {
	return {
		id: "W1",
		rect: { id: "W1", x: 4, y: 6, w: 10, h: 8 },
		z: 0,
		pinned: false,
		...overrides,
	};
}

function pointer(
	type: string,
	target: Element,
	clientX: number,
	clientY: number,
): Promise<boolean> {
	return fireEvent(
		target,
		new MouseEvent(type, {
			clientX,
			clientY,
			button: 0,
			bubbles: true,
			cancelable: true,
		}),
	);
}

describe("WindowShell — wiring", () => {
	test("renders the content slot wrapper and 8 resize handles", () => {
		const store = createFreeCanvasStore({ windows: [makeWindow()] });
		const { getByTestId, getAllByTestId } = render(WindowShell, {
			props: { window: makeWindow(), store },
		});

		expect(getByTestId("ppp-window-shell")).toBeInTheDocument();
		const handles = getAllByTestId(/^ppp-resize-handle-/);
		expect(handles).toHaveLength(8);
	});

	test("pointerdown on shell triggers bringToFront", () => {
		const win = makeWindow();
		const other: WindowState = {
			id: "W2",
			rect: { id: "W2", x: 100, y: 100, w: 4, h: 4 },
			z: 5, // higher
			pinned: false,
		};
		const store = createFreeCanvasStore({ windows: [win, other] });
		const spy = jest.spyOn(store, "bringToFront");

		const { getByTestId } = render(WindowShell, {
			props: { window: win, store },
		});

		void pointer("pointerdown", getByTestId("ppp-window-shell"), 0, 0);
		expect(spy).toHaveBeenCalledWith("W1");
	});

	test("drag: pointerdown→pointermove on header calls store.moveWindow with target", () => {
		const win = makeWindow();
		const store = createFreeCanvasStore({ windows: [win] });
		const moveSpy = jest.spyOn(store, "moveWindow");

		const { getByTestId } = render(WindowShell, {
			props: { window: win, store },
		});

		const header = getByTestId("ppp-window-header");
		// Stub getBoundingClientRect on the parent so canvas-relative pointer math is deterministic.
		const parent = header.parentElement!.parentElement!;
		parent.getBoundingClientRect = () =>
			({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

		// Start drag: pointer at (4rem,6rem) = (64px, 96px) → exactly the rect's top-left
		void pointer("pointerdown", header, 4 * ROOT_FONT_PX, 6 * ROOT_FONT_PX);

		// Move pointer to (10rem, 12rem) = (160px, 192px). dragOffset = (0,0)
		// so target = (10, 12). #039: pointermove is now coalesced via rAF —
		// flush the frame to drive the store mutation.
		void pointer("pointermove", header, 10 * ROOT_FONT_PX, 12 * ROOT_FONT_PX);
		flushRaf();

		expect(moveSpy).toHaveBeenCalled();
		const lastCall = moveSpy.mock.calls.at(-1)!;
		expect(lastCall[0]).toBe("W1");
		expect(lastCall[1].x).toBeCloseTo(10, 5);
		expect(lastCall[1].y).toBeCloseTo(12, 5);
	});

	test("drag: pointerup ends drag (subsequent pointermove is a no-op)", () => {
		const win = makeWindow();
		const store = createFreeCanvasStore({ windows: [win] });
		const moveSpy = jest.spyOn(store, "moveWindow");

		const { getByTestId } = render(WindowShell, {
			props: { window: win, store },
		});

		const header = getByTestId("ppp-window-header");
		const parent = header.parentElement!.parentElement!;
		parent.getBoundingClientRect = () =>
			({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

		void pointer("pointerdown", header, 4 * ROOT_FONT_PX, 6 * ROOT_FONT_PX);
		void pointer("pointermove", header, 8 * ROOT_FONT_PX, 8 * ROOT_FONT_PX);
		// #039 pointerup flushes any pending frame synchronously, so the
		// final intra-gesture move lands before we count `callsDuring`.
		void pointer("pointerup", header, 8 * ROOT_FONT_PX, 8 * ROOT_FONT_PX);
		const callsDuring = moveSpy.mock.calls.length;
		// Post-gesture pointermove must NOT trigger any store call —
		// neither immediate nor via rAF flush.
		void pointer("pointermove", header, 20 * ROOT_FONT_PX, 20 * ROOT_FONT_PX);
		flushRaf();

		expect(moveSpy.mock.calls.length).toBe(callsDuring);
	});

	test("resize: pointerdown on SE handle + pointermove calls store.resizeWindow", () => {
		const win = makeWindow();
		const store = createFreeCanvasStore({ windows: [win] });
		const resizeSpy = jest.spyOn(store, "resizeWindow");

		const { getByTestId } = render(WindowShell, {
			props: { window: win, store, minSize: { w: 1, h: 1 } },
		});

		const seHandle = getByTestId("ppp-resize-handle-SE");
		const parent = seHandle.parentElement!.parentElement!;
		parent.getBoundingClientRect = () =>
			({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

		void pointer("pointerdown", seHandle, 14 * ROOT_FONT_PX, 14 * ROOT_FONT_PX);
		// Pointer moves to (20rem, 18rem). SE anchor = top-left (4, 6).
		// Target w = 20-4 = 16, h = 18-6 = 12. #039: flush rAF frame.
		void pointer("pointermove", seHandle, 20 * ROOT_FONT_PX, 18 * ROOT_FONT_PX);
		flushRaf();

		expect(resizeSpy).toHaveBeenCalled();
		const lastCall = resizeSpy.mock.calls.at(-1)!;
		expect(lastCall[0]).toBe("W1");
		expect(lastCall[1].w).toBeCloseTo(16, 5);
		expect(lastCall[1].h).toBeCloseTo(12, 5);
	});

	test("resize: NW handle uses atomic moveResizeWindow (#039)", () => {
		const win = makeWindow();
		const store = createFreeCanvasStore({ windows: [win] });
		const moveSpy = jest.spyOn(store, "moveWindow");
		const resizeSpy = jest.spyOn(store, "resizeWindow");
		const moveResizeSpy = jest.spyOn(store, "moveResizeWindow");

		const { getByTestId } = render(WindowShell, {
			props: { window: win, store, minSize: { w: 1, h: 1 } },
		});

		const nwHandle = getByTestId("ppp-resize-handle-NW");
		const parent = nwHandle.parentElement!.parentElement!;
		parent.getBoundingClientRect = () =>
			({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

		void pointer("pointerdown", nwHandle, 4 * ROOT_FONT_PX, 6 * ROOT_FONT_PX);
		// Move to (2rem, 4rem). NW anchor = (14,14). New top-left = (2,4); w=12, h=10.
		void pointer("pointermove", nwHandle, 2 * ROOT_FONT_PX, 4 * ROOT_FONT_PX);
		flushRaf();

		// Origin-shifting handles must NOT call moveWindow+resizeWindow
		// separately — exactly one atomic moveResizeWindow.
		expect(moveSpy).not.toHaveBeenCalled();
		expect(resizeSpy).not.toHaveBeenCalled();
		expect(moveResizeSpy).toHaveBeenCalledTimes(1);
		const last = moveResizeSpy.mock.calls.at(-1)!;
		expect(last[1].x).toBeCloseTo(2, 5);
		expect(last[1].y).toBeCloseTo(4, 5);
		expect(last[1].w).toBeCloseTo(12, 5);
		expect(last[1].h).toBeCloseTo(10, 5);
	});

	// ── #039 smoothness ──────────────────────────────────────────────
	describe("#039 — smoothness (rAF coalescing + gesture lifecycle)", () => {
		test("multiple pointermove events within a single frame coalesce into one moveWindow", () => {
			const win = makeWindow();
			const store = createFreeCanvasStore({ windows: [win] });
			const moveSpy = jest.spyOn(store, "moveWindow");

			const { getByTestId } = render(WindowShell, {
				props: { window: win, store },
			});

			const header = getByTestId("ppp-window-header");
			const parent = header.parentElement!.parentElement!;
			parent.getBoundingClientRect = () =>
				({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

			void pointer("pointerdown", header, 4 * ROOT_FONT_PX, 6 * ROOT_FONT_PX);
			// Flood 5 moves into the SAME frame (no flushRaf between them).
			void pointer("pointermove", header, 5 * ROOT_FONT_PX, 7 * ROOT_FONT_PX);
			void pointer("pointermove", header, 6 * ROOT_FONT_PX, 8 * ROOT_FONT_PX);
			void pointer("pointermove", header, 7 * ROOT_FONT_PX, 9 * ROOT_FONT_PX);
			void pointer("pointermove", header, 8 * ROOT_FONT_PX, 10 * ROOT_FONT_PX);
			void pointer("pointermove", header, 10 * ROOT_FONT_PX, 12 * ROOT_FONT_PX);

			// Before flush: zero store calls — the coalescer holds them.
			expect(moveSpy).not.toHaveBeenCalled();

			flushRaf();

			// After flush: exactly one call with the latest pointer.
			expect(moveSpy).toHaveBeenCalledTimes(1);
			const last = moveSpy.mock.calls.at(-1)!;
			expect(last[1].x).toBeCloseTo(10, 5);
			expect(last[1].y).toBeCloseTo(12, 5);
		});

		test("pointerdown on header calls store.beginInteraction with window id", () => {
			const win = makeWindow();
			const store = createFreeCanvasStore({ windows: [win] });
			const beginSpy = jest.spyOn(store, "beginInteraction");

			const { getByTestId } = render(WindowShell, {
				props: { window: win, store },
			});

			const header = getByTestId("ppp-window-header");
			const parent = header.parentElement!.parentElement!;
			parent.getBoundingClientRect = () =>
				({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

			void pointer("pointerdown", header, 4 * ROOT_FONT_PX, 6 * ROOT_FONT_PX);
			expect(beginSpy).toHaveBeenCalledWith("W1");
		});

		test("pointerup on header calls store.endInteraction AND flushes pending move", () => {
			const win = makeWindow();
			const store = createFreeCanvasStore({ windows: [win] });
			const moveSpy = jest.spyOn(store, "moveWindow");
			const endSpy = jest.spyOn(store, "endInteraction");

			const { getByTestId } = render(WindowShell, {
				props: { window: win, store },
			});

			const header = getByTestId("ppp-window-header");
			const parent = header.parentElement!.parentElement!;
			parent.getBoundingClientRect = () =>
				({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

			void pointer("pointerdown", header, 4 * ROOT_FONT_PX, 6 * ROOT_FONT_PX);
			void pointer("pointermove", header, 10 * ROOT_FONT_PX, 12 * ROOT_FONT_PX);
			// Don't flush yet — pointerup must drain the pending frame.
			void pointer("pointerup", header, 10 * ROOT_FONT_PX, 12 * ROOT_FONT_PX);

			// Move spy must have received the final pointer position.
			expect(moveSpy).toHaveBeenCalled();
			const last = moveSpy.mock.calls.at(-1)!;
			expect(last[1].x).toBeCloseTo(10, 5);
			expect(last[1].y).toBeCloseTo(12, 5);
			// endInteraction is called exactly once.
			expect(endSpy).toHaveBeenCalledTimes(1);
		});

		test("resize SE: multiple pointermoves coalesce into one resizeWindow per frame", () => {
			const win = makeWindow();
			const store = createFreeCanvasStore({ windows: [win] });
			const resizeSpy = jest.spyOn(store, "resizeWindow");

			const { getByTestId } = render(WindowShell, {
				props: { window: win, store, minSize: { w: 1, h: 1 } },
			});

			const seHandle = getByTestId("ppp-resize-handle-SE");
			const parent = seHandle.parentElement!.parentElement!;
			parent.getBoundingClientRect = () =>
				({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

			void pointer("pointerdown", seHandle, 14 * ROOT_FONT_PX, 14 * ROOT_FONT_PX);
			void pointer("pointermove", seHandle, 16 * ROOT_FONT_PX, 16 * ROOT_FONT_PX);
			void pointer("pointermove", seHandle, 18 * ROOT_FONT_PX, 17 * ROOT_FONT_PX);
			void pointer("pointermove", seHandle, 20 * ROOT_FONT_PX, 18 * ROOT_FONT_PX);
			flushRaf();

			expect(resizeSpy).toHaveBeenCalledTimes(1);
			const last = resizeSpy.mock.calls.at(-1)!;
			expect(last[1].w).toBeCloseTo(16, 5);
			expect(last[1].h).toBeCloseTo(12, 5);
		});

		test("pointercancel on header flushes pending + ends interaction", () => {
			const win = makeWindow();
			const store = createFreeCanvasStore({ windows: [win] });
			const moveSpy = jest.spyOn(store, "moveWindow");
			const endSpy = jest.spyOn(store, "endInteraction");

			const { getByTestId } = render(WindowShell, {
				props: { window: win, store },
			});

			const header = getByTestId("ppp-window-header");
			const parent = header.parentElement!.parentElement!;
			parent.getBoundingClientRect = () =>
				({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

			void pointer("pointerdown", header, 4 * ROOT_FONT_PX, 6 * ROOT_FONT_PX);
			void pointer("pointermove", header, 10 * ROOT_FONT_PX, 12 * ROOT_FONT_PX);
			void pointer("pointercancel", header, 10 * ROOT_FONT_PX, 12 * ROOT_FONT_PX);

			expect(moveSpy).toHaveBeenCalled();
			expect(endSpy).toHaveBeenCalledTimes(1);
		});
	});
});
