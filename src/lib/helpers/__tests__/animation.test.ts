/**
 * ios-m1 — the scroll and duration helpers honour prefers-reduced-motion on
 * top of the plugin's animation setting, and fall back to the setting alone
 * where `matchMedia` is missing or the system has no preference.
 */

jest.mock("src/lib/stores/settings", () => {
  const { writable } = require("svelte/store");
  return {
    settings: writable({ preferences: { animationBehavior: "smooth" } }),
  };
});

import { settings } from "src/lib/stores/settings";
import { getAnimationDuration, getScrollBehavior, prefersReducedMotion } from "../animation";

type Behavior = "smooth" | "instant";

const setBehavior = (animationBehavior: Behavior): void => {
  (settings as unknown as { set: (v: unknown) => void }).set({ preferences: { animationBehavior } });
};

// src/__tests__/setup.ts defines window.matchMedia writable but NOT
// configurable, so it cannot be redefined or deleted: the mocks assign it.
type MatchMediaSlot = { matchMedia: unknown };
const slot = window as unknown as MatchMediaSlot;
const original = slot.matchMedia;

function mockMatchMedia(reduce: boolean): void {
  slot.matchMedia = (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

/** A host without matchMedia: the property cannot be deleted here, so it is unset. */
function removeMatchMedia(): void {
  slot.matchMedia = undefined;
}

afterEach(() => {
  slot.matchMedia = original;
  setBehavior("smooth");
});

describe("reduced motion requested", () => {
  beforeEach(() => mockMatchMedia(true));

  it.each<Behavior>(["smooth", "instant"])("scroll is instant and duration 0 with setting %s", (b) => {
    setBehavior(b);
    expect(prefersReducedMotion()).toBe(true);
    expect(getScrollBehavior()).toBe("auto");
    expect(getAnimationDuration(400)).toBe(0);
  });
});

describe("no motion preference: the setting decides", () => {
  beforeEach(() => mockMatchMedia(false));

  it("smooth setting → smooth, default duration", () => {
    setBehavior("smooth");
    expect(prefersReducedMotion()).toBe(false);
    expect(getScrollBehavior()).toBe("smooth");
    expect(getAnimationDuration(400)).toBe(400);
    expect(getAnimationDuration()).toBe(300);
  });

  it("instant setting → auto, 0", () => {
    setBehavior("instant");
    expect(getScrollBehavior()).toBe("auto");
    expect(getAnimationDuration(400)).toBe(0);
  });
});

describe("matchMedia missing: the setting decides", () => {
  beforeEach(() => removeMatchMedia());

  it("smooth setting → smooth, default duration", () => {
    setBehavior("smooth");
    expect(prefersReducedMotion()).toBe(false);
    expect(getScrollBehavior()).toBe("smooth");
    expect(getAnimationDuration(400)).toBe(400);
  });

  it("instant setting → auto, 0", () => {
    setBehavior("instant");
    expect(getScrollBehavior()).toBe("auto");
    expect(getAnimationDuration(400)).toBe(0);
  });
});
