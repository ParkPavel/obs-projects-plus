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
		// so target = (10, 12).
		void pointer("pointermove", header, 10 * ROOT_FONT_PX, 12 * ROOT_FONT_PX);

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
		const callsDuring = moveSpy.mock.calls.length;
		void pointer("pointerup", header, 8 * ROOT_FONT_PX, 8 * ROOT_FONT_PX);
		void pointer("pointermove", header, 20 * ROOT_FONT_PX, 20 * ROOT_FONT_PX);

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
		// Target w = 20-4 = 16, h = 18-6 = 12.
		void pointer("pointermove", seHandle, 20 * ROOT_FONT_PX, 18 * ROOT_FONT_PX);

		expect(resizeSpy).toHaveBeenCalled();
		const lastCall = resizeSpy.mock.calls.at(-1)!;
		expect(lastCall[0]).toBe("W1");
		expect(lastCall[1].w).toBeCloseTo(16, 5);
		expect(lastCall[1].h).toBeCloseTo(12, 5);
	});

	test("resize: NW handle moves origin AND resizes (store.moveWindow + resizeWindow)", () => {
		const win = makeWindow();
		const store = createFreeCanvasStore({ windows: [win] });
		const moveSpy = jest.spyOn(store, "moveWindow");
		const resizeSpy = jest.spyOn(store, "resizeWindow");

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

		expect(moveSpy).toHaveBeenCalled();
		expect(resizeSpy).toHaveBeenCalled();
		const lastMove = moveSpy.mock.calls.at(-1)!;
		const lastResize = resizeSpy.mock.calls.at(-1)!;
		expect(lastMove[1].x).toBeCloseTo(2, 5);
		expect(lastMove[1].y).toBeCloseTo(4, 5);
		expect(lastResize[1].w).toBeCloseTo(12, 5);
		expect(lastResize[1].h).toBeCloseTo(10, 5);
	});
});
