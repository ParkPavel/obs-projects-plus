/**
 * ios-c1 — a calendar swipe right after a long-press drag still pages.
 *
 * A drag (TimelineDragManager) pauses gestures in the middle of a touch. The
 * coordinator used to ignore that touch's end while paused and keep its
 * long-press timer running, so the touch stayed `detecting`/`active` after the
 * drag, the timer fired a long press nobody asked for, and the next swipe was
 * refused by the state machine (`active → detecting` is not a transition) and
 * never took over the move.
 *
 * Geometry: jsdom's window is 1024 wide; the touch stays clear of the edge
 * zones and the swipe travels well past the swipe distance.
 */

import {
  GestureCoordinator,
  pauseGestures,
  resumeGestures,
  type GestureHandlers,
} from "../GestureCoordinator";

const START_X = 300;
const Y = 300;

/** jsdom has no `Touch` constructor; the coordinator only reads coordinates. */
function touch(type: string, x: number, y: number = Y): TouchEvent {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const point = [{ clientX: x, clientY: y }];
  const ended = type === "touchend" || type === "touchcancel";
  Object.defineProperty(ev, "touches", { value: ended ? [] : point });
  Object.defineProperty(ev, "changedTouches", { value: point });
  return ev as TouchEvent;
}

describe("GestureCoordinator — pause during a touch (ios-c1)", () => {
  let el: HTMLElement;
  let coordinator: GestureCoordinator;
  let onLongPress: jest.Mock;
  let onHorizontalSwipe: jest.Mock;
  let onTap: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    el = document.createElement("div");
    document.body.appendChild(el);
    onLongPress = jest.fn();
    onHorizontalSwipe = jest.fn();
    onTap = jest.fn();
    const handlers: GestureHandlers = { onLongPress, onHorizontalSwipe, onTap };
    coordinator = new GestureCoordinator(el, handlers);
  });

  afterEach(() => {
    coordinator.destroy();
    resumeGestures();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  /** A swipe to the right; returns whether the coordinator took over its moves. */
  const swipe = (): boolean => {
    el.dispatchEvent(touch("touchstart", START_X));
    let tookOver = false;
    for (let x = START_X + 10; x <= START_X + 120; x += 10) {
      const move = touch("touchmove", x);
      el.dispatchEvent(move);
      tookOver = tookOver || move.defaultPrevented;
    }
    el.dispatchEvent(touch("touchend", START_X + 120));
    return tookOver;
  };

  it("a long press held while paused, released, then a swipe after resume pages", () => {
    // The drag manager's long press pauses gestures mid-touch…
    el.dispatchEvent(touch("touchstart", START_X));
    expect(coordinator.getState()).toBe("detecting");
    pauseGestures();
    expect(coordinator.getState()).toBe("idle");

    // …the finger stays down past the coordinator's own long-press time, drags,
    // and lifts while still paused.
    jest.advanceTimersByTime(800);
    el.dispatchEvent(touch("touchmove", START_X + 40));
    el.dispatchEvent(touch("touchend", START_X + 40));
    expect(onLongPress).not.toHaveBeenCalled();
    expect(coordinator.getState()).toBe("idle");

    resumeGestures();
    expect(swipe()).toBe(true);
    expect(onHorizontalSwipe).toHaveBeenCalledTimes(1);
    expect(onHorizontalSwipe.mock.calls[0]?.[1]).toBe("right");
    expect(coordinator.getState()).toBe("idle");
  });

  it("a long press the coordinator recognised before the pause does not block the next swipe", () => {
    el.dispatchEvent(touch("touchstart", START_X));
    jest.advanceTimersByTime(600);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).toBe("active");

    pauseGestures();
    el.dispatchEvent(touch("touchend", START_X));
    resumeGestures();

    expect(swipe()).toBe(true);
    expect(onHorizontalSwipe).toHaveBeenCalledTimes(1);
  });

  it("a short touch the drag paused opens nothing later and leaves no timer", () => {
    el.dispatchEvent(touch("touchstart", START_X));
    pauseGestures();
    el.dispatchEvent(touch("touchend", START_X));
    resumeGestures();
    jest.advanceTimersByTime(800);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();

    expect(swipe()).toBe(true);
    expect(onHorizontalSwipe).toHaveBeenCalledTimes(1);
  });

  it("a cancelled touch returns to idle, so the next swipe still pages", () => {
    el.dispatchEvent(touch("touchstart", START_X));
    el.dispatchEvent(touch("touchcancel", START_X));
    expect(coordinator.getState()).toBe("idle");

    expect(swipe()).toBe(true);
    expect(onHorizontalSwipe).toHaveBeenCalledTimes(1);
  });

  it("still pages on a plain swipe and taps on a plain tap", () => {
    expect(swipe()).toBe(true);
    expect(onHorizontalSwipe).toHaveBeenCalledTimes(1);

    el.dispatchEvent(touch("touchstart", START_X));
    el.dispatchEvent(touch("touchend", START_X));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
