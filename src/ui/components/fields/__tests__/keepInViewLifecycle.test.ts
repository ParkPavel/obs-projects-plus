import { keepInView, type ViewportBounds } from "../keepInView";

const bounds = (height: number): ViewportBounds => ({ top: 0, left: 0, right: 400, bottom: height, width: 400, height });
function frames() {
  let sequence = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const request = jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { const id = sequence++; pending.set(id, callback); return id; });
  const cancel = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { pending.delete(id); });
  return { pending, request, cancel, run() { const batch = [...pending.values()]; pending.clear(); for (const callback of batch) callback(0); }, restore() { request.mockRestore(); cancel.mockRestore(); } };
}
function fixture(top = 600) {
  const scroller = document.createElement("div"), input = document.createElement("input"); scroller.append(input); document.body.append(scroller);
  Object.defineProperties(scroller, { scrollHeight: { value: 2000 }, clientHeight: { value: 400 }, scrollWidth: { value: 1000 }, clientWidth: { value: 400 } });
  input.getBoundingClientRect = () => ({ top: top - scroller.scrollTop, bottom: top - scroller.scrollTop + 40, left: 0, right: 200, width: 200, height: 40 } as DOMRect);
  input.scrollIntoView = jest.fn(() => { scroller.scrollTop = 300; });
  return { scroller, input };
}

it.each([0, 300])("does not restore the old scroll on a same-size resize with keyboard reported as %s", height => {
  const read = CSSStyleDeclaration.prototype.getPropertyValue;
  const keyboard = jest.spyOn(CSSStyleDeclaration.prototype, "getPropertyValue").mockImplementation(function (this: CSSStyleDeclaration, name: string) { return name === "--keyboard-height" ? String(height) : read.call(this, name); });
  const clock = frames(), { scroller, input } = fixture();
  const action = keepInView(input, () => bounds(400));
  try {
    input.focus(); expect(scroller.scrollTop).toBe(300);
    window.dispatchEvent(new Event("resize")); clock.run();
    expect(scroller.scrollTop).toBe(300);
  } finally { action.destroy(); clock.restore(); scroller.remove(); keyboard.mockRestore(); }
});

it.each([false, true])("restores only its own assisted scroll after keyboard closure; manual movement=%s", manual => {
  const clock = frames(), { scroller, input } = fixture(); let height = 800;
  const action = keepInView(input, () => bounds(height));
  try {
    input.focus(); height = 400; window.dispatchEvent(new Event("resize")); clock.run();
    expect(scroller.scrollTop).toBe(300);
    if (manual) scroller.scrollTop = 450;
    height = 800; window.dispatchEvent(new Event("resize")); clock.run();
    expect(scroller.scrollTop).toBe(manual ? 450 : 0);
  } finally { action.destroy(); clock.restore(); scroller.remove(); }
});

it("does not fight manual exploration even when no assisted scroll was needed at focus", () => {
  const clock = frames(), { scroller, input } = fixture(100);
  const action = keepInView(input, () => bounds(400));
  try {
    input.focus(); expect(input.scrollIntoView).not.toHaveBeenCalled();
    scroller.scrollTop = 200;
    window.dispatchEvent(new Event("resize")); clock.run();
    expect(scroller.scrollTop).toBe(200); expect(input.scrollIntoView).not.toHaveBeenCalled();
  } finally { action.destroy(); clock.restore(); scroller.remove(); }
});

it("coalesces frame ID0 and cancels it without a late scroll after teardown", () => {
  const clock = frames(), { scroller, input } = fixture(100);
  const action = keepInView(input, () => bounds(800));
  try {
    input.focus(); window.dispatchEvent(new Event("resize")); window.dispatchEvent(new Event("resize"));
    expect(clock.request).toHaveBeenCalledTimes(1);
    const late = clock.pending.get(0)!; action.destroy(); expect(clock.cancel).toHaveBeenCalledWith(0);
    input.getBoundingClientRect = () => ({ top: 2000, bottom: 2040, left: 0, right: 200 } as DOMRect);
    late(0); expect(input.scrollIntoView).not.toHaveBeenCalled();
  } finally { action.destroy(); clock.restore(); scroller.remove(); }
});

it("also reveals horizontal clipping without replacing the focused field", () => {
  const clock = frames(), { scroller, input } = fixture(100);
  input.getBoundingClientRect = () => ({ top: 100, bottom: 140, left: 500 - scroller.scrollLeft, right: 700 - scroller.scrollLeft } as DOMRect);
  input.scrollIntoView = jest.fn(() => { scroller.scrollLeft = 300; });
  const action = keepInView(input, () => bounds(800));
  try { input.focus(); expect(scroller.scrollLeft).toBe(300); expect(document.activeElement).toBe(input); }
  finally { action.destroy(); clock.restore(); scroller.remove(); }
});
