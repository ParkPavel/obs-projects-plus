/**
 * ignoreHostSwipe — swipe ownership between the plugin and Obsidian (ios-g1 G2).
 *
 * Obsidian's mobile swipe recogniser skips a gesture whose target has an
 * ancestor carrying `data-ignore-swipe`. The action sets that flag for the
 * duration of an interior touch and must never leave it behind, otherwise the
 * drawers stop opening even from the screen edge. Both halves are pinned here:
 * the edge predicate that decides ownership, and the flag lifecycle.
 */
import {
  edgeZonePx,
  ignoreHostSwipe,
  startsInEdgeZone,
} from "../ignoreHostSwipe";

type TouchType = "touchstart" | "touchend" | "touchcancel";

/** jsdom has no Touch constructor; a plain Event with a `touches` list is what the action reads. */
function touchEvent(type: TouchType, xs: number[]): Event {
  const evt = new Event(type, { bubbles: true });
  Object.defineProperty(evt, "touches", {
    value: xs.map((clientX) => ({ clientX })),
  });
  return evt;
}

describe("startsInEdgeZone", () => {
  const width = 390;
  const edge = 20;

  it("is true at the left edge, up to and including the zone boundary", () => {
    expect(startsInEdgeZone(0, width, edge)).toBe(true);
    expect(startsInEdgeZone(5, width, edge)).toBe(true);
    expect(startsInEdgeZone(edge, width, edge)).toBe(true);
  });

  it("is true at the right edge, up to and including the zone boundary", () => {
    expect(startsInEdgeZone(width, width, edge)).toBe(true);
    expect(startsInEdgeZone(width - 5, width, edge)).toBe(true);
    expect(startsInEdgeZone(width - edge, width, edge)).toBe(true);
  });

  it("is false in the middle and just inside either boundary", () => {
    expect(startsInEdgeZone(width / 2, width, edge)).toBe(false);
    expect(startsInEdgeZone(edge + 1, width, edge)).toBe(false);
    expect(startsInEdgeZone(width - edge - 1, width, edge)).toBe(false);
  });
});

describe("edgeZonePx", () => {
  it("is 1.25 of the root font size, with a 16 fallback when jsdom reports none", () => {
    const px = edgeZonePx();
    expect(Number.isFinite(px)).toBe(true);
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(px).toBe(1.25 * (Number.isFinite(root) && root > 0 ? root : 16));
  });
});

describe("ignoreHostSwipe action", () => {
  let node: HTMLDivElement;
  let child: HTMLSpanElement;
  let action: { destroy: () => void };

  const middle = () => Math.round(window.innerWidth / 2);

  beforeEach(() => {
    node = document.createElement("div");
    child = document.createElement("span");
    node.appendChild(child);
    document.body.appendChild(node);
    action = ignoreHostSwipe(node);
  });

  afterEach(() => {
    action.destroy();
    node.remove();
  });

  it("sets the flag on a touch that starts in the middle", () => {
    child.dispatchEvent(touchEvent("touchstart", [middle()]));
    expect(node.dataset["ignoreSwipe"]).toBe("true");
  });

  it("does not set the flag on a touch that starts at either edge", () => {
    child.dispatchEvent(touchEvent("touchstart", [2]));
    expect(node.dataset["ignoreSwipe"]).toBeUndefined();
    child.dispatchEvent(touchEvent("touchstart", [window.innerWidth - 2]));
    expect(node.dataset["ignoreSwipe"]).toBeUndefined();
  });

  it("an edge touch clears a flag left by a previous interior touch", () => {
    child.dispatchEvent(touchEvent("touchstart", [middle()]));
    child.dispatchEvent(touchEvent("touchstart", [2]));
    expect(node.dataset["ignoreSwipe"]).toBeUndefined();
  });

  it("does not claim multi-touch gestures", () => {
    child.dispatchEvent(touchEvent("touchstart", [middle(), middle() + 40]));
    expect(node.dataset["ignoreSwipe"]).toBeUndefined();
  });

  it("clears the flag on touchend", () => {
    child.dispatchEvent(touchEvent("touchstart", [middle()]));
    child.dispatchEvent(touchEvent("touchend", []));
    expect(node.dataset["ignoreSwipe"]).toBeUndefined();
  });

  it("clears the flag on touchcancel", () => {
    child.dispatchEvent(touchEvent("touchstart", [middle()]));
    child.dispatchEvent(touchEvent("touchcancel", []));
    expect(node.dataset["ignoreSwipe"]).toBeUndefined();
  });

  it("clears the flag when the touch ends outside the node", () => {
    // The finger can leave the surface (or the surface can re-render under it);
    // the window listener is what guarantees cleanup in that case.
    child.dispatchEvent(touchEvent("touchstart", [middle()]));
    window.dispatchEvent(touchEvent("touchend", []));
    expect(node.dataset["ignoreSwipe"]).toBeUndefined();
  });

  it("clears the flag and stops listening on destroy", () => {
    child.dispatchEvent(touchEvent("touchstart", [middle()]));
    action.destroy();
    expect(node.dataset["ignoreSwipe"]).toBeUndefined();
    child.dispatchEvent(touchEvent("touchstart", [middle()]));
    expect(node.dataset["ignoreSwipe"]).toBeUndefined();
  });
});
