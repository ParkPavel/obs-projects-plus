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
