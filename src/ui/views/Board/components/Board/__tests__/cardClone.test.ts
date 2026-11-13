import { scaleDraggedClone } from "../cardClone";

afterEach(() => {
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  document.body.replaceChildren(); jest.useRealTimers();
});

test("waits for a connected nonzero clone, then scales it once and follows the pointer", async () => {
  const clone = document.createElement("div");
  clone.getBoundingClientRect = () => ({ width: clone.isConnected ? 100 : 0, height: clone.isConnected ? 40 : 0 } as DOMRect);
  scaleDraggedClone(clone, 0.5);
  expect(clone.dataset["pppScaled"]).toBeUndefined(); expect(clone.style.width).toBe("");
  document.body.appendChild(clone);
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(clone.style.width).toBe("12.5rem"); expect(clone.style.height).toBe("5rem");
  scaleDraggedClone(clone, 0.5); expect(clone.style.width).toBe("12.5rem");
  Object.assign(clone.style, { transform: "translate3d(200px, 80px, 0)" });
  window.dispatchEvent(new MouseEvent("mousemove"));
  expect(clone.style.transform).toBe("translate3d(25rem, 10rem, 0)");
  // 25 rem * 16 px/rem * 0.5 = 200 screen pixels.
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  Object.assign(clone.style, { transform: "translate3d(210px, 80px, 0)" });
  window.dispatchEvent(new MouseEvent("mousemove"));
  expect(clone.style.transform).toBe("translate3d(210px, 80px, 0)");
});

test("release before append cancels deferred sizing and cannot resurrect the clone", async () => {
  const clone = document.createElement("div");
  clone.getBoundingClientRect = () => ({ width: 100, height: 40 } as DOMRect);
  scaleDraggedClone(clone, 0.5);
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  document.body.appendChild(clone);
  await new Promise(resolve => requestAnimationFrame(resolve));
  scaleDraggedClone(clone, 0.5);
  expect(clone.style.width).toBe(""); expect(clone.dataset["pppScaled"]).toBeUndefined();
});

test("a connected zero-sized clone can acquire its layout on the following frame", async () => {
  const clone = document.createElement("div"); document.body.appendChild(clone);
  let size = 0;
  clone.getBoundingClientRect = () => ({ width: size, height: size } as DOMRect);
  scaleDraggedClone(clone, 0.5); expect(clone.style.width).toBe("");
  size = 80;
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(clone.style.width).toBe("10rem");
});
