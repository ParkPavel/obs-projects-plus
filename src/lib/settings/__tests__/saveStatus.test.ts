import { get } from "svelte/store";

import {
  onSaveFailureEpisode,
  requestSaveRetry,
  saveStatus,
  setSaveRetryHandler,
} from "src/lib/settings/saveStatus";

const failed = (attempts: number) =>
  ({ kind: "failed", attempts, message: "EACCES" }) as const;

describe("#185 — save status out of band", () => {
  afterEach(() => {
    saveStatus.set({ kind: "idle" });
    setSaveRetryHandler(null);
  });

  it("announces a failure once per episode, not once per status change", () => {
    const seen: number[] = [];
    const stop = onSaveFailureEpisode((status) => seen.push(status.attempts));

    saveStatus.set({ kind: "saving" });
    saveStatus.set(failed(3));
    // Another failed status inside the same episode — a re-report, not a new
    // event. The chip stays up; the user is not told twice.
    saveStatus.set(failed(4));
    expect(seen).toEqual([3]);

    saveStatus.set({ kind: "saving" });
    saveStatus.set(failed(1));
    expect(seen).toEqual([3, 1]);

    stop();
    saveStatus.set({ kind: "saving" });
    saveStatus.set(failed(2));
    expect(seen).toEqual([3, 1]);
  });

  it("says nothing while writes succeed", () => {
    const seen: number[] = [];
    const stop = onSaveFailureEpisode((status) => seen.push(status.attempts));

    saveStatus.set({ kind: "saving" });
    saveStatus.set({ kind: "idle" });
    saveStatus.set({ kind: "saving" });
    saveStatus.set({ kind: "idle" });

    expect(seen).toEqual([]);
    stop();
  });

  it("routes a retry request to whoever owns the writer", () => {
    const retry = jest.fn();
    setSaveRetryHandler(retry);
    requestSaveRetry();
    expect(retry).toHaveBeenCalledTimes(1);

    setSaveRetryHandler(null);
    requestSaveRetry();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("#185 — the chip must not outlive the writer it points at", () => {
  it("a reset returns the store to idle so a stale failure cannot survive a reload", () => {
    // The status store is module-global and outlives a plugin instance if the
    // host keeps the module cached across disable/enable. Left standing, the
    // chip would show a failure belonging to a session that is gone, and its
    // retry would reach a clean writer and do nothing — a control that lies.
    // `onunload` resets it; this pins that the store can BE reset, which is the
    // half a unit test can carry.
    saveStatus.set(failed(3));
    expect(get(saveStatus).kind).toBe("failed");

    saveStatus.set({ kind: "idle" });
    expect(get(saveStatus)).toEqual({ kind: "idle" });
  });
});
