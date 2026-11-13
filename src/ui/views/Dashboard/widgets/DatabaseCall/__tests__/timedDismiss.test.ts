import { timedDismiss } from "../timedDismiss";

it("D16: the lock reason closes after 2.5 s and on a press elsewhere", () => {
  jest.useFakeTimers();
  const close = jest.fn();
  const set = timedDismiss(close);
  set(true);
  jest.advanceTimersByTime(2500);
  expect(close).toHaveBeenCalledTimes(1);
  set(true);
  jest.advanceTimersByTime(1);
  document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  expect(close).toHaveBeenCalledTimes(2);
  set(false);
  jest.useRealTimers();
});

it("uses the owner document and window for a foreign table cell", () => {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const ownerDocument = iframe.contentDocument!;
  const ownerView = iframe.contentWindow! as Window & typeof globalThis;
  const setTimeoutSpy = jest.spyOn(ownerView, "setTimeout");
  const clearTimeoutSpy = jest.spyOn(ownerView, "clearTimeout");
  const close = jest.fn();
  const set = timedDismiss(close, 2500, () => ownerDocument);

  try {
    set(true);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2500);
    document.dispatchEvent(new Event("pointerdown"));
    expect(close).not.toHaveBeenCalled();
    ownerDocument.dispatchEvent(new ownerView.Event("pointerdown"));
    expect(close).toHaveBeenCalledTimes(1);
    set(false);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  } finally {
    set(false);
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
    iframe.remove();
  }
});
